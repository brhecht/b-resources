import crypto from "crypto";
import { db, bucket } from "./firebase-admin.js";
import { FieldValue } from "firebase-admin/firestore";

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;

// Common words to filter out when extracting tags
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "it", "this", "that", "are", "was",
  "be", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "can", "i", "you", "he", "she",
  "we", "they", "me", "him", "her", "us", "them", "my", "your", "his",
  "its", "our", "their", "here", "there", "just", "also", "so", "if",
]);

function verifySlackSignature(req, rawBody) {
  const timestamp = req.headers["x-slack-request-timestamp"];
  const signature = req.headers["x-slack-signature"];

  if (!timestamp || !signature) return false;

  // Reject requests older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300) return false;

  const sigBasestring = `v0:${timestamp}:${rawBody}`;
  const mySignature =
    "v0=" +
    crypto
      .createHmac("sha256", SLACK_SIGNING_SECRET)
      .update(sigBasestring)
      .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(mySignature),
    Buffer.from(signature)
  );
}

function extractUrls(text) {
  // Slack formats URLs as <url|label> or <url>
  const slackUrlPattern = /<(https?:\/\/[^|>]+)(?:\|[^>]*)?>/g;
  const urls = [];
  let match;
  while ((match = slackUrlPattern.exec(text)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

function extractTags(text) {
  // Strip Slack URL formatting
  const cleaned = text.replace(/<https?:\/\/[^>]+>/g, "");
  return cleaned
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9-]/g, ""))
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .slice(0, 10);
}

function detectContentType(urls) {
  if (!urls || urls.length === 0) return null;
  const url = urls[0].toLowerCase();
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("linkedin.com")) return "linkedin";
  if (url.includes("twitter.com") || url.includes("x.com")) return "twitter";
  if (url.includes("github.com")) return "github";
  if (url.includes("medium.com") || url.includes("substack.com")) return "blog";
  if (url.includes("spotify.com") || url.includes("podcasts.apple.com")) return "podcast";
  return "webpage";
}

function classify(text, hasFiles, hasUrls, urls) {
  const lower = text.toLowerCase();

  // Explicit prefix routing (ref: as shorthand)
  if (lower.startsWith("vault:")) return { groupId: "vault", collection: "vault", label: "Vault" };
  if (lower.startsWith("library:") || lower.startsWith("lib:")) return { groupId: "library", collection: "library", label: "Library" };
  if (lower.startsWith("reference:") || lower.startsWith("references:") || lower.startsWith("ref:")) return { groupId: "references", collection: "references", label: "References" };

  // Keyword-based classification — Library (internal)
  if (lower.includes("framework") || lower.includes("playbook")) {
    return { groupId: "library", collection: "library", label: "Library > Frameworks" };
  }
  if (lower.includes("sop") || lower.includes("process") || lower.includes("checklist")) {
    return { groupId: "library", collection: "library", label: "Library > SOPs" };
  }

  // Keyword-based classification — Vault (assets)
  if (lower.includes("template") || lower.includes("brand") || lower.includes("logo") || lower.includes("asset")) {
    return { groupId: "vault", collection: "vault", label: "Vault > Brand Assets" };
  }

  // Keyword-based classification — References (external content)
  if (lower.includes("article") || lower.includes("blog") || lower.includes("post")) {
    return { groupId: "references", collection: "references", label: "References > Articles" };
  }
  if (lower.includes("video") || lower.includes("watch") || lower.includes("tutorial")) {
    return { groupId: "references", collection: "references", label: "References > Videos" };
  }
  if (lower.includes("research") || lower.includes("study") || lower.includes("report") || lower.includes("whitepaper")) {
    return { groupId: "references", collection: "references", label: "References > Research" };
  }
  if (lower.includes("guide") || lower.includes("how-to") || lower.includes("howto")) {
    return { groupId: "references", collection: "references", label: "References > Guides" };
  }
  if (lower.includes("tool") || lower.includes("app") || lower.includes("software") || lower.includes("platform")) {
    return { groupId: "references", collection: "references", label: "References > Tools" };
  }
  if (lower.includes("podcast") || lower.includes("episode")) {
    return { groupId: "references", collection: "references", label: "References > Videos" };
  }

  // URL-based classification — known external content domains → references
  if (hasUrls) {
    const contentType = detectContentType(urls);
    if (contentType === "youtube" || contentType === "podcast") {
      return { groupId: "references", collection: "references", label: "References > Videos" };
    }
    if (contentType === "blog") {
      return { groupId: "references", collection: "references", label: "References > Articles" };
    }
    if (contentType === "github") {
      return { groupId: "references", collection: "references", label: "References > Tools" };
    }
    // Other URLs → references (ungrouped, user assigns group in kanban)
    return { groupId: "", collection: "references", label: "References" };
  }

  // Files without prefix → vault (ungrouped)
  if (hasFiles) return { groupId: "", collection: "vault", label: "Vault" };

  // Plain text without URLs or files → library (ungrouped)
  return { groupId: "", collection: "library", label: "Library" };
}

function extractTitle(text, urls) {
  // Strip prefix commands (including shorthands)
  let cleaned = text.replace(/^(vault|library|lib|references?|ref):\s*/i, "").trim();
  // Strip Slack URL formatting for display
  cleaned = cleaned.replace(/<https?:\/\/[^>]+>/g, "").trim();
  // Use first line, truncated
  const firstLine = cleaned.split("\n")[0].trim();
  if (firstLine.length > 0) return firstLine.slice(0, 100);
  if (urls.length > 0) return urls[0].slice(0, 100);
  return "Untitled resource";
}

async function uploadSlackFile(slackFile, collection) {
  const downloadUrl = slackFile.url_private_download || slackFile.url_private;
  if (!downloadUrl) return null;

  try {
    // Download from Slack (requires bot token auth)
    const response = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
    });
    if (!response.ok) {
      console.error("Slack file download failed:", response.status);
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());

    // Upload to Firebase Storage
    const storagePath = `${collection}/slack-bot/${Date.now()}_${slackFile.name}`;
    const file = bucket.file(storagePath);
    await file.save(buffer, {
      metadata: { contentType: slackFile.mimetype },
    });
    await file.makePublic();
    const fileUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    return {
      fileUrl,
      fileName: slackFile.name,
      fileSize: slackFile.size || buffer.length,
      fileType: slackFile.mimetype,
      storagePath,
    };
  } catch (err) {
    console.error("File upload failed:", err);
    return null;
  }
}

async function postSlackMessage(channel, text, threadTs) {
  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel,
      text,
      thread_ts: threadTs,
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Parse raw body for signature verification
  const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

  // Handle Slack URL verification challenge
  if (body.type === "url_verification") {
    return res.status(200).json({ challenge: body.challenge });
  }

  // Verify Slack signature
  if (!verifySlackSignature(req, rawBody)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  // Handle event callbacks
  if (body.type === "event_callback") {
    const event = body.event;

    // Only process channel messages (not bot messages, not edits)
    if (
      event.type !== "message" ||
      event.subtype ||
      event.bot_id
    ) {
      return res.status(200).json({ ok: true });
    }

    const text = event.text || "";
    const urls = extractUrls(text);
    const hasFiles = !!(event.files && event.files.length > 0);
    const hasUrls = urls.length > 0;

    const classification = classify(text, hasFiles, hasUrls, urls);
    const title = extractTitle(text, urls);
    const tags = extractTags(text);
    const contentType = hasUrls ? detectContentType(urls) : (hasFiles ? "file" : "text");

    // Build the Firestore document
    const doc = {
      title,
      description: text,
      groupId: classification.groupId,
      tags,
      contentType,
      source: "slack",
      slackMessageTs: event.ts,
      slackChannelId: event.channel,
      createdAt: FieldValue.serverTimestamp(),
    };

    // Add URLs if present
    if (urls.length > 0) {
      doc.url = urls[0];
      if (urls.length > 1) doc.urls = urls;
    }

    // Upload file to Firebase Storage if present
    if (hasFiles) {
      const uploaded = await uploadSlackFile(event.files[0], classification.collection);
      if (uploaded) {
        doc.fileUrl = uploaded.fileUrl;
        doc.fileName = uploaded.fileName;
        doc.fileSize = uploaded.fileSize;
        doc.fileType = uploaded.fileType;
        doc.storagePath = uploaded.storagePath;
      } else {
        // Fallback: store metadata only if upload fails
        doc.fileName = event.files[0].name;
        doc.fileType = event.files[0].mimetype;
      }
    }

    try {
      await db.collection(classification.collection).add(doc);

      // Reply in thread with section-specific emoji and link
      const SECTION_EMOJI = { library: "📚", vault: "🔒", references: "🌐" };
      const emoji = SECTION_EMOJI[classification.collection] || "📄";
      const section = classification.collection;
      const siteUrl = "b-resources.vercel.app";
      const needsGroup = !classification.groupId;

      const fileNote = doc.fileUrl ? " (file uploaded)" : doc.fileName ? " (file metadata only)" : "";
      const replyText = needsGroup
        ? `${emoji} Added to ${classification.label}${fileNote} (ungrouped) → ${siteUrl}/${section}`
        : `${emoji} Added to ${classification.label}${fileNote} → ${siteUrl}/${section}`;

      await postSlackMessage(event.channel, replyText, event.ts);
    } catch (err) {
      console.error("Error saving resource:", err);
      await postSlackMessage(
        event.channel,
        "⚠️ Failed to save resource. Check the logs.",
        event.ts
      );
    }
  }

  return res.status(200).json({ ok: true });
}
