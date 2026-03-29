import { useState } from "react"
import { getTagColor } from "./tagColors"
import TagInput from "./TagInput"

function displayTitle(item) {
  if (item.title) return item.title
  const name = item.name || "Untitled"
  // If name looks like a filename, clean it up for display
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

export default function GroupKanban({
  items = [],
  groups = [],
  onGroupChange,
  onSubGroupChange,
  onView,
  onPreview,
  onEdit,
  onDelete,
  onPin,
  onAddToGroup,
  onEditGroup,
  onAddGroup,
  onAddSubGroup,
  onTagsChange,
  allTags = [],
  accentColor = "#7B8FA8",
  borderColor = "#E2E8F0",
  mutedColor = "#6B7A99",
  userEmail,
}) {
  const [dragOverCol, setDragOverCol] = useState(null)
  const [dragOverSub, setDragOverSub] = useState(null)
  const [collapsedSubs, setCollapsedSubs] = useState({})
  const [menuOpen, setMenuOpen] = useState(null)
  const [hoveredCard, setHoveredCard] = useState(null)
  const [editingTagsId, setEditingTagsId] = useState(null)

  const topGroups = groups.filter(g => !g.parentId).sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
  const subGroupsByParent = {}
  groups.filter(g => g.parentId).forEach(g => {
    if (!subGroupsByParent[g.parentId]) subGroupsByParent[g.parentId] = []
    subGroupsByParent[g.parentId].push(g)
  })
  Object.values(subGroupsByParent).forEach(arr => arr.sort((a, b) => (a.order ?? 99) - (b.order ?? 99)))

  function getGroupItems(groupId) {
    return items.filter(i => i.groupId === groupId)
  }

  function getUngroupedItems() {
    return items.filter(i => !i.groupId)
  }

  function handleDragStart(e, item) {
    e.dataTransfer.setData("application/json", JSON.stringify({ id: item.id, type: "item" }))
    e.dataTransfer.effectAllowed = "move"
  }

  function handleDragOver(e, colId, subId) {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverCol(colId)
    if (subId) setDragOverSub(subId)
  }

  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverCol(null)
      setDragOverSub(null)
    }
  }

  async function handleDrop(e, groupId, subGroupId) {
    e.preventDefault()
    e.stopPropagation()
    setDragOverCol(null)
    setDragOverSub(null)
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"))
      if (data.type === "item") {
        await onGroupChange(data.id, groupId, subGroupId || null)
      }
    } catch (_) {}
  }

  function toggleSub(subId) {
    setCollapsedSubs(prev => ({ ...prev, [subId]: !prev[subId] }))
  }

  function sortPinnedFirst(arr) {
    return [...arr].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return 0
    })
  }

  function renderItemCard(item) {
    const title = displayTitle(item)
    const tags = item.tags || []
    const rawName = item.title || item.name || "Untitled"
    const hasFileName = item.fileName && item.fileName !== rawName
    const meta = item._msgMeta
    const ek = userEmail ? userEmail.replace(/\./g, "_") : ""
    const hasUnread = meta?.lastAt && ek && !meta.readBy?.[ek]

    return (
      <div
        key={item.id}
        draggable="true"
        onDragStart={e => handleDragStart(e, item)}
        onClick={() => onView(item)}
        style={{
          background: "#fff",
          border: `1px solid ${borderColor}`,
          borderRadius: 10,
          padding: "10px 12px",
          cursor: "grab",
          marginBottom: 6,
          transition: "box-shadow 0.1s",
          position: "relative",
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"; if (item.summary) setHoveredCard(item.id) }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; setHoveredCard(null) }}
      >
        {hoveredCard === item.id && item.summary && (
          <div style={{ position: "absolute", bottom: "100%", left: 0, right: 0, marginBottom: 6, background: "#1A1A2E", color: "#fff", fontSize: 11, lineHeight: 1.4, padding: "8px 10px", borderRadius: 8, zIndex: 50, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", pointerEvents: "none" }}>
            {item.summary}
          </div>
        )}
        {hasUnread && (
          <div style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: "50%", background: "#2563EB", boxShadow: "0 0 0 2px #fff", zIndex: 2 }} />
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>{fileIcon(item.fileType)}</span>
              <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
            </div>
            {hasFileName && (
              <div style={{ fontSize: 10, color: mutedColor, opacity: 0.7, marginTop: 1, marginLeft: 20, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.fileName}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }} onClick={e => e.stopPropagation()}>
            {onPin && (
              <button onClick={() => onPin(item)} title={item.pinned ? "Unpin" : "Pin"} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, padding: 0, opacity: item.pinned ? 1 : 0.3 }}>{item.pinned ? "📌" : "📌"}</button>
            )}
            {onPreview && item.fileUrl && (
              <button onClick={() => onPreview(item)} title="Preview" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, padding: "0 2px", opacity: 0.5 }}>👁</button>
            )}
            {item.fileUrl && (
              <a href={item.fileUrl} download={item.fileName || true} onClick={e => e.stopPropagation()} title="Download" style={{ fontSize: 12, textDecoration: "none", opacity: 0.4, lineHeight: 1, padding: "0 2px" }}>⬇</a>
            )}
          </div>
        </div>
        {item.description && (
          <p style={{ fontSize: 11, color: mutedColor, margin: "0 0 4px", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {item.description}
          </p>
        )}
        {editingTagsId === item.id && onTagsChange ? (
          <div onClick={e => e.stopPropagation()} style={{ marginTop: 4 }}>
            <TagInput tags={tags} onChange={newTags => onTagsChange(item, newTags)} allTags={allTags} accentColor={accentColor} />
            <button onClick={() => setEditingTagsId(null)} style={{ background: accentColor + "12", border: "none", fontSize: 10, color: accentColor, cursor: "pointer", marginTop: 4, padding: "2px 8px", borderRadius: 6 }}>Done</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center", marginTop: tags.length > 0 ? 0 : 2 }}>
            {tags.map(t => {
              const tc = getTagColor(t)
              return <span key={t} style={{ background: tc.bg, color: tc.text, fontSize: 10, padding: "2px 7px", borderRadius: 8 }}>{t}</span>
            })}
            {onTagsChange && (
              <button onClick={e => { e.stopPropagation(); setEditingTagsId(item.id) }} style={{ background: accentColor + "10", border: `1px solid ${accentColor}30`, borderRadius: 8, fontSize: 10, color: accentColor, cursor: "pointer", padding: "2px 8px", lineHeight: "14px", fontWeight: 500 }}>{tags.length > 0 ? "+" : "+ tag"}</button>
            )}
          </div>
        )}
        {(item.updatedAt || item.createdAt) && (
          <div style={{ fontSize: 9, color: mutedColor, marginTop: 4, opacity: 0.6 }}>
            {(() => { const ts = item.updatedAt || item.createdAt; const d = ts?.toDate ? ts.toDate() : new Date(ts); const diff = Date.now() - d.getTime(); const mins = Math.floor(diff / 60000); if (mins < 60) return `${mins}m ago`; const hrs = Math.floor(mins / 60); if (hrs < 24) return `${hrs}h ago`; const days = Math.floor(hrs / 24); if (days < 7) return `${days}d ago`; return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); })()}
          </div>
        )}
      </div>
    )
  }

  function renderColumn(group) {
    const groupItems = getGroupItems(group.id)
    const subs = subGroupsByParent[group.id] || []
    const subIds = new Set(subs.map(s => s.id))
    const ungroupedInCol = groupItems.filter(i => !i.subGroupId || !subIds.has(i.subGroupId))
    const isOver = dragOverCol === group.id && !dragOverSub
    const colItems = groupItems.length

    return (
      <div
        key={group.id}
        onDragOver={e => handleDragOver(e, group.id, null)}
        onDragLeave={handleDragLeave}
        onDrop={e => handleDrop(e, group.id, null)}
        style={{
          width: "100%",
          background: isOver ? `${group.color}11` : "#F9FAFB",
          borderRadius: 12,
          border: isOver ? `2px dashed ${group.color}` : "2px solid transparent",
          display: "flex",
          flexDirection: "column",
          transition: "all 0.15s",
        }}
      >
        {/* Column header */}
        <div style={{ padding: "12px 12px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
            <div style={{ width: 4, height: 20, borderRadius: 2, background: group.color, flexShrink: 0 }} />
            <span style={{ fontSize: 16 }}>{group.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1A2E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.name}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", background: "#E5E7EB", borderRadius: 9999, padding: "1px 7px", flexShrink: 0 }}>{colItems}</span>
          </div>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <button onClick={() => onAddToGroup(group.id)} title="Add item" style={{ background: "none", border: "none", color: group.color, cursor: "pointer", fontSize: 18, padding: 0, lineHeight: 1 }}>+</button>
            <div style={{ position: "relative" }}>
              <button onClick={() => setMenuOpen(menuOpen === group.id ? null : group.id)} style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: 16, padding: "0 2px" }}>⋯</button>
              {menuOpen === group.id && (
                <div style={{ position: "absolute", right: 0, top: 24, background: "#fff", border: `1px solid ${borderColor}`, borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 100, minWidth: 160, padding: 4 }}>
                  <button onClick={() => { setMenuOpen(null); onEditGroup(group) }} style={menuItemStyle}>Rename / Edit</button>
                  <button onClick={() => { setMenuOpen(null); onAddSubGroup(group.id) }} style={menuItemStyle}>Add Sub-group</button>
                  <button onClick={() => { setMenuOpen(null); onEditGroup({ ...group, _delete: true }) }} style={{ ...menuItemStyle, color: "#EF4444" }}>Delete Group</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Column body */}
        <div style={{ flex: 1, padding: "0 12px 12px", minHeight: 60 }}>
          {/* Sub-groups */}
          {subs.map(sub => {
            const subItems = groupItems.filter(i => i.subGroupId === sub.id)
            const collapsed = collapsedSubs[sub.id]
            const isSubOver = dragOverSub === sub.id

            return (
              <div
                key={sub.id}
                onDragOver={e => { e.stopPropagation(); handleDragOver(e, group.id, sub.id) }}
                onDrop={e => handleDrop(e, group.id, sub.id)}
                style={{
                  marginBottom: 8,
                  background: isSubOver ? `${sub.color}11` : "transparent",
                  borderRadius: 8,
                  border: isSubOver ? `1px dashed ${sub.color}` : "1px solid transparent",
                  transition: "all 0.1s",
                }}
              >
                <div
                  onClick={() => toggleSub(sub.id)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", cursor: "pointer", userSelect: "none", borderRadius: 6 }}
                  onMouseEnter={e => e.currentTarget.style.background = "#F0F0F0"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <span style={{ fontSize: 10, color: "#9CA3AF", transition: "transform 0.15s", transform: collapsed ? "rotate(0deg)" : "rotate(90deg)" }}>▶</span>
                  <span style={{ fontSize: 12 }}>{sub.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: sub.color }}>{sub.name}</span>
                  <span style={{ fontSize: 10, color: "#9CA3AF" }}>({subItems.length})</span>
                </div>
                {!collapsed && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8, padding: "4px 8px 8px" }}>
                    {sortPinnedFirst(subItems).map(item => renderItemCard(item))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Ungrouped items in this column */}
          {ungroupedInCol.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
              {sortPinnedFirst(ungroupedInCol).map(item => renderItemCard(item))}
            </div>
          )}

          {colItems === 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, minHeight: 60, color: "#9CA3AF", fontSize: 12, fontStyle: "italic" }}>
              Drop items here
            </div>
          )}
        </div>
      </div>
    )
  }

  const ungrouped = getUngroupedItems()

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 16 }}>
      {/* Ungrouped column */}
      {ungrouped.length > 0 && (
        <div
          onDragOver={e => handleDragOver(e, "__ungrouped", null)}
          onDragLeave={handleDragLeave}
          onDrop={e => handleDrop(e, null, null)}
          style={{
            width: "100%",
            background: dragOverCol === "__ungrouped" ? "#F3F4F611" : "#F9FAFB",
            borderRadius: 12,
            border: dragOverCol === "__ungrouped" ? "2px dashed #9CA3AF" : "2px solid transparent",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ padding: "12px 12px 8px", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 4, height: 20, borderRadius: 2, background: "#9CA3AF" }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#6B7280" }}>Ungrouped</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", background: "#E5E7EB", borderRadius: 9999, padding: "1px 7px" }}>{ungrouped.length}</span>
          </div>
          <div style={{ flex: 1, padding: "0 12px 12px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
            {sortPinnedFirst(ungrouped).map(item => renderItemCard(item))}
          </div>
          </div>
        </div>
      )}

      {/* Group columns */}
      {topGroups.map(group => renderColumn(group))}

      {/* Add new group button */}
      <div
        onClick={onAddGroup}
        style={{
          width: "100%",
          background: "#F9FAFB",
          borderRadius: 12,
          border: `2px dashed ${borderColor}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "#9CA3AF",
          fontSize: 14,
          fontWeight: 600,
          transition: "all 0.15s",
          padding: "16px 0",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.color = accentColor }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = borderColor; e.currentTarget.style.color = "#9CA3AF" }}
      >
        + New Group
      </div>
    </div>
  )
}

const menuItemStyle = {
  display: "block",
  width: "100%",
  padding: "8px 12px",
  background: "none",
  border: "none",
  textAlign: "left",
  fontSize: 13,
  cursor: "pointer",
  borderRadius: 4,
  color: "#374151",
}
