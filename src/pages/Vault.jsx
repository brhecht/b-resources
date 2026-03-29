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
import TagFilter from "../components/TagFilter"
import ViewSwitcher from "../components/ViewSwitcher"
import GroupKanban from "../components/GroupKanban"
import GroupManager from "../components/GroupManager"
import ListView from "../components/ListView"
import ResourceCard from "../components/ResourceCard"
import MarkdownRenderer from "../components/MarkdownRenderer"
import { getTagColor } from "../components/tagColors"

const ACCENT = "#A89078"
const BG = "#FAF7F4"
const CARD_BG = "#FFFFFF"
const TEXT = "#1A1A2E"
const MUTED = "#8A7A6E"
const BORDER = "#EDE8E2"

const DEFAULT_GROUPS = [
  { name: "Brand", color: "#A89078", icon: "🎨", order: 0 },
  { name: "Templates", color: "#7BA3A8", icon: "📐", order: 1 },
  { name: "Legal", color: "#8B8B8B", icon: "⚖️", order: 2 },
  { name: "Media", color: "#C47A9B", icon: "🖼️", order: 3 },
]

function displayTitle(item) {
  if (item.title) return item.title
  const name = item.name || "Untitled"
  if (/\.[a-z0-9]{1,5}$/i.test(name)) {
    return name.replace(/\.[a-z0-9]{1,5}$/i, "").replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase())
  }
  return name
}

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
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  const [viewAsset, setViewAsset] = useState(null)
  const [editAsset, setEditAsset] = useState(null)
  const [view, setView] = useState("group")
  const [activeTags, setActiveTags] = useState([])
  const [form, setForm] = useState({ name: "", description: "", tags: [], groupId: "", subGroupId: "" })
  const [editForm, setEditForm] = useState({ name: "", description: "", tags: [], groupId: "", subGroupId: "" })
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()
  const [showGroupManager, setShowGroupManager] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  const [addToGroupId, setAddToGroupId] = useState(null)

  const [editFile, setEditFile] = useState(null)
  const [editProgress, setEditProgress] = useState(0)
  const [editUploading, setEditUploading] = useState(false)
  const editFileRef = useRef()

  const allTags = useMemo(() => {
    const set = new Set()
    assets.forEach(a => (a.tags || []).forEach(t => set.add(t)))
    return [...set].sort()
  }, [assets])

  const groupMap = useMemo(() => {
    const m = {}
    groups.forEach(g => { m[g.id] = g })
    return m
  }, [groups])

  const topGroups = useMemo(() => groups.filter(g => !g.parentId), [groups])

  useEffect(() => { loadAssets(); loadGroups() }, [])

  async function loadAssets() {
    setLoading(true)
    try {
      const q = query(collection(db, "vault"), orderBy("createdAt", "desc"))
      const snap = await getDocs(q)
      setAssets(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) {
      console.error("Vault loadAssets error:", e)
      if (e?.code === "permission-denied") alert("Permission denied loading vault. Check Firestore rules.")
    }
    setLoading(false)
  }

  async function loadGroups() {
    try {
      const q = query(collection(db, "groups"), where("collection", "==", "vault"), orderBy("order", "asc"))
      const snap = await getDocs(q)
      let loaded = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      if (loaded.filter(g => !g.parentId).length === 0) {
        loaded = await seedDefaultGroups()
      }
      setGroups(loaded)
    } catch (e) {
      console.error("Load groups error:", e)
      try {
        const q2 = query(collection(db, "groups"), where("collection", "==", "vault"))
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
        collection: "vault",
        createdAt: serverTimestamp(),
      })
      created.push({ id: docRef.id, ...g, parentId: null, collection: "vault" })
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
      for (const sub of subs) { await deleteDoc(doc(db, "groups", sub.id)) }
      await deleteDoc(doc(db, "groups", groupId))
      const affected = assets.filter(a => a.groupId === groupId)
      for (const a of affected) {
        await updateDoc(doc(db, "vault", a.id), { groupId: null, subGroupId: null, updatedAt: serverTimestamp() })
      }
      setAssets(prev => prev.map(a => a.groupId === groupId ? { ...a, groupId: null, subGroupId: null } : a))
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
      await updateDoc(doc(db, "vault", itemId), updates)
      setAssets(prev => prev.map(a => a.id === itemId ? { ...a, ...updates } : a))
    } catch (e) {
      console.error("Group change error:", e)
    }
  }

  async function handlePin(item) {
    const newPinned = !item.pinned
    try {
      await updateDoc(doc(db, "vault", item.id), { pinned: newPinned, updatedAt: serverTimestamp() })
      setAssets(prev => prev.map(a => a.id === item.id ? { ...a, pinned: newPinned } : a))
    } catch (e) {
      console.error("Pin error:", e)
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
        await updateDoc(doc(db, "vault", docId), { summary })
        setAssets(prev => prev.map(a => a.id === docId ? { ...a, summary } : a))
      }
    } catch (e) { console.error("Summary generation failed:", e) }
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
        task.on("state_changed", snap => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)), reject, resolve)
      })
      const fileUrl = await getDownloadURL(storageRef)
      const newAsset = {
        title: form.name || "",
        name: form.name || file.name,
        description: form.description,
        tags: form.tags,
        groupId: form.groupId || null,
        subGroupId: form.subGroupId || null,
        pinned: false,
        category: groupMap[form.groupId]?.name || "",
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
      setAssets(prev => [{ id: docRef.id, ...newAsset, createdAt: new Date() }, ...prev])
      generateSummary(docRef.id, form.name || file.name, form.description, file.name, file.type)
      setForm({ name: "", description: "", tags: [], groupId: "", subGroupId: "" })
      setFile(null)
      if (fileRef.current) fileRef.current.value = ""
      setShowAdd(false)
      setAddToGroupId(null)
      setProgress(0)
      loadAssets().catch(() => {})
    } catch (e) {
      console.error("Vault upload error:", e)
      alert("Upload failed: " + (e?.message || e?.code || "Unknown error"))
    }
    setUploading(false)
    setSaving(false)
  }

  function openEdit(asset) {
    setEditAsset(asset)
    setEditForm({
      name: asset.name || "",
      description: asset.description || "",
      tags: asset.tags || [],
      groupId: asset.groupId || "",
      subGroupId: asset.subGroupId || "",
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
        title: editForm.name,
        name: editForm.name,
        description: editForm.description,
        tags: editForm.tags,
        groupId: editForm.groupId || null,
        subGroupId: editForm.subGroupId || null,
        category: groupMap[editForm.groupId]?.name || editAsset.category || "",
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
          task.on("state_changed", snap => setEditProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)), reject, resolve)
        })
        updates.fileUrl = await getDownloadURL(storageRef)
        updates.fileName = editFile.name
        updates.fileSize = editFile.size
        updates.fileType = editFile.type
        updates.storagePath = storagePath
        setEditUploading(false)
      }

      await updateDoc(doc(db, "vault", editAsset.id), updates)
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
      if (asset.storagePath) await deleteObject(ref(storage, asset.storagePath))
      await deleteDoc(doc(db, "vault", asset.id))
      setAssets(prev => prev.filter(a => a.id !== asset.id))
      if (viewAsset?.id === asset.id) setViewAsset(null)
      if (editAsset?.id === asset.id) setEditAsset(null)
    } catch (e) { console.error(e) }
  }

  const filtered = assets.filter(a => {
    const matchSearch = !search ||
      a.name?.toLowerCase().includes(search.toLowerCase()) ||
      a.description?.toLowerCase().includes(search.toLowerCase()) ||
      a.fileName?.toLowerCase().includes(search.toLowerCase()) ||
      (a.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()))
    const matchTags = activeTags.length === 0 || activeTags.some(t => (a.tags || []).includes(t))
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
            <span style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>Vault</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ViewSwitcher view={view} onSwitch={setView} accentColor={ACCENT} />
            <button onClick={() => { setShowGroupManager(true); setEditingGroup(null) }} style={{ background: ACCENT + "18", color: ACCENT, border: `1px solid ${ACCENT}44`, borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              Manage Groups
            </button>
            <button onClick={() => { setShowAdd(true); setAddToGroupId(null) }} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
              + Upload Asset
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px" }}>
        <input type="text" placeholder="Search assets..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: "100%", padding: "10px 16px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 14, background: CARD_BG, boxSizing: "border-box", marginBottom: 20, outline: "none" }} />

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
        ) : view === "group" ? (
          <GroupKanban
            items={filtered}
            groups={groups}
            onGroupChange={handleGroupChange}
            onView={item => setViewAsset(item)}
            onEdit={item => openEdit(item)}
            onDelete={item => handleDelete(item)}
            onPin={item => handlePin(item)}
            onAddToGroup={groupId => { setAddToGroupId(groupId); setForm(f => ({ ...f, groupId })); setShowAdd(true) }}
            onEditGroup={group => {
              if (group._delete) { handleDeleteGroup(group.id) } else { setEditingGroup(group); setShowGroupManager(true) }
            }}
            onAddGroup={() => { setEditingGroup(null); setShowGroupManager(true) }}
            onAddSubGroup={parentId => { setEditingGroup({ parentId }); setShowGroupManager(true) }}
            accentColor={ACCENT}
            borderColor={BORDER}
            mutedColor={MUTED}
            userEmail={user?.email}
          />
        ) : view === "list" ? (
          <ListView
            items={filtered}
            groups={groups}
            onView={item => setViewAsset(item)}
            onEdit={item => openEdit(item)}
            onDelete={item => handleDelete(item)}
            onPin={item => handlePin(item)}
            accentColor={ACCENT}
            borderColor={BORDER}
            mutedColor={MUTED}
            userEmail={user?.email}
          />
        ) : (
          <div>
            {filtered.some(a => a.pinned) && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#F59E0B" }}>★ Pinned</span>
                  <div style={{ flex: 1, height: 1, background: BORDER }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18, marginBottom: 24 }}>
                  {filtered.filter(a => a.pinned).map(a => (
                    <ResourceCard key={a.id} item={a} group={groupMap[a.groupId]} onView={() => setViewAsset(a)} onEdit={() => openEdit(a)} onDelete={() => handleDelete(a)} onPin={() => handlePin(a)} accentColor={ACCENT} borderColor={BORDER} mutedColor={MUTED} userEmail={user?.email} />
                  ))}
                </div>
              </>
            )}
            {filtered.some(a => !a.pinned) && (
              <>
                {filtered.some(a => a.pinned) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: MUTED }}>All</span>
                    <div style={{ flex: 1, height: 1, background: BORDER }} />
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
                  {filtered.filter(a => !a.pinned).map(a => (
                    <ResourceCard key={a.id} item={a} group={groupMap[a.groupId]} onView={() => setViewAsset(a)} onEdit={() => openEdit(a)} onDelete={() => handleDelete(a)} onPin={() => handlePin(a)} accentColor={ACCENT} borderColor={BORDER} mutedColor={MUTED} userEmail={user?.email} />
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
          collectionName="vault"
          onSave={handleSaveGroup}
          onDelete={handleDeleteGroup}
          onClose={() => { setShowGroupManager(false); setEditingGroup(null) }}
          accentColor={ACCENT}
        />
      )}

      {/* ADD MODAL */}
      {showAdd && (
        <Modal onClose={() => { setShowAdd(false); setFile(null); if (fileRef.current) fileRef.current.value = ""; setAddToGroupId(null) }} title="Upload Asset" accent={ACCENT}>
          <form onSubmit={handleUpload} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input ref={fileRef} type="file" onChange={e => setFile(e.target.files[0])} style={{ display: "none" }} />
            <div
              onClick={() => !uploading && fileRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              style={{
                border: `2px dashed ${dragOver ? ACCENT : file ? ACCENT : BORDER}`,
                borderRadius: 12, padding: "28px 20px", textAlign: "center",
                cursor: uploading ? "not-allowed" : "pointer",
                background: dragOver ? ACCENT + "0D" : file ? ACCENT + "0A" : BG,
                transition: "all 0.15s", userSelect: "none",
              }}
            >
              {file ? (
                <>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>{fileIcon(file.type)}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 4, wordBreak: "break-word" }}>{file.name}</div>
                  <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>{fmtSize(file.size)}</div>
                  <button type="button" onClick={e => { e.stopPropagation(); setFile(null); if (fileRef.current) fileRef.current.value = "" }}
                    style={{ fontSize: 12, color: MUTED, background: "none", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "4px 12px", cursor: "pointer" }}>Change file</button>
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
            <GroupSelect
              value={form.groupId}
              onChange={v => setForm(f => ({ ...f, groupId: v }))}
              subValue={form.subGroupId}
              onSubChange={v => setForm(f => ({ ...f, subGroupId: v }))}
            />
            <input placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={iStyle} />
            <TagInput tags={form.tags} onChange={tags => setForm(f => ({ ...f, tags }))} allTags={allTags} accentColor={ACCENT} />

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

      {/* VIEW MODAL */}
      {viewAsset && (
        <Modal onClose={() => setViewAsset(null)} title={displayTitle(viewAsset)} accent={ACCENT} wide>
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              {groupMap[viewAsset.groupId] && (
                <span style={{ background: groupMap[viewAsset.groupId].color + "22", color: groupMap[viewAsset.groupId].color, padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                  {groupMap[viewAsset.groupId].icon} {groupMap[viewAsset.groupId].name}
                </span>
              )}
              {viewAsset.fileSize ? <span style={{ fontSize: 12, color: MUTED }}>{fmtSize(viewAsset.fileSize)}</span> : null}
              {(viewAsset.tags || []).map(t => { const tc = getTagColor(t); return <span key={t} style={{ background: tc.bg, color: tc.text, padding: "2px 10px", borderRadius: 12, fontSize: 12 }}>{t}</span> })}
              {viewAsset.pinned && <span style={{ fontSize: 12, color: "#F59E0B" }}>★ Pinned</span>}
            </div>
            {viewAsset.fileName && viewAsset.fileName !== (viewAsset.title || viewAsset.name) && (
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 8, opacity: 0.7 }}>
                File: {viewAsset.fileName}
              </div>
            )}
            {(viewAsset.createdAt || viewAsset.updatedAt) && (
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 12, display: "flex", gap: 16 }}>
                {viewAsset.createdAt && <span>Created {fmtDate(viewAsset.createdAt)}</span>}
                {viewAsset.updatedAt && <span>Updated {fmtDate(viewAsset.updatedAt)}</span>}
              </div>
            )}
            {viewAsset.summary ? (
              <div style={{ background: ACCENT + "0A", border: `1px solid ${ACCENT}22`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: MUTED, lineHeight: 1.5, fontStyle: "italic" }}>
                {viewAsset.summary}
              </div>
            ) : (
              <button onClick={() => generateSummary(viewAsset.id, viewAsset.title || viewAsset.name, viewAsset.description, viewAsset.fileName, viewAsset.fileType)} style={{ background: ACCENT + "12", color: ACCENT, border: `1px solid ${ACCENT}33`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, marginBottom: 16 }}>
                ✨ Generate AI Summary
              </button>
            )}
            {viewAsset.description && (
              <div style={{ marginBottom: 20 }}>
                <MarkdownRenderer content={viewAsset.description} accentColor={ACCENT} />
              </div>
            )}
            <FilePreview fileUrl={viewAsset.fileUrl} fileType={viewAsset.fileType} fileName={viewAsset.fileName} />
            {viewAsset.fileUrl && (
              <a href={viewAsset.fileUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: ACCENT + "18", color: ACCENT, padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", marginBottom: 20 }}>
                {fileIcon(viewAsset.fileType)} Download {viewAsset.fileName || "file"}
              </a>
            )}
            <CollapsibleMessages collectionName="vault" docId={viewAsset.id} user={user} resourceTitle={displayTitle(viewAsset)} accentColor={ACCENT} />
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => openEdit(viewAsset)} style={{ background: ACCENT + "18", color: ACCENT, border: `1px solid ${ACCENT}44`, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>✏️ Edit</button>
              <button onClick={() => handlePin(viewAsset)} style={{ background: viewAsset.pinned ? "#FEF3C7" : "#F9FAFB", color: viewAsset.pinned ? "#D97706" : MUTED, border: `1px solid ${viewAsset.pinned ? "#FDE68A" : BORDER}`, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 }}>
                {viewAsset.pinned ? "★ Unpin" : "☆ Pin"}
              </button>
              <button onClick={() => handleDelete(viewAsset)} style={{ background: "#FEF2F2", color: "#EF4444", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 }}>🗑 Delete</button>
            </div>
          </div>
        </Modal>
      )}

      {/* EDIT MODAL */}
      {editAsset && (
        <Modal onClose={() => { setEditAsset(null); setEditFile(null) }} title="Edit Asset" accent={ACCENT}>
          <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input required placeholder="Name" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} style={iStyle} />
            <GroupSelect
              value={editForm.groupId}
              onChange={v => setEditForm(f => ({ ...f, groupId: v }))}
              subValue={editForm.subGroupId}
              onSubChange={v => setEditForm(f => ({ ...f, subGroupId: v }))}
            />
            <input placeholder="Description" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} style={iStyle} />
            <TagInput tags={editForm.tags} onChange={tags => setEditForm(f => ({ ...f, tags }))} allTags={allTags} accentColor={ACCENT} />

            {editAsset.fileUrl && !editFile && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: BG, borderRadius: 8, border: `1px solid ${BORDER}` }}>
                <span style={{ fontSize: 18 }}>{fileIcon(editAsset.fileType)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{editAsset.fileName}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>{fmtSize(editAsset.fileSize)} — current file</div>
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

const iStyle = { width: "100%", padding: "9px 12px", border: "1px solid #EDE8E2", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }
