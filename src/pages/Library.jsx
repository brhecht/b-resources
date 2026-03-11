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

const ACCENT = "#7B8FA8"
const BG = "#F6F8FA"
const CARD_BG = "#FFFFFF"
const TEXT = "#1A1A2E"
const MUTED = "#6B7A99"
const BORDER = "#E2E8F0"
const CATEGORIES = ["All", "Framework", "Playbook", "SOP", "Reference"]

export default function Library({ user }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("All")
  const [showAdd, setShowAdd] = useState(false)
  const [viewDoc, setViewDoc] = useState(null)
  const [form, setForm] = useState({ title: "", category: "Framework", description: "", content: "", tags: "" })
  const [saving, setSaving] = useState(false)

  // File upload state
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => { loadDocs() }, [])

  async function loadDocs() {
    setLoading(true)
    try {
      const q = query(collection(db, "library"), orderBy("createdAt", "desc"))
      const snap = await getDocs(q)
      setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) { console.error(e) }
    setLoading(false)
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

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    setUploading(false)
    setProgress(0)
    try {
      let fileUrl = null
      let fileName = null
      let fileSize = null
      let fileType = null
      let storagePath = null

      if (file) {
        setUploading(true)
        storagePath = `library/${user.uid}/${Date.now()}_${file.name}`
        const storageRef = ref(storage, storagePath)
        const task = uploadBytesResumable(storageRef, file)
        await new Promise((resolve, reject) => {
          task.on("state_changed",
            snap => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
            reject,
            resolve
          )
        })
        fileUrl = await getDownloadURL(storageRef)
        fileName = file.name
        fileSize = file.size
        fileType = file.type
        setUploading(false)
      }

      await addDoc(collection(db, "library"), {
        ...form,
        tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
        uid: user.uid,
        createdAt: serverTimestamp(),
        ...(fileUrl && { fileUrl, fileName, fileSize, fileType, storagePath }),
      })

      setForm({ title: "", category: "Framework", description: "", content: "", tags: "" })
      setFile(null)
      setProgress(0)
      setShowAdd(false)
      await loadDocs()
    } catch (e) {
      console.error(e)
      alert("Save failed: " + (e?.code || e?.message || e))

    }
    setSaving(false)
    setUploading(false)
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this document?")) return
    const target = docs.find(d => d.id === id)
    if (target?.storagePath) {
      try {
        await deleteObject(ref(storage, target.storagePath))
      } catch (e) {
        console.warn("Storage delete failed (file may already be gone):", e)
      }
    }
    await deleteDoc(doc(db, "library", id))
    setDocs(prev => prev.filter(d => d.id !== id))
    if (viewDoc?.id === id) setViewDoc(null)
  }

  const filtered = docs.filter(d => {
    const matchCat = activeCategory === "All" || d.category === activeCategory
    const matchSearch = !search ||
      d.title?.toLowerCase().includes(search.toLowerCase()) ||
      d.description?.toLowerCase().includes(search.toLowerCase()) ||
      (d.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()))
    return matchCat && matchSearch
  })

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "system-ui, sans-serif", color: TEXT }}>
      <div style={{ background: CARD_BG, borderBottom: `1px solid ${BORDER}`, padding: "0 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <a href="/" style={{ color: MUTED, textDecoration: "none", fontSize: 13 }}>← Home</a>
            <span style={{ color: BORDER }}>|</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>Library</span>
          </div>
          <button onClick={() => setShowAdd(true)} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
            + Add Doc
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 32px" }}>
        <input type="text" placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: "100%", padding: "10px 16px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 14, background: CARD_BG, color: TEXT, boxSizing: "border-box", marginBottom: 20, outline: "none" }} />

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
          <div style={{ textAlign: "center", color: MUTED, padding: 60 }}>No documents found.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
            {filtered.map(d => <DocCard key={d.id} doc={d} onView={() => setViewDoc(d)} onDelete={() => handleDelete(d.id)} accent={ACCENT} border={BORDER} muted={MUTED} />)}
          </div>
        )}
      </div>

      {showAdd && (
        <Modal onClose={() => { setShowAdd(false); setFile(null); setProgress(0) }} title="Add Document" accent={ACCENT}>
          <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input required placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={iStyle} />
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={iStyle}>
              {CATEGORIES.filter(c => c !== "All").map(c => <option key={c}>{c}</option>)}
            </select>
            <input placeholder="Short description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={iStyle} />
            <textarea placeholder="Content (optional if uploading a file)" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={5} style={{ ...iStyle, resize: "vertical" }} />
            <input placeholder="Tags (comma separated)" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} style={iStyle} />

            {/* File upload zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? ACCENT : file ? "#22C55E" : BORDER}`,
                borderRadius: 10,
                padding: "20px 16px",
                textAlign: "center",
                cursor: "pointer",
                background: dragOver ? ACCENT + "10" : file ? "#F0FDF4" : BG,
                transition: "all 0.15s",
              }}
            >
              {file ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>📎</span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{file.name}</div>
                    <div style={{ fontSize: 12, color: MUTED }}>{(file.size / 1024).toFixed(1)} KB</div>
                  </div>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setFile(null) }}
                    style={{ marginLeft: 8, background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 18, padding: 0 }}
                  >×</button>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>📁</div>
                  <div style={{ fontSize: 13, color: MUTED }}>
                    {dragOver ? "Drop to attach" : "Drag & drop a file, or click to browse"}
                  </div>
                  <div style={{ fontSize: 11, color: BORDER, marginTop: 4 }}>Optional — attach any file type</div>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              onChange={e => setFile(e.target.files[0])}
              style={{ display: "none" }}
            />

            {uploading && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: MUTED, marginBottom: 4 }}>
                  <span>Uploading...</span><span>{progress}%</span>
                </div>
                <div style={{ height: 6, background: BORDER, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${progress}%`, background: ACCENT, borderRadius: 4, transition: "width 0.2s" }} />
                </div>
              </div>
            )}

            <button type="submit" disabled={saving} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 8, padding: "10px", cursor: saving ? "not-allowed" : "pointer", fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
              {saving ? (uploading ? `Uploading ${progress}%...` : "Saving...") : "Save Document"}
            </button>
          </form>
        </Modal>
      )}

      {viewDoc && (
        <Modal onClose={() => setViewDoc(null)} title={viewDoc.title} accent={ACCENT} wide>
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <span style={{ background: ACCENT + "22", color: ACCENT, padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{viewDoc.category}</span>
              {(viewDoc.tags || []).map(t => <span key={t} style={{ background: "#F0F4F8", color: MUTED, padding: "2px 10px", borderRadius: 12, fontSize: 12 }}>{t}</span>)}
            </div>
            {viewDoc.description && <p style={{ color: MUTED, marginBottom: 20, fontSize: 14 }}>{viewDoc.description}</p>}
            {viewDoc.fileUrl && (
              <a
                href={viewDoc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: ACCENT + "18", color: ACCENT, padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", marginBottom: 20 }}
              >
                📎 {viewDoc.fileName || "Download attachment"}
              </a>
            )}
            {viewDoc.content && (
              <pre style={{ background: BG, padding: 20, borderRadius: 8, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 400, overflowY: "auto" }}>
                {viewDoc.content}
              </pre>
            )}
            {!viewDoc.content && !viewDoc.fileUrl && (
              <p style={{ color: MUTED, fontStyle: "italic" }}>No content.</p>
            )}
            <button onClick={() => handleDelete(viewDoc.id)} style={{ marginTop: 20, background: "#FEF2F2", color: "#EF4444", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 }}>
              Delete Document
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function DocCard({ doc, onView, onDelete, accent, border, muted }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ background: "#fff", border: `1px solid ${hovered ? accent : border}`, borderRadius: 12, padding: "20px", cursor: "pointer", transition: "all 0.15s", transform: hovered ? "translateY(-2px)" : "none", boxShadow: hovered ? "0 4px 16px rgba(123,143,168,0.12)" : "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <span style={{ background: accent + "20", color: accent, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>{doc.category}</span>
        <button onClick={e => { e.stopPropagation(); onDelete() }} style={{ background: "none", border: "none", color: "#CBD5E1", cursor: "pointer", fontSize: 18, padding: 0 }}>×</button>
      </div>
      <div onClick={onView}>
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px", lineHeight: 1.3 }}>{doc.title}</h3>
        {doc.description && <p style={{ fontSize: 13, color: muted, margin: "0 0 12px", lineHeight: 1.5 }}>{doc.description}</p>}
        {doc.fileUrl && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
            <span style={{ fontSize: 12 }}>📎</span>
            <span style={{ fontSize: 12, color: accent, fontWeight: 500 }}>{doc.fileName || "Attachment"}</span>
          </div>
        )}
        {doc.tags?.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {doc.tags.slice(0, 3).map(t => <span key={t} style={{ background: "#F8FAFC", color: muted, fontSize: 11, padding: "2px 8px", borderRadius: 10 }}>{t}</span>)}
          </div>
        )}
      </div>
    </div>
  )
}

function Modal({ children, onClose, title, accent, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 32, width: "100%", maxWidth: wide ? 700 : 520, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#94A3B8" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const iStyle = { width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }
