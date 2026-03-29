// POST /api/capture
// Quick-capture endpoint for iOS Shortcut / bookmarklet.
// Accepts a URL, fetches metadata, AI-generates summary + tags,
// writes to Firestore "inbox" collection.

import { initializeApp, cert, getApps } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

// ── Firebase Admin init (singleton for serverless) ──────────────
function getDb() {
  if (!getApps().length) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}")
    initializeApp({ credential: cert(sa) })
  }
  return getFirestore()
}

// ── Detect content type from URL ────────────────────────────────
function detectType(url) {
  const u = url.toLowerCase()
  if (u.includes("youtube.com/watch") || u.includes("youtu.be/")) return "youtube"
  if (u.includes("linkedin.com/")) return "linkedin"
  if (u.includes("mail.google.com") || u.includes("outlook.")) return "email"
  return "webpage"
}

// ── Extract YouTube video ID ────────────────────────────────────
function youtubeId(url) {
  const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

// ── Fetch page metadata via HTML head ───────────────────────────
async function fetchMeta(url, contentType) {
  const meta = { title: "", description: "", image: "" }

  // YouTube: use oembed API (reliable, no scraping needed)
  if (contentType === "youtube") {
    try {
      const vid = youtubeId(url)
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
      const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        const data = await res.json()
        meta.title = data.title || ""
        meta.description = `Video by ${data.author_name || "unknown"}`
        meta.image = vid ? `https://img.youtube.com/vi/${vid}/hqdefault.jpg` : ""
        return meta
      }
    } catch (e) { /* fall through */ }
  }

  // General: fetch HTML and parse <head> tags
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BResourcesBot/1.0)" },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return meta
    // Only read first 16KB to find head tags
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let html = ""
    while (html.length < 16384) {
      const { done, value } = await reader.read()
      if (done) break
      html += decoder.decode(value, { stream: true })
    }
    reader.cancel().catch(() => {})

    // Title
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is)
    meta.title = titleMatch ? titleMatch[1].replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/&amp;/g, "&").trim() : ""

    // OG tags
    const ogTitle = html.match(/property=["']og:title["']\s+content=["']([^"']*)/i)
    const ogDesc = html.match(/property=["']og:description["']\s+content=["']([^"']*)/i)
    const ogImage = html.match(/property=["']og:image["']\s+content=["']([^"']*)/i)
    const metaDesc = html.match(/name=["']description["']\s+content=["']([^"']*)/i)

    if (ogTitle) meta.title = ogTitle[1]
    meta.description = (ogDesc ? ogDesc[1] : metaDesc ? metaDesc[1] : "").slice(0, 500)
    if (ogImage) meta.image = ogImage[1]
  } catch (e) { /* metadata is best-effort */ }

  return meta
}

// ── AI-generate tags + summary via Claude Haiku ─────────────────
async function aiEnrich(title, description, url, contentType) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { summary: description.slice(0, 200), tags: [contentType] }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{
          role: "user",
          content: `You are tagging a resource for a small business team's knowledge library. Given this captured URL, return JSON only — no markdown, no explanation.

URL: ${url}
Type: ${contentType}
Title: ${title}
Description: ${description}

Return: {"summary": "1-2 sentence description of what this is and why it's useful", "tags": ["tag1", "tag2", "tag3"]}

Use lowercase tags. Max 4 tags. Focus on topic, format, and use case (e.g. "strategy", "fundraising", "template", "youtube", "linkedin", "hiring").`
        }],
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (res.ok) {
      const data = await res.json()
      const text = data.content?.[0]?.text || ""
      const parsed = JSON.parse(text)
      return {
        summary: parsed.summary || description.slice(0, 200),
        tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 4) : [contentType],
      }
    }
  } catch (e) { /* AI enrichment is best-effort */ }

  return { summary: description.slice(0, 200), tags: [contentType] }
}

// ── Main handler ────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
  if (req.method === "OPTIONS") return res.status(200).end()

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  // Auth
  const { url, note, token } = req.body || {}
  const validToken = process.env.CAPTURE_TOKEN
  if (!validToken || token !== validToken) {
    return res.status(401).json({ error: "Invalid token" })
  }

  if (!url) {
    return res.status(400).json({ error: "Missing url" })
  }

  try {
    const contentType = detectType(url)
    const meta = await fetchMeta(url, contentType)
    const { summary, tags } = await aiEnrich(meta.title, meta.description, url, contentType)

    const db = getDb()
    const docData = {
      url,
      title: meta.title || url,
      description: meta.description || "",
      summary,
      tags,
      contentType,
      image: meta.image || "",
      note: note || "",
      status: "inbox",
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const docRef = await db.collection("inbox").add(docData)

    return res.status(200).json({
      ok: true,
      id: docRef.id,
      title: docData.title,
      contentType,
    })
  } catch (err) {
    console.error("Capture error:", err)
    return res.status(500).json({ error: err.message })
  }
}
