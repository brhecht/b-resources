// Proxy endpoint to fetch text content from Firebase Storage URLs
// Bypasses CORS restrictions that prevent client-side fetch of .md/.txt files
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" })

  const { url } = req.body
  if (!url || !url.includes("firebasestorage.googleapis.com")) {
    return res.status(400).json({ error: "Invalid URL" })
  }

  try {
    const resp = await fetch(url)
    if (!resp.ok) return res.status(resp.status).json({ error: "Fetch failed" })

    const text = await resp.text()
    res.status(200).json({ content: text })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
