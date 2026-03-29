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
  where,
} from "firebase/firestore"
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage"
import { CollapsibleMessages } from "../components/MessageThread"
import TagInput from "../components/TagInput"
import InlineNotes from "../components/InlineNotes"
import TagFilter from "../components/TagFilter"
import ViewSwitcher from "../components/ViewSwitcher"
import GroupKanban from "../components/GroupKanban"
import GroupManager from "../components/GroupManager"
import ListView from "../components/ListView"
import ResourceCard from "../components/ResourceCard"
import SidePanel from "../components/SidePanel"
import MarkdownRenderer from "../components/MarkdownRenderer"
import { getTagColor } from "../components/tagColors"

const ACCENT = "#7B8FA8"
const BG = "#F6F8FA"
const CARD_BG = "#FFFFFF"
const TEXT = "#1A1A2E"
const MUTED = "#6B7A99"
const BORDER = "#E2E8F0"

const DEFAULT_GROUPS = [
  { name: "Frameworks", color: "#7B8FA8", icon: "🧩", order: 0 },
  { name: "Playbooks", color: "#6BA37E", icon: "📗", order: 1 },
  { name: "SOPs", color: "#E8913A", icon: "📋", order: 2 },
  { name: "Reference", color: "#9B8EC4", icon: "📚", order: 3 },
  { name: "Templates", color: "#E57373", icon: "📄", order: 4 },
]

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

