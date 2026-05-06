import crypto from "crypto";
import { waitUntil } from "@vercel/functions";
import { db, bucket } from "./firebase-admin.js";
import { FieldValue } from "firebase-admin/firestore";

export const config = { api: { bodyParser: false } };

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

  const mySigBuf = Buffer.from(mySignature);
  const sigBuf = Buffer.from(signature);
  if (mySigBuf.length !== sigBuf.length) return false;
  return crypto.timingSafeEqual(mySigBuf, sigBuf);
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
  if (lower.startsWith("vault:")) return { groupId: "", collection: "vault", label: "Vault" };
  if (lower.startsWith("library:") || lower.startsWith("lib:")) return { groupId: "", collection: "library", label: "Library" };
  if (lower.startsWith("reference:") || lower.startsWith("references:") || lower.startsWith("ref:")) return { groupId: "", collection: "references", label: "References" };

  // Keyword-based classification — Library (internal)
  if (lower.includes("framework") || lower.includes("playbook")) {
    return { groupId: "", collection: "library", label: "Library > Frameworks" };
  }
  if (lower.includes("sop") || lower.includes("process") || lower.includes("checklist")) {
    return { groupId: "", collection: "library", label: "Library > SOPs" };
  }

  // Keyword-based classification — Vault (assets)
  if (lower.includes("template") || lower.includes("brand") || lower.includes("logo") || lower.includes("asset")) {
    return { groupId: "", collection: "vault", label: "Vault > Brand Assets" };
  }

  // Keyword-based classification — References (external content)
  if (lower.includes("article") || lower.includes("blog") || lower.includes("post")) {
    return { groupId: "", collection: "references", label: "References > Articles" };
  }
  if (lower.includes("video") || lower.includes("watch") || lower.includes("tutorial")) {
    return { groupId: "", collection: "references", label: "References > Videos" };
  }
  if (lower.includes("research") || lower.includes("study") || lower.includes("report") || lower.includes("whitepaper")) {
    return { groupId: "", collection: "references", label: "References > Research" };
  }
  if (lower.includes("guide") || lower.includes("how-to") || lower.includes("howto")) {
    return { groupId: "", collection: "references", label: "References > Guides" };
  }
  if (lower.includes("tool") || lower.includes("app") || lower.includes("software") || lower.includes("platform")) {
    return { groupId: "", collection: "references", label: "References > Tools" };
  }
  if (lower.includes("podcast") || lower.includes("episode")) {
    return { groupId: "", collection: "references", label: "References > Videos" };
  }

  // URL-based classification — only auto-route when domain strongly implies section.
  // Anything else falls through to "ambiguous" and the bot asks the user.
  if (hasUrls) {
    const contentType = detectContentType(urls);
    if (contentType === "youtube" || contentType === "podcast") {
      return { groupId: "", collection: "references", label: "References > Videos" };
    }
    if (contentType === "blog") {
      return { groupId: "", collection: "references", label: "References > Articles" };
    }
    if (contentType === "github") {
      return { groupId: "", collection: "references", label: "References > Tools" };
    }
  }

  // Ambiguous: no explicit prefix, no strong keyword/domain hint.
  // Don't guess — ask the user to specify (vault: / library: / ref:).
  return null;
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

// Retry helper for transient TLS/network errors on Vercel cold starts.
// Firestore admin SDK occasionally fails the first TLS handshake with
// "Client network socket disconnected before secure TLS connection was
// established". A short retry resolves it on the warmed-up second attempt.
async function withRetry(fn, label, attempts = 3) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err?.message || String(err);
      const transient =
        msg.includes("socket disconnected") ||
        msg.includes("ECONNRESET") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("EAI_AGAIN") ||
        err?.code === 14 || // gRPC UNAVAILABLE
        msg.includes("DEADLINE_EXCEEDED");
      console.log(`[${label}] attempt ${i}/${attempts} failed: ${msg.slice(0, 150)}`);
      if (!transient || i === attempts) throw err;
      await new Promise((r) => setTimeout(r, 200 * i)); // 200ms, 400ms
    }
  }
  throw lastErr;
}

