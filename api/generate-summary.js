// Vercel serverless function — generates a 1-2 sentence AI summary for a resource
// Requires ANTHROPIC_API_KEY env var in Vercel

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
  if (req.method === "OPTIONS") return res.status(200).end()
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" })

  const { title, description, fileName, fileType } = req.body || {}
  if (!title && !description && !fileName) {
    return res.status(400).json({ error: "Need at least title, description, or fileName" })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" })
  }

  const prompt = `You are writing a 1-2 sentence summary for a resource in a knowledge library. Be concise, specific, and useful — like a tooltip that helps someone decide whether to open this item.

Resource details:
- Title: ${title || "(none)"}
- Description: ${description || "(none)"}
- File: ${fileName || "(none)"} (${fileType || "unknown type"})

Write only the summary, nothing else. No quotes, no prefix like "This document...". Just the summary.`

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 150,
        messages: [{ role: "user", content: prompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error("Anthropic API error:", err)
      return res.status(502).json({ error: "AI generation failed" })
    }

    const data = await response.json()
    const summary = data.content?.[0]?.text?.trim() || ""
    return res.status(200).json({ summary })
  } catch (e) {
    console.error("Summary generation error:", e)
    return res.status(500).json({ error: e.message })
  }
}
