import { useState, useEffect, useRef } from "react"
import { db, storage } from "../firebase"
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
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

function FilePreview({ fileUrl, fileType, fileName }) {
  if (!fileUrl) return null

  if (fileType?.startsWith("image/")) {
    return (
      <div style={{ marginBottom: 20, borderRadius: 10, overflow: "hidden", border: `1px solid ${BORDER}` }}>
        <img src={fileUrl} alt={fileName} style={{ width: "100%", maxHeight: 500, objectFit: "contain", display: "block", background: "#F8FAFC" }} />
      </div>
    )
  }

  if (fileType === "application/pdf") {
    return (
      <div style={{ marginBottom: 20, borderRadius: 10, overflow: "hidden", border: `1px solid ${BORDER}` }}>
        <iframe src={fileUrl} title={fileName} style={{ width: "100%", height: 500, border: "none" }} />
      </div>
    )
  }

  if (fileType?.startsWith("video/")) {
    return (
      <div style={{ marginBottom: 20, borderRadius: 10, overflow: "hidden", border: `1px solid ${BORDER}` }}>
        <video src={fileUrl} controls style={{ width: "100%", maxHeight: 400, display: "block", background: "#000" }} />
      </div>
    )
  }

  if (fileType?.startsWith("audio/")) {
    return (
      <div style={{ marginBottom: 20, padding: 20, background: "#F8FAFC", borderRadius: 10, border: `1px solid ${BORDER}` }}>
        <audio src={fileUrl} controls style={{ width: "100%" }} />
      </div>
    )
  }

  return null
}

export default function Library({ user }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("All")
  const [showAdd, setShowAdd] = useState(false)
  const [viewDoc, setViewDoc] = useState(null)
  const [editDoc, setEditDoc] = useState(null)
  const [form, setForm] = useState({ title: "", category: "Framework", description: "", content: "", tags: "" })
  const [editForm, setEditForm] = useState({ title: "", category: "Framework", description: "", content: "", tags: "" })
  const [saving, setSaving] = useState(false)

  // File upload state
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  // Edit file upload state
  const [editFile, setEditFile] = useState(null)
  const [editProgress, setEditProgress] = useState(0)
  const [editUploading, setEditUploading] = useState(false)
  const editFileRef = useRef(null)

  useEffect(() => { loadDocs() }, [])

  async function loadDocs() {
    setLoading(true)
    try {
      const q = query(collection(db, "library"), orderBy("createdAt", "desc"))
      const snap = await getDocs(q)
      setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) {
      console.error("Library loadDocs error:", e)
      if (e?.code === "permission-denied") {
        alert("Permission denied loading library. Check Firestore rules.")
      }
    }
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

      const newDoc = {
        ...form,
        tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
        uid: user.uid,
        createdAt: serverTimestamp(),
        ...(fileUrl && { fileUrl, fileName, fileSize, fileType, storagePath }),
      }
      const docRef = await addDoc(collection(db, "library"), newDoc)
      // Optimistic: add to local state immediately so item always appears
      setDocs(prev => [{ id: docRef.id, ...newDoc, createdAt: new Date() }, ...prev])
      setForm({ title: "", category: "Framework", description: "", content: "", tags: "" })
      setFile(null)
      setProgress(0)
      setShowAdd(false)
      loadDocs().catch(() => {})
    } catch (e) {
      console.error("Library add error:", e)
      alert("Save failed: " + (e?.message || e?.code || "Please try again."))
    }
    setSaving(false)
    setUploading(false)
  }

  function openEdit(d) {
    setEditDoc(d)
    setEditForm({
      title: d.title || "",
      category: d.category || "Framework",
      description: d.description || "",
      content: d.content || "",
      tags: (d.tags || []).join(", "),
    })
    setEditFile(null)
    setEditProgress(0)
    setViewDoc(null)
  }

  async function handleUpdate(e) {
    e.preventDefault()
    if (!editDoc) return
    setSaving(true)
    setEditUploading(false)
    setEditProgress(0)
    try {
      const updates = {
        title: editForm.title,
        category: editForm.category,
        description: editForm.description,
        content: editForm.content,
        tags: editForm.tags.split(",").map(t => t.trim()).filter(Boolean),
      }

      // If replacing the file
      if (editFile) {
        setEditUploading(true)
        // Delete old file from storage
        if (editDoc.storagePath) {
          try { await deleteObject(ref(storage, editDoc.storagePath)) } catch (_) {}
        }
        const storagePath = `library/${user.uid}/${Date.now()}_${editFile.name}`
        const storageRef = ref(storage, storagePath)
        const task = uploadBytesResumable(storageRef, editFile)
        await new Promise((resolve, reject) => {
          task.on("state_changed",
            snap => setEditProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
            reject,
            resolve
          )
        })
        updates.fileUrl = await getDownloadURL(storageRef)
        updates.fileName = editFile.name
        updates.fileSize = editFile.size
        updates.fileType = editFile.type
        updates.storagePath = storagePath
        setEditUploading(false)
      }

      await updateDoc(doc(db, "library", editDoc.id), updates)
      setDocs(prev => prev.map(d => d.id === editDoc.id ? { ...d, ...updates } : d))
      setEditDoc(null)
      setEditFile(null)
      loadDocs().catch(() => {})
    } catch (e) {
      console.error("Library update error:", e)
      alert("Update failed: " + (e?.message || e?.code || "Please try again."))
    }
    setSaving(false)
    setEditUploading(false)
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
    if (editDoc?.id === id) setEditDoc(null)
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
            {filtered.map(d => <DocCard key={d.id} doc={d} onView={() => setViewDoc(d)} onEdit={() => openEdit(d)} onDelete={() => handleDelete(d.id)} accent={ACCENT} border={BORDER} muted={MUTED} />)}
          </div>
        )}
      </div>

      {/* ── ADD MODAL ── */}
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
                  <span style={{ fontSize: 18 }}>{fileIcon(file.type)}</span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{file.name}</div>
                    <div style={{ fontSize: 12, color: MUTED }}>{fmtSize(file.size)}</div>
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
            <input ref={fileRef} type="file" onChange={e => setFile(e.target.files[0])} style={{ display: "none" }} />

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

      {/* ── VIEW MODAL with preview ── */}
      {viewDoc && (
        <Modal onClose={() => setViewDoc(null)} title={viewDoc.title} accent={ACCENT} wide>
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <span style={{ background: ACCENT + "22", color: ACCENT, padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{viewDoc.category}</span>
              {(viewDoc.tags || []).map(t => <span key={t} style={{ background: "#F0F4F8", color: MUTED, padding: "2px 10px", borderRadius: 12, fontSize: 12 }}>{t}</span>)}
            </div>
            {viewDoc.description && <p style={{ color: MUTED, marginBottom: 20, fontSize: 14 }}>{viewDoc.description}</p>}

            {/* File preview */}
            <FilePreview fileUrl={viewDoc.fileUrl} fileType={viewDoc.fileType} fileName={viewDoc.fileName} />

            {viewDoc.fileUrl && (
              <a
                href={viewDoc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: ACCENT + "18", color: ACCENT, padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", marginBottom: 20 }}
              >
                {fileIcon(viewDoc.fileType)} {viewDoc.fileName || "Download attachment"} {viewDoc.fileSize ? `(${fmtSize(viewDoc.fileSize)})` : ""}
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
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => openEdit(viewDoc)} style={{ background: ACCENT + "18", color: ACCENT, border: `1px solid ${ACCENT}44`, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                ✏️ Edit
              </button>
              <button onClick={() => handleDelete(viewDoc.id)} style={{ background: "#FEF2F2", color: "#EF4444", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 }}>
                🗑 Delete
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── EDIT MODAL ── */}
      {editDoc && (
        <Modal onClose={() => { setEditDoc(null); setEditFile(null) }} title="Edit Document" accent={ACCENT}>
          <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input required placeholder="Title" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} style={iStyle} />
            <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} style={iStyle}>
              {CATEGORIES.filter(c => c !== "All").map(c => <option key={c}>{c}</option>)}
            </select>
            <input placeholder="Short description" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} style={iStyle} />
            <textarea placeholder="Content" value={editForm.content} onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))} rows={5} style={{ ...iStyle, resize: "vertical" }} />
            <input placeholder="Tags (comma separated)" value={editForm.tags} onChange={e => setEditForm(f => ({ ...f, tags: e.target.value }))} style={iStyle} />

            {/* Current file info */}
            {editDoc.fileUrl && !editFile && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: BG, borderRadius: 8, border: `1px solid ${BORDER}` }}>
                <span style={{ fontSize: 18 }}>{fileIcon(editDoc.fileType)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{editDoc.fileName}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>{fmtSize(editDoc.fileSize)} — current file</div>
                </div>
                <button type="button" onClick={() => editFileRef.current?.click()} style={{ fontSize: 12, color: ACCENT, background: "none", border: `1px solid ${ACCENT}44`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
                  Replace
                </button>
              </div>
            )}

            {/* New file selected */}
            {editFile && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#F0FDF4", borderRadius: 8, border: "1px solid #BBF7D0" }}>
                <span style={{ fontSize: 18 }}>{fileIcon(editFile.type)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{editFile.name}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>{fmtSize(editFile.size)} — new file</div>
                </div>
                <button type="button" onClick={() => setEditFile(null)} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 16 }}>×</button>
              </div>
            )}

            {/* Upload new file if none exists */}
            {!editDoc.fileUrl && !editFile && (
              <button type="button" onClick={() => editFileRef.current?.click()} style={{ padding: "10px", border: `2px dashed ${BORDER}`, borderRadius: 10, background: BG, color: MUTED, cursor: "pointer", fontSize: 13 }}>
                📁 Attach a file
              </button>
            )}

            <input ref={editFileRef} type="file" onChange={e => setEditFile(e.target.files[0])} style={{ display: "none" }} />

            {editUploading && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: MUTED, marginBottom: 4 }}>
                  <span>Uploading...</span><span>{editProgress}%</span>
                </div>
                <div style={{ height: 6, background: BORDER, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${editProgress}%`, background: ACCENT, borderRadius: 4, transition: "width 0.2s" }} />
                </div>
              </div>
            )}

            <button type="submit" disabled={saving} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 8, padding: "10px", cursor: saving ? "not-allowed" : "pointer", fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
              {saving ? (editUploading ? `Uploading ${editProgress}%...` : "Saving...") : "Save Changes"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

function DocCard({ doc, onView, onEdit, onDelete, accent, border, muted }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ background: "#fff", border: `1px solid ${hovered ? accent : border}`, borderRadius: 12, padding: "20px", cursor: "pointer", transition: "all 0.15s", transform: hovered ? "translateY(-2px)" : "none", boxShadow: hovered ? "0 4px 16px rgba(123,143,168,0.12)" : "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <span style={{ background: accent + "20", color: accent, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>{doc.category}</span>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={e => { e.stopPropagation(); onEdit() }} title="Edit" style={{ background: "none", border: "none", color: "#CBD5E1", cursor: "pointer", fontSize: 14, padding: "0 2px" }}>✏️</button>
          <button onClick={e => { e.stopPropagation(); onDelete() }} title="Delete" style={{ background: "none", border: "none", color: "#CBD5E1", cursor: "pointer", fontSize: 18, padding: 0 }}>×</button>
        </div>
      </div>
      <div onClick={onView}>
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px", lineHeight: 1.3 }}>{doc.title}</h3>
        {doc.description && <p style={{ fontSize: 13, color: muted, margin: "0 0 12px", lineHeight: 1.5 }}>{doc.description}</p>}
        {doc.fileUrl && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
            <span style={{ fontSize: 12 }}>{fileIcon(doc.fileType)}</span>
            <span style={{ fontSize: 12, color: accent, fontWeight: 500 }}>{doc.fileName || "Attachment"}</span>
            {doc.fileSize ? <span style={{ fontSize: 11, color: muted }}>({fmtSize(doc.fileSize)})</span> : null}
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