function fmtDate(ts) {
  if (!ts) return ""
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function timeAgo(ts) {
  if (!ts) return ""
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return fmtDate(ts)
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
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  const [viewDoc, setViewDoc] = useState(null)
  const [editDoc, setEditDoc] = useState(null)
  const [view, setView] = useState("group")
  const [activeTags, setActiveTags] = useState([])
  const [form, setForm] = useState({ title: "", description: "", content: "", tags: [], groupId: "", subGroupId: "" })
  const [editForm, setEditForm] = useState({ title: "", description: "", content: "", tags: [], groupId: "", subGroupId: "" })
  const [saving, setSaving] = useState(false)
  const [showGroupManager, setShowGroupManager] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  const [addToGroupId, setAddToGroupId] = useState(null)
  const [panelDoc, setPanelDoc] = useState(null)

  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  const [editFile, setEditFile] = useState(null)
  const [editProgress, setEditProgress] = useState(0)
  const [editUploading, setEditUploading] = useState(false)
  const editFileRef = useRef(null)

  const allTags = useMemo(() => {
    const set = new Set()
    docs.forEach(d => (d.tags || []).forEach(t => set.add(t)))
    return [...set].sort()
  }, [docs])

  const groupMap = useMemo(() => {
    const m = {}
    groups.forEach(g => { m[g.id] = g })
    return m
  }, [groups])

  const topGroups = useMemo(() => groups.filter(g => !g.parentId), [groups])

  useEffect(() => { loadDocs(); loadGroups() }, [])

  async function loadDocs() {
    setLoading(true)
    try {
      const q = query(collection(db, "library"), orderBy("createdAt", "desc"))
      const snap = await getDocs(q)
      setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) {
      console.error("Library loadDocs error:", e)
      if (e?.code === "permission-denied") alert("Permission denied loading library. Check Firestore rules.")
    }
    setLoading(false)
  }

  async function loadGroups() {
    try {
      const q = query(collection(db, "groups"), where("collection", "==", "library"), orderBy("order", "asc"))
      const snap = await getDocs(q)
      let loaded = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      if (loaded.filter(g => !g.parentId).length === 0) {
        loaded = await seedDefaultGroups()
      }
      setGroups(loaded)
    } catch (e) {
      console.error("Load groups error:", e)
      try {
        const q2 = query(collection(db, "groups"), where("collection", "==", "library"))
        const snap2 = await getDocs(q2)
        let loaded2 = snap2.docs.map(d => ({ id: d.id, ...d.data() }))
        if (loaded2.filter(g => !g.parentId).length === 0) {
          loaded2 = await seedDefaultGroups()
        }
        setGroups(loaded2)
      } catch (e2) {
        console.error("Fallback load groups error:", e2)
      }
    }
  }

  async function seedDefaultGroups() {
    const created = []
    for (const g of DEFAULT_GROUPS) {
      const docRef = await addDoc(collection(db, "groups"), {
        ...g,
        parentId: null,
        collection: "library",
        createdAt: serverTimestamp(),
      })
      created.push({ id: docRef.id, ...g, parentId: null, collection: "library" })
    }
    return created
  }

  async function handleSaveGroup(data) {
    try {
      if (editingGroup?.id) {
        await updateDoc(doc(db, "groups", editingGroup.id), { ...data, updatedAt: serverTimestamp() })
      } else {
        const order = groups.filter(g => !g.parentId).length
        await addDoc(collection(db, "groups"), { ...data, order, createdAt: serverTimestamp() })
      }
      await loadGroups()
      setShowGroupManager(false)
      setEditingGroup(null)
    } catch (e) {
      console.error("Save group error:", e)
      alert("Failed to save group: " + (e?.message || ""))
    }
  }

  async function handleDeleteGroup(groupId) {
    if (!window.confirm("Delete this group? Items will become ungrouped.")) return
    try {
      const subs = groups.filter(g => g.parentId === groupId)
      for (const sub of subs) {
        await deleteDoc(doc(db, "groups", sub.id))
      }
      await deleteDoc(doc(db, "groups", groupId))
      const affected = docs.filter(d => d.groupId === groupId)
      for (const d of affected) {
        await updateDoc(doc(db, "library", d.id), { groupId: null, subGroupId: null, updatedAt: serverTimestamp() })
      }
      setDocs(prev => prev.map(d => d.groupId === groupId ? { ...d, groupId: null, subGroupId: null } : d))
      await loadGroups()
      setShowGroupManager(false)
      setEditingGroup(null)
    } catch (e) {
      console.error("Delete group error:", e)
    }
  }

  async function handleGroupChange(itemId, newGroupId, newSubGroupId) {
    try {
      const updates = { groupId: newGroupId || null, subGroupId: newSubGroupId || null, updatedAt: serverTimestamp() }
      await updateDoc(doc(db, "library", itemId), updates)
      setDocs(prev => prev.map(d => d.id === itemId ? { ...d, ...updates } : d))
    } catch (e) {
      console.error("Group change error:", e)
    }
  }

  async function handlePin(item) {
    const newPinned = !item.pinned
    try {
      await updateDoc(doc(db, "library", item.id), { pinned: newPinned, updatedAt: serverTimestamp() })
      setDocs(prev => prev.map(d => d.id === item.id ? { ...d, pinned: newPinned } : d))
      setPanelDoc(prev => prev?.id === item.id ? { ...prev, pinned: newPinned } : prev)
    } catch (e) {
      console.error("Pin error:", e)
    }
  }

  async function handleTagsChange(itemId, newTags) {
    try {
      await updateDoc(doc(db, "library", itemId), { tags: newTags, updatedAt: serverTimestamp() })
      setDocs(prev => prev.map(d => d.id === itemId ? { ...d, tags: newTags } : d))
      setViewDoc(prev => prev?.id === itemId ? { ...prev, tags: newTags } : prev)
      setPanelDoc(prev => prev?.id === itemId ? { ...prev, tags: newTags } : prev)
    } catch (e) {
      console.error("Tag update error:", e)
    }
  }

  async function handleNotesChange(itemId, newDescription) {
    try {
      await updateDoc(doc(db, "library", itemId), { description: newDescription, updatedAt: serverTimestamp() })
      setDocs(prev => prev.map(d => d.id === itemId ? { ...d, description: newDescription } : d))
      setViewDoc(prev => prev?.id === itemId ? { ...prev, description: newDescription } : prev)
      setPanelDoc(prev => prev?.id === itemId ? { ...prev, description: newDescription } : prev)
    } catch (e) {
      console.error("Notes update error:", e)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }

  async function generateSummary(docId, title, description, fileName, fileType) {
    try {
      const resp = await fetch("/api/generate-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, fileName, fileType }),
      })
      if (!resp.ok) return
      const { summary } = await resp.json()
      if (summary) {
        await updateDoc(doc(db, "library", docId), { summary })
        setDocs(prev => prev.map(d => d.id === docId ? { ...d, summary } : d))
        setViewDoc(prev => prev?.id === docId ? { ...prev, summary } : prev)
        setPanelDoc(prev => prev?.id === docId ? { ...prev, summary } : prev)
      }
    } catch (e) { console.error("Summary generation failed:", e) }
  }

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    setUploading(false)
    setProgress(0)
    try {
      let fileUrl = null, fileName = null, fileSize = null, fileType = null, storagePath = null

      if (file) {
        setUploading(true)
        storagePath = `library/${user.uid}/${Date.now()}_${file.name}`
        const storageRef = ref(storage, storagePath)
        const task = uploadBytesResumable(storageRef, file)
        await new Promise((resolve, reject) => {
          task.on("state_changed", snap => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)), reject, resolve)
        })
        fileUrl = await getDownloadURL(storageRef)
        fileName = file.name
        fileSize = file.size
        fileType = file.type
        setUploading(false)
      }

      const newDoc = {
        title: form.title,
        description: form.description,
        content: form.content,
        tags: form.tags,
        groupId: form.groupId || null,
        subGroupId: form.subGroupId || null,
        pinned: false,
        category: groupMap[form.groupId]?.name || "",
        uid: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...(fileUrl && { fileUrl, fileName, fileSize, fileType, storagePath }),
      }
      const docRef = await addDoc(collection(db, "library"), newDoc)
      setDocs(prev => [{ id: docRef.id, ...newDoc, createdAt: new Date() }, ...prev])
      generateSummary(docRef.id, form.title, form.description, fileName, fileType)
      setForm({ title: "", description: "", content: "", tags: [], groupId: "", subGroupId: "" })
      setFile(null)
      setProgress(0)
      setShowAdd(false)
      setAddToGroupId(null)
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
      description: d.description || "",
      content: d.content || "",
      tags: d.tags || [],
      groupId: d.groupId || "",
      subGroupId: d.subGroupId || "",
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
        description: editForm.description,
        content: editForm.content,
        tags: editForm.tags,
        groupId: editForm.groupId || null,
        subGroupId: editForm.subGroupId || null,
        category: groupMap[editForm.groupId]?.name || editDoc.category || "",
        updatedAt: serverTimestamp(),
      }

      if (editFile) {
        setEditUploading(true)
        if (editDoc.storagePath) {
          try { await deleteObject(ref(storage, editDoc.storagePath)) } catch (_) {}
        }
        const storagePath = `library/${user.uid}/${Date.now()}_${editFile.name}`
        const storageRef = ref(storage, storagePath)
        const task = uploadBytesResumable(storageRef, editFile)
        await new Promise((resolve, reject) => {
          task.on("state_changed", snap => setEditProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)), reject, resolve)
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
      try { await deleteObject(ref(storage, target.storagePath)) } catch (e) { console.warn("Storage delete failed:", e) }
    }
    await deleteDoc(doc(db, "library", id))
    setDocs(prev => prev.filter(d => d.id !== id))
    if (viewDoc?.id === id) setViewDoc(null)
    if (editDoc?.id === id) setEditDoc(null)
  }

  const filtered = docs.filter(d => {
    const matchSearch = !search ||
      d.title?.toLowerCase().includes(search.toLowerCase()) ||
      d.description?.toLowerCase().includes(search.toLowerCase()) ||
      (d.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()))
    const matchTags = activeTags.length === 0 || activeTags.some(t => (d.tags || []).includes(t))
    return matchSearch && matchTags
  })

  const subGroupsFor = (groupId) => groups.filter(g => g.parentId === groupId)

  function GroupSelect({ value, onChange, subValue, onSubChange }) {
    const subs = value ? subGroupsFor(value) : []
    return (
      <>
        <div>
          <label style={{ fontSize: 12, color: MUTED, marginBottom: 4, display: "block" }}>Group</label>
          <select value={value || ""} onChange={e => { onChange(e.target.value); if (onSubChange) onSubChange("") }} style={iStyle}>
            <option value="">No group</option>
            {topGroups.map(g => (
              <option key={g.id} value={g.id}>{g.icon} {g.name}</option>
            ))}
          </select>
        </div>
        {subs.length > 0 && (
          <div>
            <label style={{ fontSize: 12, color: MUTED, marginBottom: 4, display: "block" }}>Sub-group</label>
            <select value={subValue || ""} onChange={e => onSubChange(e.target.value)} style={iStyle}>
              <option value="">None</option>
              {subs.map(s => (
                <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
              ))}
            </select>
          </div>
        )}
      </>
    )
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "system-ui, sans-serif", color: TEXT }}>
      <div style={{ background: CARD_BG, borderBottom: `1px solid ${BORDER}`, padding: "0 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <a href="/" style={{ color: MUTED, textDecoration: "none", fontSize: 13 }}>← Home</a>
            <span style={{ color: BORDER }}>|</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>Library</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ViewSwitcher view={view} onSwitch={v => { setView(v); setPanelDoc(null) }} accentColor={ACCENT} />
            <button onClick={() => { setShowGroupManager(true); setEditingGroup(null) }} style={{ background: ACCENT + "18", color: ACCENT, border: `1px solid ${ACCENT}44`, borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              Manage Groups
            </button>
            <button onClick={() => { setShowAdd(true); setAddToGroupId(null) }} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
              + Add Doc
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: panelDoc ? "none" : 1200, margin: "0 auto", padding: "32px 32px" }}>
        <input type="text" placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: "100%", padding: "10px 16px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 14, background: CARD_BG, color: TEXT, boxSizing: "border-box", marginBottom: 20, outline: "none" }} />

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
          <div style={{ textAlign: "center", color: MUTED, padding: 60 }}>No documents found.</div>
        ) : view === "group" ? (
          <div style={{ display: "flex", gap: 0, height: panelDoc ? "calc(100vh - 240px)" : "auto" }}>
            <div style={{ flex: 1, minWidth: 0, overflowX: "auto" }}>
              <GroupKanban
                items={filtered}
                groups={groups}
                onGroupChange={handleGroupChange}
                onView={item => setPanelDoc(item)}
                onEdit={item => openEdit(item)}
                onDelete={item => handleDelete(item.id)}
                onPin={item => handlePin(item)}
                onAddToGroup={groupId => { setAddToGroupId(groupId); setForm(f => ({ ...f, groupId })); setShowAdd(true) }}
                onEditGroup={group => {
                  if (group._delete) { handleDeleteGroup(group.id) } else { setEditingGroup(group); setShowGroupManager(true) }
                }}
                onAddGroup={() => { setEditingGroup(null); setShowGroupManager(true) }}
                onAddSubGroup={parentId => { setEditingGroup({ parentId }); setShowGroupManager(true) }}
                onTagsChange={(item, newTags) => handleTagsChange(item.id, newTags)}
                allTags={allTags}
                accentColor={ACCENT}
                borderColor={BORDER}
                mutedColor={MUTED}
                userEmail={user?.email}
              />
            </div>
            {panelDoc && (
              <SidePanel
                item={panelDoc}
                onClose={() => setPanelDoc(null)}
                onEdit={item => { setPanelDoc(null); openEdit(item) }}
                onDelete={item => { setPanelDoc(null); handleDelete(item.id) }}
                onPin={item => handlePin(item)}
                onTagsChange={handleTagsChange}
                onNotesChange={handleNotesChange}
                onGenerateSummary={item => generateSummary(item.id, item.title, item.description, item.fileName, item.fileType)}
                allTags={allTags}
                groupMap={groupMap}
                collectionName="library"
                user={user}
                accentColor={ACCENT}
                borderColor={BORDER}
                mutedColor={MUTED}
                MessagesComponent={CollapsibleMessages}
              />
            )}
          </div>
        ) : view === "list" ? (
          <ListView
            items={filtered}
            groups={groups}
            onView={item => setViewDoc(item)}
            onEdit={item => openEdit(item)}
            onDelete={item => handleDelete(item.id)}
            onPin={item => handlePin(item)}
            accentColor={ACCENT}
            borderColor={BORDER}
            mutedColor={MUTED}
            userEmail={user?.email}
          />
        ) : (
          <div>
            {filtered.some(d => d.pinned) && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#F59E0B" }}>📌 Pinned</span>
                  <div style={{ flex: 1, height: 1, background: BORDER }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18, marginBottom: 24 }}>
                  {filtered.filter(d => d.pinned).map(d => (
                    <ResourceCard key={d.id} item={d} group={groupMap[d.groupId]} onView={() => setViewDoc(d)} onEdit={() => openEdit(d)} onDelete={() => handleDelete(d.id)} onPin={() => handlePin(d)} accentColor={ACCENT} borderColor={BORDER} mutedColor={MUTED} userEmail={user?.email} />
                  ))}
                </div>
              </>
            )}
            {filtered.some(d => !d.pinned) && (
              <>
                {filtered.some(d => d.pinned) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: MUTED }}>All</span>
                    <div style={{ flex: 1, height: 1, background: BORDER }} />
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
                  {filtered.filter(d => !d.pinned).map(d => (
                    <ResourceCard key={d.id} item={d} group={groupMap[d.groupId]} onView={() => setViewDoc(d)} onEdit={() => openEdit(d)} onDelete={() => handleDelete(d.id)} onPin={() => handlePin(d)} accentColor={ACCENT} borderColor={BORDER} mutedColor={MUTED} userEmail={user?.email} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* GROUP MANAGER */}
      {showGroupManager && (
        <GroupManager
          group={editingGroup}
          groups={groups}
          collectionName="library"
          onSave={handleSaveGroup}
          onDelete={handleDeleteGroup}
          onClose={() => { setShowGroupManager(false); setEditingGroup(null) }}
          accentColor={ACCENT}
        />
      )}

      {/* ADD MODAL */}
      {showAdd && (
        <Modal onClose={() => { setShowAdd(false); setFile(null); setProgress(0); setAddToGroupId(null) }} title="Add Document" accent={ACCENT}>
          <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input required placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={iStyle} />
            <GroupSelect
              value={form.groupId}
              onChange={v => setForm(f => ({ ...f, groupId: v }))}
              subValue={form.subGroupId}
              onSubChange={v => setForm(f => ({ ...f, subGroupId: v }))}
            />
            <input placeholder="Short description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={iStyle} />
            <textarea placeholder="Content (optional if uploading a file)" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={5} style={{ ...iStyle, resize: "vertical" }} />
            <TagInput tags={form.tags} onChange={tags => setForm(f => ({ ...f, tags }))} allTags={allTags} accentColor={ACCENT} />

            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? ACCENT : file ? "#22C55E" : BORDER}`,
                borderRadius: 10, padding: "20px 16px", textAlign: "center", cursor: "pointer",
                background: dragOver ? ACCENT + "10" : file ? "#F0FDF4" : BG, transition: "all 0.15s",
              }}
            >
              {file ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{fileIcon(file.type)}</span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{file.name}</div>
                    <div style={{ fontSize: 12, color: MUTED }}>{fmtSize(file.size)}</div>
                  </div>
                  <button type="button" onClick={e => { e.stopPropagation(); setFile(null) }} style={{ marginLeft: 8, background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 18, padding: 0 }}>×</button>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>📁</div>
                  <div style={{ fontSize: 13, color: MUTED }}>{dragOver ? "Drop to attach" : "Drag & drop a file, or click to browse"}</div>
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

      {/* VIEW MODAL */}
      {viewDoc && (
        <Modal onClose={() => setViewDoc(null)} title={viewDoc.title} accent={ACCENT} wide>
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {groupMap[viewDoc.groupId] && (
                <span style={{ background: groupMap[viewDoc.groupId].color + "22", color: groupMap[viewDoc.groupId].color, padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                  {groupMap[viewDoc.groupId].icon} {groupMap[viewDoc.groupId].name}
                </span>
              )}
              {viewDoc.pinned && <span style={{ fontSize: 12, color: "#F59E0B" }}>📌 Pinned</span>}
            </div>
            <div style={{ marginBottom: 12 }} onClick={e => e.stopPropagation()}>
              <TagInput tags={viewDoc.tags || []} onChange={tags => handleTagsChange(viewDoc.id, tags)} allTags={allTags} accentColor={ACCENT} />
            </div>
            {(viewDoc.createdAt || viewDoc.updatedAt) && (
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 12, display: "flex", gap: 16 }}>
                {viewDoc.createdAt && <span>Created {fmtDate(viewDoc.createdAt)}</span>}
                {viewDoc.updatedAt && <span>Updated {fmtDate(viewDoc.updatedAt)}</span>}
              </div>
            )}
            {viewDoc.summary ? (
              <div style={{ background: ACCENT + "0A", border: `1px solid ${ACCENT}22`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: MUTED, lineHeight: 1.5, fontStyle: "italic" }}>
                {viewDoc.summary}
              </div>
            ) : (
              <button onClick={() => generateSummary(viewDoc.id, viewDoc.title, viewDoc.description, viewDoc.fileName, viewDoc.fileType)} style={{ background: ACCENT + "12", color: ACCENT, border: `1px solid ${ACCENT}33`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, marginBottom: 16 }}>
                ✨ Generate AI Summary
              </button>
            )}
            <InlineNotes value={viewDoc.description || ""} onSave={text => handleNotesChange(viewDoc.id, text)} accentColor={ACCENT} mutedColor={MUTED} />
            <FilePreview fileUrl={viewDoc.fileUrl} fileType={viewDoc.fileType} fileName={viewDoc.fileName} />
            {viewDoc.fileUrl && (
              <a href={viewDoc.fileUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: ACCENT + "18", color: ACCENT, padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", marginBottom: 20 }}>
                {fileIcon(viewDoc.fileType)} {viewDoc.fileName || "Download attachment"} {viewDoc.fileSize ? `(${fmtSize(viewDoc.fileSize)})` : ""}
              </a>
            )}
            {viewDoc.content && (
              <div style={{ background: BG, padding: 20, borderRadius: 8, maxHeight: 400, overflowY: "auto" }}>
                <MarkdownRenderer content={viewDoc.content} accentColor={ACCENT} />
              </div>
            )}
            {!viewDoc.content && !viewDoc.fileUrl && <p style={{ color: MUTED, fontStyle: "italic" }}>No content.</p>}
            <CollapsibleMessages collectionName="library" docId={viewDoc.id} user={user} resourceTitle={viewDoc.title} accentColor={ACCENT} />
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => openEdit(viewDoc)} style={{ background: ACCENT + "18", color: ACCENT, border: `1px solid ${ACCENT}44`, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>✏️ Edit</button>
              <button onClick={() => handlePin(viewDoc)} style={{ background: viewDoc.pinned ? "#FEF3C7" : "#F9FAFB", color: viewDoc.pinned ? "#D97706" : MUTED, border: `1px solid ${viewDoc.pinned ? "#FDE68A" : BORDER}`, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 }}>
                {viewDoc.pinned ? "📌 Unpin" : "📌 Pin"}
              </button>
              <button onClick={() => handleDelete(viewDoc.id)} style={{ background: "#FEF2F2", color: "#EF4444", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 }}>🗑 Delete</button>
            </div>
          </div>
        </Modal>
      )}

      {/* EDIT MODAL */}
      {editDoc && (
        <Modal onClose={() => { setEditDoc(null); setEditFile(null) }} title="Edit Document" accent={ACCENT}>
          <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input required placeholder="Title" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} style={iStyle} />
            <GroupSelect
              value={editForm.groupId}
              onChange={v => setEditForm(f => ({ ...f, groupId: v }))}
              subValue={editForm.subGroupId}
              onSubChange={v => setEditForm(f => ({ ...f, subGroupId: v }))}
            />
            <input placeholder="Short description" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} style={iStyle} />
            <textarea placeholder="Content" value={editForm.content} onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))} rows={5} style={{ ...iStyle, resize: "vertical" }} />
            <TagInput tags={editForm.tags} onChange={tags => setEditForm(f => ({ ...f, tags }))} allTags={allTags} accentColor={ACCENT} />

            {editDoc.fileUrl && !editFile && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: BG, borderRadius: 8, border: `1px solid ${BORDER}` }}>
                <span style={{ fontSize: 18 }}>{fileIcon(editDoc.fileType)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{editDoc.fileName}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>{fmtSize(editDoc.fileSize)} — current file</div>
                </div>
                <button type="button" onClick={() => editFileRef.current?.click()} style={{ fontSize: 12, color: ACCENT, background: "none", border: `1px solid ${ACCENT}44`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Replace</button>
              </div>
            )}
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
            {!editDoc.fileUrl && !editFile && (
              <button type="button" onClick={() => editFileRef.current?.click()} style={{ padding: "10px", border: `2px dashed ${BORDER}`, borderRadius: 10, background: BG, color: MUTED, cursor: "pointer", fontSize: 13 }}>📁 Attach a file</button>
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

function Modal({ children, onClose, title, accent, wide }) {
  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 32, width: "100%", maxWidth: wide ? 700 : 520, maxHeight: "90vh", overflowY: "auto" }}>
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