async function postSlackMessage(channel, text, threadTs, broadcast = true) {
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel,
      text,
      thread_ts: threadTs,
      // Mirror threaded replies back into the main channel so the original
      // poster (Brian, anyone) sees the confirmation without expanding the
      // thread or subscribing to it.
      reply_broadcast: broadcast,
    }),
  });
  const data = await response.json();
  if (!data.ok) {
    throw new Error(`chat.postMessage failed: ${data.error}`);
  }
  return data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Read raw body before any parsing (required for Slack signature verification)
  const rawBody = await new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
  const body = JSON.parse(rawBody);

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

    // Only process messages — skip bot messages and edits
    if (
      event.type !== "message" ||
      event.bot_id ||
      event.subtype === "message_changed" ||
      event.subtype === "message_deleted"
    ) {
      return res.status(200).json({ ok: true });
    }

    // Respond to Slack immediately (3-second timeout). The actual work is
    // handed to waitUntil so Vercel keeps the function alive after the
    // response is flushed — without this, Vercel suspends the container
    // and any in-flight Firestore retries / Slack post-message calls die.
    res.status(200).json({ ok: true });

    waitUntil((async () => {
    try {
      const text = event.text || "";
      const urls = extractUrls(text);
      const hasFiles = !!(event.files && event.files.length > 0);
      const hasUrls = urls.length > 0;

      const classification = classify(text, hasFiles, hasUrls, urls);

      // Ambiguous content — don't write to Firestore, ask the user to specify.
      if (!classification) {
        const ambigMention = event.user ? `<@${event.user}> ` : "";
        const ambigThread = event.thread_ts || event.ts;
        await withRetry(
          () => postSlackMessage(
            event.channel,
            `${ambigMention}🤔 Where should this go? Reply with \`vault:\`, \`library:\`, or \`ref:\` followed by your content (or use it as a prefix when you post).`,
            ambigThread
          ),
          "slack.postMessage"
        );
        return;
      }

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

      // Store file metadata first (so doc is saved even if upload fails)
      if (hasFiles) {
        doc.fileName = event.files[0].name;
        doc.fileType = event.files[0].mimetype;
        doc.fileSize = event.files[0].size || 0;
      }

      // Save to Firestore first (fast). Retry-wrapped: Vercel cold starts
      // sometimes drop the first TLS handshake to firestore.googleapis.com.
      const docRef = await withRetry(
        () => db.collection(classification.collection).add(doc),
        "firestore.add"
      );

      // Upload file to Firebase Storage (slow — runs after Firestore save)
      if (hasFiles) {
        const uploaded = await uploadSlackFile(event.files[0], classification.collection);
        if (uploaded) {
          await withRetry(
            () => docRef.update({
              fileUrl: uploaded.fileUrl,
              fileName: uploaded.fileName,
              fileSize: uploaded.fileSize,
              fileType: uploaded.fileType,
              storagePath: uploaded.storagePath,
            }),
            "firestore.update"
          );
        }
      }

      // Reply in Slack thread. All items land in the section's Inbox panel
      // (no auto-group), so the link points there for tagging + grouping.
      const SECTION_EMOJI = { library: "📚", vault: "🔒", references: "🌐" };
      const emoji = SECTION_EMOJI[classification.collection] || "📄";
      const section = classification.collection;
      const siteUrl = "b-resources.vercel.app";
      const fileNote = hasFiles ? " 📎" : "";
      const userMention = event.user ? `<@${event.user}> ` : "";
      const replyText = `${userMention}${emoji} Added to ${classification.label}${fileNote} — open ${siteUrl}/${section} to tag & group from the Inbox`;

      // Reply in the existing thread if the original message was in one;
      // otherwise start a thread under the user's top-level message.
      const threadTs = event.thread_ts || event.ts;

      console.log("Posting reply to channel:", event.channel, "thread_ts:", threadTs, "text:", replyText);
      await withRetry(
        () => postSlackMessage(event.channel, replyText, threadTs),
        "slack.postMessage"
      );
    } catch (err) {
      console.error("Error processing resource:", err);
      const errMsg = err?.message || err?.code || String(err);
      try {
        await postSlackMessage(event.channel, `⚠️ Failed: ${errMsg.slice(0, 200)}`, event.thread_ts || event.ts);
      } catch (_) {}
    }
    })());

    return; // already sent 200 above
  }

  return res.status(200).json({ ok: true });
}
