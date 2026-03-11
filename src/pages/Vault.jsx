import { useState, useEffect, useRef } from "react"
import { db, storage } from "../firebase"
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore"
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage"

const ACCENT = "#A89078"
const BG = "#FAF7F4"
const CARD_BG = "#FFFFFF"
const TEXT = "#1A1A2E"
const MUTED = "#8A7A6E"
const BORDER = "#EDE8E2"
const CATEGORIES = ["All", "Brand", "Template", "Credentials", "Document"]

function fileIcon(type) {
  if (!type) return "📄"
  if (type.startsWith("image/")) return "🖼️"
  if (type === "application/pdf") return "📋"
  if (type.includes("spreadsheet") || type.includes("excel") || type.includes("csv")) return "📊"
  if (type.includes("word") || type.includes("document")) return "📝"
  if (type.includes("zip") || type.includes("archive")) return "🗜️"
  if (type.includes("video")) return "🎬"
  if (type.includes("audio")) return "🎵"
  return "📄"
}

function fmtSize(bytes) {
  if (!bytes) return ""
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
  return (bytes / (1024 * 1024)).toFixed(1) + " MB"
}

export default function Vault({ user }) {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("All")
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: "", category: "Brand", description: "", tags: "" })
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  useEffect(() => { loadAssets() }, [])

  async function loadAssets() {
    setLoading(true)
    try {
      const q = query(collection(db, "vault"), orderBy("createdAt", "desc"))
      const snap = await getDocs(q)
      setAssets(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  async function handleUpload(e) {
    e.preventDefault()
    if (!file) return alert("Please select a file.")
    setUploading(true)
    setProgress(0)
    try {
      const storagePath = `vault/${user.uid}/${Date.now()}_${file.name}`
      const storageRef = ref(storage, storagePath)
      const task = uploadBytesResumable(storageRef, file)
      await new Promise((resolve, reject) => {
        task.on("state_changed",
          snap => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          resolve
        )
      })
      const fileUrl = await getDownloadURL(storageRef)
      await addDoc(collection(db, "vault"), {
        name: form.name || file.name,
        category: form.category,
        description: form.description,
        tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
        fileUrl,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        storagePath,
        uid: user.uid,
        createdAt: serverTimestamp(),
      })
      setForm({ name: "", category: "Brand", description: "", tags: "" })
      setFile(null)
      if (fileRef.current) fileRef.current.value = ""
      setShowAdd(false)
      setProgress(0)
      await loadAssets()
    } catch (e) { console.error(e); alert("Upload failed.") }
    setUploading(false)
  }

  async function handleDelete(asset) {
    if (!window.confirm(`Delete "${asset.name}"?`)) return
    try {
      if (asset.storagePath) {
        const storageRef = ref(storage, asset.storagePath)
        await deleteObject(storageRef)
      }
      await deleteDoc(doc(db, "vault", asset.id))
      setAssets(prev => prev.filter(a => a.id !== asset.id))
    } catch (e) { console.error(e) }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }

  function handleDragOver(e) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave() {
    setDragOver(false)
  }

  const filtered = assets.filter(a => {
    const matchCat = activeCategory === "All" || a.category === activeCategory
    const matchSearch = !search ||
      a.name?.toLowerCase().includes(search.toLowerCase()) ||
      a.description?.toLowerCase().includes(search.toLowerCase()) ||
      a.fileName?.toLowerCase().includes(search.toLowerCase()) ||
      (a.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()))
    return matchCat && matchSearch
  })

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "system-ui, sans-serif", color: TEXT }}>
      <div style={{ background: CARD_BG, borderBottom: `1px solid ${BORDER}`, padding: "0 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <a href="/" style={{ color: MUTED, textDecoration: "none", fontSize: 13 }}>← Home</a>
            <span style={{ color: BORDER }}>|</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>Vault</span>
          </div>
          <button onClick={() => setShowAdd(true)} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
            + Upload Asset
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px" }}>
        <input type="text" placeholder="Search assets..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: "100%", padding: "10px 16px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 14, background: CARD_BG, boxSizing: "border-box", marginBottom: 20, outline: "none" }} />

        <div style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              style={{ padding: "6px 16px", borderRadius: 20, border: `1.5px solid ${activeCategory === cat ? ACCENT : BORDER}`, background: activeCategory === cat ? ACCENT : CARD_BG, color: activeCategory === cat ? "#fff" : MUTED, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: MUTED, padding: 60 }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", color: MUTED, padding: 60 }}>No assets found.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
            {filtered.map(a => <AssetCard key={a.id} asset={a} onDelete={() => handleDelete(a)} accent={ACCENT} border={BORDER} muted={MUTED} />)}
          </div>
        )}
      </div>

      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 32, width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Upload Asset</h2>
              <button onClick={() => { setShowAdd(false); setFile(null); if (fileRef.current) fileRef.current.value = "" }} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#94A3B8" }}>×</button>
            </div>
            <form onSubmit={handleUpload} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Hidden native file input */}
              <input
                ref={fileRef}
                type="file"
                onChange={e => setFile(e.target.files[0])}
                style={{ display: "none" }}
              />

              {/* Styled upload zone */}
              <div
                onClick={() => !uploading && fileRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                style={{
                  border: `2px dashed ${dragOver ? ACCENT : file ? ACCENT : BORDER}`,
                  borderRadius: 12,
                  padding: "28px 20px",
                  textAlign: "center",
                  cursor: uploading ? "not-allowed" : "pointer",
                  background: dragOver ? ACCENT + "0D" : file ? ACCENT + "0A" : BG,
                  transition: "all 0.15s",
                  userSelect: "none",
                }}
              >
                {file ? (
                  <>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>{fileIcon(file.type)}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 4, wordBreak: "break-word" }}>{file.name}</div>
                    <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>{fmtSize(file.size)}</div>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setFile(null); if (fileRef.current) fileRef.current.value = "" }}
                      style={{ fontSize: 12, color: MUTED, background: "none", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "4px 12px", cursor: "pointer" }}
                    >
                      Change file
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>📁</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 4 }}>
                      Drop a file here, or <span style={{ color: ACCENT, textDecoration: "underline" }}>browse</span>
                    </div>
                    <div style={{ fontSize: 12, color: MUTED }}>Any file type · Up to 100 MB</div>
                  </>
                )}
              </div>

              <input placeholder="Name (defaults to filename)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={iStyle} />
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={iStyle}>
                {CATEGORIES.filter(c => c !== "All").map(c => <option key={c}>{c}</option>)}
              </select>
              <input placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={iStyle} />
              <input placeholder="Tags (comma separated)" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} style={iStyle} />
              {uploading && (
                <div>
                  <div style={{ height: 6, background: "#F1EDE8", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${progress}%`, background: ACCENT, transition: "width 0.2s" }} />
                  </div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{progress}% uploaded</div>
                </div>
              )}
              <button type="submit" disabled={uploading} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 8, padding: "10px", cursor: uploading ? "not-allowed" : "pointer", fontWeight: 600, opacity: uploading ? 0.7 : 1 }}>
                {uploading ? `Uploading ${progress}%...` : "Upload"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function AssetCard({ asset, onDelete, accent, border, muted }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ background: "#fff", border: `1px solid ${hovered ? accent : border}`, borderRadius: 12, padding: 20, transition: "all 0.15s", boxShadow: hovered ? "0 4px 16px rgba(168,144,120,0.1)" : "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <span style={{ fontSize: 28 }}>{fileIcon(asset.fileType)}</span>
        <button onClick={onDelete} style={{ background: "none", border: "none", color: "#CBD5E1", cursor: "pointer", fontSize: 18, padding: 0 }}>×</button>
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px", lineHeight: 1.3, wordBreak: "break-word" }}>{asset.name}</h3>
      <div style={{ fontSize: 11, color: muted, marginBottom: 8 }}>
        <span style={{ background: accent + "22", color: accent, padding: "1px 8px", borderRadius: 10, fontWeight: 600, marginRight: 6 }}>{asset.category}</span>
        {asset.fileSize ? fmtSize(asset.fileSize) : ""}
      </div>
      {asset.description && <p style={{ fontSize: 12, color: muted, margin: "0 0 10px", lineHeight: 1.4 }}>{asset.description}</p>}
      {asset.tags?.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
          {asset.tags.slice(0, 3).map(t => <span key={t} style={{ background: "#FAF7F4", color: muted, fontSize: 11, padding: "2px 8px", borderRadius: 10 }}>{t}</span>)}
        </div>
      )}
      <a href={asset.fileUrl} target="_blank" rel="noreferrer" download={asset.fileName}
        style={{ display: "block", textAlign: "center", background: accent + "18", color: accent, padding: "7px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
        ↓ Download
      </a>
    </div>
  )
}

const iStyle = { width: "100%", padding: "9px 12px", border: "1px solid #EDE8E2", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }
