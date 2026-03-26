import { useState, useEffect, useRef, useMemo } from "react"
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
import TagInput from "../components/TagInput"
import TagFilter from "../components/TagFilter"
import KanbanBoard from "../components/KanbanBoard"
import ViewToggle from "../components/ViewToggle"
import MarkdownRenderer from "../components/MarkdownRenderer"

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

function FilePreview({ fileUrl, fileType, fileName }) {
  if (!fileUrl) return null

  if (fileType?.startsWith("image/")) {
    return (
      <div style={{ marginBottom: 20, borderRadius: 10, overflow: "hidden", border: `1px solid ${BORDER}` }}>
        <img src={fileUrl} alt={fileName} style={{ width: "100%", maxHeight: 500, objectFit: "contain", display: "block", background: "#FAF7F4" }} />
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
      <div style={{ marginBottom: 20, padding: 20, background: "#FAF7F4", borderRadius: 10, border: `1px solid ${BORDER}` }}>
        <audio src={fileUrl} controls style={{ width: "100%" }} />
      </div>
    )
  }

  return null
}

export default function Vault({ user }) {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("All")
  const [showAdd, setShowAdd] = useState(false)
  const [viewAsset, setViewAsset] = useState(null)
  const [editAsset, setEditAsset] = useState(null)
  const [view, setView] = useState("grid")
  const [activeTags, setActiveTags] = useState([])
  const [form, setForm] = useState({ name: "", category: "Brand", description: "", tags: [], status: "Active", priority: 0 })
  const [editForm, setEditForm] = useState({ name: "", category: "Brand", description: "", tags: [], status: "Active", priority: 0 })
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  // Edit file state
  const [editFile, setEditFile] = useState(null)
  const [editProgress, setEditProgress] = useState(0)
  const [editUploading, setEditUploading] = useState(false)
  const editFileRef = useRef()

  const allTags = useMemo(() => {
    const set = new Set()
    assets.forEach(a => (a.tags || []).forEach(t => set.add(t)))
    return [...set].sort()
  }, [assets])

  useEffect(() => { loadAssets() }, [])

  async function loadAssets() {
    setLoading(true)
    try {
      const q = query(collection(db, "vault"), orderBy("createdAt", "desc"))
      const snap = await getDocs(q)
      setAssets(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) {
      console.error("Vault loadAssets error:", e)
      if (e?.code === "permission-denied") {
        alert("Permission denied loading vault. Check Firestore rules.")
      }
    }
    setLoading(false)
  }

  async function handleUpload(e) {
    e.preventDefault()
    if (!file) return alert("Please select a file.")
    setUploading(true)
    setSaving(true)
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
      const newAsset = {
        name: form.name || file.name,
        category: form.category,
        description: form.description,
        tags: form.tags,
        status: form.status,
        priority: form.priority,
        fileUrl,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        storagePath,
        uid: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
      const docRef = await addDoc(collection(db, "vault"), newAsset)
      // Optimistic: add to local state immediately so item always appears
      setAssets(prev => [{ id: docRef.id, ...newAsset, createdAt: new Date() }, ...prev])
      setForm({ name: "", category: "Brand", description: "", tags: [], status: "Active", priority: 0 })
      setFile(null)
      if (fileRef.current) fileRef.current.value = ""
      setShowAdd(false)
      setProgress(0)
      // Refresh in background to sync server timestamps
      loadAssets().catch(() => {})
    } catch (e) { console.error("Vault upload error:", e); alert("Upload failed: " + (e?.message || e?.code || "Unknown error")) }
    setUploading(false)
    setSaving(false)
  }

  function openEdit(asset) {
    setEditAsset(asset)
    setEditForm({
      name: asset.name || "",
      category: asset.category || "Brand",
      description: asset.description || "",
      tags: asset.tags || [],
      status: asset.status || "Active",
      priority: asset.priority || 0,
    })
    setEditFile(null)
    setEditProgress(0)
    setViewAsset(null)
  }

  async function handleUpdate(e) {
    e.preventDefault()
    if (!editAsset) return
    setSaving(true)
    setEditUploading(false)
    setEditProgress(0)
    try {
      const updates = {
        name: editForm.name,
        category: editForm.category,
        description: editForm.description,
        tags: editForm.tags,
        status: editForm.status,
        priority: editForm.priority,
        updatedAt: serverTimestamp(),
      }

      if (editFile) {
        setEditUploading(true)
        if (editAsset.storagePath) {
          try { await deleteObject(ref(storage, editAsset.storagePath)) } catch (_) {}
        }
        const storagePath = `vault/${user.uid}/${Date.now()}_${editFile.name}`
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

      await updateDoc(doc(db, "vault", editAsset.id), updates)
      // Optimistic: update local state immediately
      setAssets(prev => prev.map(a => a.id === editAsset.id ? { ...a, ...updates } : a))
      setEditAsset(null)
      setEditFile(null)
      loadAssets().catch(() => {})
    } catch (e) {
      console.error("Vault update error:", e)
      alert("Update failed: " + (e?.message || e?.code || "Please try again."))
    }
    setSaving(false)
    setEditUploading(false)
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
      if (viewAsset?.id === asset.id) setViewAsset(null)
      if (editAsset?.id === asset.id) setEditAsset(null)
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
    const matchTags = activeTags.length === 0 || activeTags.some(t => (a.tags || []).includes(t))
    return matchCat && matchSearch && matchTags
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
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ViewToggle view={view} onToggle={setView} accentColor={ACCENT} />
            <button onClick={() => setShowAdd(true)} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
              + Upload Asset
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px" }}>
        <input type="text" placeholder="Search assets..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: "100%", padding: "10px 16px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 14, background: CARD_BG, boxSizing: "border-box", marginBottom: 20, outline: "none" }} />

        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              style={{ padding: "6px 16px", borderRadius: 20, border: `1.5px solid ${activeCategory === cat ? ACCENT : BORDER}`, background: activeCategory === cat ? ACCENT : CARD_BG, color: activeCategory === cat ? "#fff" : MUTED, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
              {cat}
            </button>
          ))}
        </div>

        <TagFilter
          allTags={allTags}
          activeTags={activeTags}
          onToggle={tag => setActiveTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
          onClear={() => setActiveTags([])}
          accentColor={ACCENT}
        />

        {loading ? (
          <div style={{ textAlign: "center", color: MUTED, padding: 60 }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", color: MUTED, padding: 60 }}>No assets found.</div>
        ) : view === "kanban" ? (
          <KanbanBoard
            items={filtered}
            onStatusChange={async (id, newStatus) => {
              await updateDoc(doc(db, "vault", id), { status: newStatus, updatedAt: serverTimestamp() })
              setAssets(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a))
            }}
            renderCard={item => (
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 20 }}>{fileIcon(item.fileType)}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: TEXT, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                </div>
                <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>
                  <span style={{ background: ACCENT + "22", color: ACCENT, padding: "1px 8px", borderRadius: 10, fontWeight: 600 }}>{item.category}</span>
                </div>
                {item.tags?.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {item.tags.slice(0, 3).map(t => <span key={t} style={{ background: "#FAF7F4", color: MUTED, fontSize: 11, padding: "2px 8px", borderRadius: 10 }}>{t}</span>)}
                  </div>
                )}
              </div>
            )}
            accentColor={ACCENT}
          />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
            {filtered.map(a => (
              <AssetCard key={a.id} asset={a}
                onView={() => setViewAsset(a)}
                onEdit={() => openEdit(a)}
                onDelete={() => handleDelete(a)}
                accent={ACCENT} border={BORDER} muted={MUTED}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── ADD MODAL ── */}
      {showAdd && (
        <Modal onClose={() => { setShowAdd(false); setFile(null); if (fileRef.current) fileRef.current.value = "" }} title="Upload Asset" accent={ACCENT}>
          <form onSubmit={handleUpload} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input ref={fileRef} type="file" onChange={e => setFile(e.target.files[0])} style={{ display: "none" }} />
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
                  <button type="button" onClick={e => { e.stopPropagation(); setFile(null); if (fileRef.current) fileRef.current.value = "" }}
                    style={{ fontSize: 12, color: MUTED, background: "none", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "4px 12px", cursor: "pointer" }}>
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
            <TagInput tags={form.tags} onChange={tags => setForm(f => ({ ...f, tags }))} allTags={allTags} accentColor={ACCENT} />
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={iStyle}>
              <option value="Inbox">Inbox</option>
              <option value="Active">Active</option>
              <option value="Archive">Archive</option>
            </select>
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))} style={iStyle}>
              <option value={0}>Priority: None</option>
              <option value={1}>Priority: Low</option>
              <option value={2}>Priority: Medium</option>
              <option value={3}>Priority: High</option>
            </select>
            {uploading && (
              <div>
                <div style={{ height: 6, background: "#F1EDE8", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${progress}%`, background: ACCENT, transition: "width 0.2s" }} />
                </div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{progress}% uploaded</div>
              </div>
            )}
            <button type="submit" disabled={saving} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 8, padding: "10px", cursor: saving ? "not-allowed" : "pointer", fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
              {saving ? `Uploading ${progress}%...` : "Upload"}
            </button>
          </form>
        </Modal>
      )}

      {/* ── VIEW MODAL with preview ── */}
      {viewAsset && (
        <Modal onClose={() => setViewAsset(null)} title={viewAsset.name} accent={ACCENT} wide>
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ background: ACCENT + "22", color: ACCENT, padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{viewAsset.category}</span>
              {viewAsset.fileSize ? <span style={{ fontSize: 12, color: MUTED }}>{fmtSize(viewAsset.fileSize)}</span> : null}
              {(viewAsset.tags || []).map(t => <span key={t} style={{ background: "#F5F0EB", color: MUTED, padding: "2px 10px", borderRadius: 12, fontSize: 12 }}>{t}</span>)}
            </div>
            {viewAsset.description && (
              <div style={{ marginBottom: 20 }}>
                <MarkdownRenderer content={viewAsset.description} accentColor={ACCENT} />
              </div>
            )}

            {/* File preview */}
            <FilePreview fileUrl={viewAsset.fileUrl} fileType={viewAsset.fileType} fileName={viewAsset.fileName} />

            {/* Download link */}
            {viewAsset.fileUrl && (
              <a
                href={viewAsset.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: ACCENT + "18", color: ACCENT, padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", marginBottom: 20 }}
              >
                {fileIcon(viewAsset.fileType)} Download {viewAsset.fileName || "file"}
              </a>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => openEdit(viewAsset)} style={{ background: ACCENT + "18", color: ACCENT, border: `1px solid ${ACCENT}44`, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                ✏️ Edit
              </button>
              <button onClick={() => handleDelete(viewAsset)} style={{ background: "#FEF2F2", color: "#EF4444", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 }}>
                🗑 Delete
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── EDIT MODAL ── */}
      {editAsset && (
        <Modal onClose={() => { setEditAsset(null); setEditFile(null) }} title="Edit Asset" accent={ACCENT}>
          <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input required placeholder="Name" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} style={iStyle} />
            <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} style={iStyle}>
              {CATEGORIES.filter(c => c !== "All").map(c => <option key={c}>{c}</option>)}
            </select>
            <input placeholder="Description" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} style={iStyle} />
            <TagInput tags={editForm.tags} onChange={tags => setEditForm(f => ({ ...f, tags }))} allTags={allTags} accentColor={ACCENT} />
            <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} style={iStyle}>
              <option value="Inbox">Inbox</option>
              <option value="Active">Active</option>
              <option value="Archive">Archive</option>
            </select>
            <select value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: Number(e.target.value) }))} style={iStyle}>
              <option value={0}>Priority: None</option>
              <option value={1}>Priority: Low</option>
              <option value={2}>Priority: Medium</option>
              <option value={3}>Priority: High</option>
            </select>

            {/* Current file */}
            {editAsset.fileUrl && !editFile && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: BG, borderRadius: 8, border: `1px solid ${BORDER}` }}>
                <span style={{ fontSize: 18 }}>{fileIcon(editAsset.fileType)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{editAsset.fileName}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>{fmtSize(editAsset.fileSize)} — current file</div>
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

            <input ref={editFileRef} type="file" onChange={e => setEditFile(e.target.files[0])} style={{ display: "none" }} />

            {editUploading && (
              <div>
                <div style={{ height: 6, background: "#F1EDE8", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${editProgress}%`, background: ACCENT, transition: "width 0.2s" }} />
                </div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{editProgress}% uploading new file</div>
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

function AssetCard({ asset, onView, onEdit, onDelete, accent, border, muted }) {
  const [hovered, setHovered] = useState(false)

  // Show image thumbnail on card
  const isImage = asset.fileType?.startsWith("image/")

  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ background: "#fff", border: `1px solid ${hovered ? accent : border}`, borderRadius: 12, overflow: "hidden", transition: "all 0.15s", boxShadow: hovered ? "0 4px 16px rgba(168,144,120,0.1)" : "none" }}>

      {/* Image thumbnail */}
      {isImage && asset.fileUrl && (
        <div onClick={onView} style={{ cursor: "pointer", height: 140, overflow: "hidden", background: "#FAF7F4", borderBottom: `1px solid ${border}` }}>
          <img src={asset.fileUrl} alt={asset.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}

      <div style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          {!isImage && <span style={{ fontSize: 28 }}>{fileIcon(asset.fileType)}</span>}
          {isImage && <span style={{ background: accent + "22", color: accent, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>{asset.category}</span>}
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={onEdit} title="Edit" style={{ background: "none", border: "none", color: "#CBD5E1", cursor: "pointer", fontSize: 14, padding: "0 2px" }}>✏️</button>
            <button onClick={onDelete} title="Delete" style={{ background: "none", border: "none", color: "#CBD5E1", cursor: "pointer", fontSize: 18, padding: 0 }}>×</button>
          </div>
        </div>
        <div onClick={onView} style={{ cursor: "pointer" }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px", lineHeight: 1.3, wordBreak: "break-word" }}>{asset.name}</h3>
          <div style={{ fontSize: 11, color: muted, marginBottom: 8 }}>
            {!isImage && <span style={{ background: accent + "22", color: accent, padding: "1px 8px", borderRadius: 10, fontWeight: 600, marginRight: 6 }}>{asset.category}</span>}
            {asset.fileSize ? fmtSize(asset.fileSize) : ""}
          </div>
          {asset.description && <p style={{ fontSize: 12, color: muted, margin: "0 0 10px", lineHeight: 1.4 }}>{asset.description}</p>}
          {asset.tags?.length > 0 && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
              {asset.tags.slice(0, 3).map(t => <span key={t} style={{ background: "#FAF7F4", color: muted, fontSize: 11, padding: "2px 8px", borderRadius: 10 }}>{t}</span>)}
            </div>
          )}
        </div>
        <a href={asset.fileUrl} target="_blank" rel="noreferrer" download={asset.fileName}
          style={{ display: "block", textAlign: "center", background: accent + "18", color: accent, padding: "7px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          ↓ Download
        </a>
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

const iStyle = { width: "100%", padding: "9px 12px", border: "1px solid #EDE8E2", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }
