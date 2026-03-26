import { useState, useEffect } from "react"

const PRESET_COLORS = [
  "#7B8FA8", "#6BA37E", "#E8913A", "#9B8EC4", "#E57373",
  "#A89078", "#7BA3A8", "#8B8B8B", "#C47A9B", "#3B82F6",
  "#F59E0B", "#10B981",
]

const PRESET_ICONS = ["📁", "🧩", "📗", "📋", "📚", "📄", "🎨", "📐", "⚖️", "🖼️", "🔧", "💡", "🎯", "📊", "🗂️", "📝"]

export default function GroupManager({ group, groups, collectionName, onSave, onDelete, onClose, accentColor = "#7B8FA8" }) {
  const [name, setName] = useState("")
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [icon, setIcon] = useState("📁")
  const [parentId, setParentId] = useState(null)
  const [customColor, setCustomColor] = useState("")

  useEffect(() => {
    if (group) {
      setName(group.name || "")
      setColor(group.color || PRESET_COLORS[0])
      setIcon(group.icon || "📁")
      setParentId(group.parentId || null)
      setCustomColor("")
    }
  }, [group])

  const topLevelGroups = (groups || []).filter(g => !g.parentId && (!group || g.id !== group?.id))

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      color,
      icon,
      parentId: parentId || null,
      collection: collectionName,
    })
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 32, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{group?.id ? "Edit Group" : "New Group"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#94A3B8" }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6, display: "block" }}>Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Group name"
              required
              style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6, display: "block" }}>Color</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setColor(c); setCustomColor("") }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: c,
                    border: color === c ? "3px solid #1A1A2E" : "2px solid transparent",
                    cursor: "pointer",
                    transition: "all 0.1s",
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                value={customColor}
                onChange={e => {
                  setCustomColor(e.target.value)
                  if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) setColor(e.target.value)
                }}
                placeholder="#custom hex"
                style={{ flex: 1, padding: "6px 10px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 13, outline: "none", fontFamily: "monospace" }}
              />
              <div style={{ width: 28, height: 28, borderRadius: 6, background: color, border: "1px solid #E2E8F0", flexShrink: 0 }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6, display: "block" }}>Icon</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PRESET_ICONS.map(ic => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: icon === ic ? accentColor + "22" : "#F9FAFB",
                    border: icon === ic ? `2px solid ${accentColor}` : "1px solid #E2E8F0",
                    cursor: "pointer",
                    fontSize: 18,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {topLevelGroups.length > 0 && (
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6, display: "block" }}>Parent Group (optional — makes this a sub-group)</label>
              <select
                value={parentId || ""}
                onChange={e => setParentId(e.target.value || null)}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
              >
                <option value="">None (top-level group)</option>
                {topLevelGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.icon} {g.name}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button type="submit" style={{ flex: 1, background: accentColor, color: "#fff", border: "none", borderRadius: 8, padding: "10px", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
              {group?.id ? "Save Changes" : "Create Group"}
            </button>
            {group?.id && onDelete && (
              <button type="button" onClick={() => onDelete(group.id)} style={{ background: "#FEF2F2", color: "#EF4444", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                Delete
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
