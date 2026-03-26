import crypto from "crypto";
import { db } from "./firebase-admin.js";
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

function classify(text, hasFiles, hasUrls) {
  const lower = text.toLowerCase();

  // Explicit prefix routing
  if (lower.startsWith("vault:")) return { groupId: "vault", collection: "vault", label: "Vault" };
  if (lower.startsWith("library:")) return { groupId: "library", collection: "library", label: "Library" };

  // Keyword-based classification
  if (lower.includes("framework") || lower.includes("playbook")) {
    return { groupId: "library", collection: "library", label: "Library > Frameworks" };
  }
  if (lower.includes("sop") || lower.includes("process") || lower.includes("checklist")) {
    return { groupId: "library", collection: "library", label: "Library > SOPs" };
  }
  if (lower.includes("template") || lower.includes("brand") || lower.includes("logo") || lower.includes("asset")) {
    return { groupId: "vault", collection: "vault", label: "Vault > Brand Assets" };
  }

  // Default by content type
  if (hasFiles) return { groupId: "vault", collection: "vault", label: "Vault" };
  if (hasUrls) return { groupId: "library", collection: "library", label: "Library" };

  // Fallback to inbox
  return { groupId: "inbox", collection: "library", label: "Inbox" };
}

function extractTitle(text, urls) {
  // Strip prefix commands
  let cleaned = text.replace(/^(vault|library):\s*/i, "").trim();
  // Strip Slack URL formatting for display
  cleaned = cleaned.replace(/<https?:\/\/[^>]+>/g, "").trim();
  // Use first line, truncated
  const firstLine = cleaned.split("\n")[0].trim();
  if (firstLine.length > 0) return firstLine.slice(0, 100);
  if (urls.length > 0) return urls[0].slice(0, 100);
  return "Untitled resource";
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

    const classification = classify(text, hasFiles, hasUrls);
    const title = extractTitle(text, urls);
    const tags = extractTags(text);

    // Build the Firestore document
    const doc = {
      title,
      description: text,
      groupId: classification.groupId,
      tags,
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

    // Add file info if present
    if (hasFiles) {
      doc.fileName = event.files[0].name;
      doc.fileType = event.files[0].mimetype;
    }

    try {
      await db.collection(classification.collection).add(doc);

      // Reply in thread
      const emoji = classification.groupId === "inbox" ? "📥" : "✅";
      const replyText =
        classification.groupId === "inbox"
          ? `📥 Added to Inbox — classify it at b-resources.vercel.app`
          : `✅ Added to ${classification.label}`;

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
