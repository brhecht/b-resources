import { useMemo, useState } from "react"

const TYPE_ICONS = {
  youtube: "🎬",
  linkedin: "💼",
  twitter: "🐦",
  github: "🐙",
  blog: "📝",
  podcast: "🎙",
  webpage: "🌐",
  file: "📎",
  text: "📝",
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
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function itemTitle(item) {
  return item.title || item.name || item.url || item.fileName || "Untitled"
}

function itemUrl(item) {
  return item.url || item.fileUrl || item.sourceUrl || (item.urls?.[0] ?? "")
}

/**
 * Inbox panel for the top of each section page (Library / Vault / References).
 * Surfaces ungrouped items from the section so the user can tag them and
 * assign a group from within the same section.
 *
 * Props:
 *   items: array of section docs (panel filters to !groupId internally)
 *   groups: array of {id, name, parentId} group docs
 *   accent / borderColor / mutedColor: section theme
 *   onAssignGroup(itemId, groupId, subGroupId): persist group assignment
 *   onTagsChange(itemId, tags): persist tag list
 */
export default function InboxPanel({
  items,
  groups = [],
  accent = "#7B8FA8",
  borderColor = "#E2E8F0",
  mutedColor = "#6B7A99",
  onAssignGroup,
  onTagsChange,
}) {
  const [expanded, setExpanded] = useState(true)
  const [tagDrafts, setTagDrafts] = useState({})

  const ungrouped = useMemo(() => {
    const list = (items || []).filter((i) => !i.groupId)
    list.sort((a, b) => {
      const am = a.createdAt?.toMillis?.() || 0
      const bm = b.createdAt?.toMillis?.() || 0
      return bm - am
    })
    return list
  }, [items])

  const topGroups = useMemo(() => groups.filter((g) => !g.parentId), [groups])
  const subGroupsFor = (parentId) => groups.filter((g) => g.parentId === parentId)

  if (ungrouped.length === 0) return null

  function setDraft(id, val) {
    setTagDrafts((prev) => ({ ...prev, [id]: val }))
  }

  function commitTag(item) {
    const raw = (tagDrafts[item.id] || "").trim().replace(/,$/, "")
    if (!raw) return
    const next = Array.from(
      new Set([...(item.tags || []), ...raw.split(",").map((t) => t.trim()).filter(Boolean)])
    )
    onTagsChange?.(item.id, next)
    setDraft(item.id, "")
  }

  function removeTag(item, tag) {
    onTagsChange?.(item.id, (item.tags || []).filter((t) => t !== tag))
  }

  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${accent}33`,
        borderRadius: 12,
        marginBottom: 20,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          width: "100%",
          background: accent + "10",
          border: "none",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 18 }}>📥</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: accent }}>Inbox</span>
        <span
          style={{
            background: accent,
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            padding: "2px 9px",
            borderRadius: 12,
          }}
        >
          {ungrouped.length}
        </span>
        <span style={{ fontSize: 12, color: mutedColor }}>
          ungrouped — assign a group to file them
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: mutedColor }}>{expanded ? "▲" : "▼"}</span>
      </button>

      {/* Items */}
      {expanded && (
        <div style={{ padding: "8px 12px 12px" }}>
          {ungrouped.map((item) => {
            const url = itemUrl(item)
            const icon = TYPE_ICONS[item.contentType] || (item.fileUrl ? "📎" : "🌐")
            return (
              <div
                key={item.id}
                style={{
                  border: `1px solid ${borderColor}`,
                  borderRadius: 10,
                  padding: "10px 14px",
                  marginTop: 8,
                  background: "#fff",
                }}
              >
                {/* Top row: icon + title + time */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#1A1A2E",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {itemTitle(item)}
                    </div>
                    {(url || item.description) && (
                      <div
                        style={{
                          fontSize: 12,
                          color: mutedColor,
                          marginTop: 2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {url || item.description?.slice(0, 100)}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: "#94A3B8", flexShrink: 0 }}>
                    {timeAgo(item.createdAt)}
                  </span>
                </div>

                {/* Bottom row: tags + assign group + open */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {/* Tags */}
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                    {(item.tags || []).map((t) => (
                      <span
                        key={t}
                        onClick={() => removeTag(item, t)}
                        title="Click to remove"
                        style={{
                          background: accent + "14",
                          color: accent,
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 10,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        {t}
                        <span style={{ opacity: 0.5 }}>×</span>
                      </span>
                    ))}
                    <input
                      type="text"
                      placeholder="+ tag"
                      value={tagDrafts[item.id] || ""}
                      onChange={(e) => setDraft(item.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault()
                          commitTag(item)
                        }
                      }}
                      onBlur={() => commitTag(item)}
                      style={{
                        border: `1px solid ${borderColor}`,
                        borderRadius: 10,
                        padding: "2px 8px",
                        fontSize: 11,
                        outline: "none",
                        background: "#fff",
                        width: 70,
                      }}
                    />
                  </div>

                  <div style={{ flex: 1 }} />

                  {/* Assign to group */}
                  <select
                    value=""
                    onChange={(e) => {
                      const val = e.target.value
                      if (!val) return
                      const [gid, sgid = ""] = val.split("::")
                      onAssignGroup?.(item.id, gid, sgid)
                    }}
                    style={{
                      border: `1px solid ${accent}66`,
                      background: accent + "10",
                      color: accent,
                      borderRadius: 8,
                      padding: "5px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    <option value="">Assign to group…</option>
                    {topGroups.map((g) => {
                      const subs = subGroupsFor(g.id)
                      return (
                        <optgroup key={g.id} label={g.name}>
                          <option value={`${g.id}::`}>{g.name} (no subgroup)</option>
                          {subs.map((s) => (
                            <option key={s.id} value={`${g.id}::${s.id}`}>
                              ↳ {s.name}
                            </option>
                          ))}
                        </optgroup>
                      )
                    })}
                  </select>

                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: "#F1F5F9",
                        color: "#475569",
                        border: `1px solid ${borderColor}`,
                        borderRadius: 8,
                        padding: "5px 10px",
                        fontSize: 12,
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      ↗ Open
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
