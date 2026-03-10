import { useState, useEffect } from "react"
import { db } from "../firebase"
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

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await addDoc(collection(db, "library"), {
        ...form,
        tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
        uid: user.uid,
        createdAt: serverTimestamp(),
      })
      setForm({ title: "", category: "Framework", description: "", content: "", tags: "" })
      setShowAdd(false)
      await loadDocs()
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this document?")) return
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
        <Modal onClose={() => setShowAdd(false)} title="Add Document" accent={ACCENT}>
          <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input required placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={iStyle} />
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={iStyle}>
              {CATEGORIES.filter(c => c !== "All").map(c => <option key={c}>{c}</option>)}
            </select>
            <input placeholder="Short description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={iStyle} />
            <textarea placeholder="Content" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={8} style={{ ...iStyle, resize: "vertical" }} />
            <input placeholder="Tags (comma separated)" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} style={iStyle} />
            <button type="submit" disabled={saving} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 8, padding: "10px", cursor: "pointer", fontWeight: 600 }}>
              {saving ? "Saving..." : "Save Document"}
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
            <pre style={{ background: BG, padding: 20, borderRadius: 8, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 400, overflowY: "auto" }}>
              {viewDoc.content || "No content."}
            </pre>
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
