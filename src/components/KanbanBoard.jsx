import { useState } from "react"

const COLUMNS = [
  { key: "Inbox", label: "Inbox" },
  { key: "Active", label: "Active" },
  { key: "Archive", label: "Archive" },
]

export default function KanbanBoard({ items = [], onStatusChange, renderCard, accentColor = "#2563EB" }) {
  const [dragOverCol, setDragOverCol] = useState(null)
  const [pendingMoves, setPendingMoves] = useState({})

  function getColumnItems(status) {
    return items
      .filter(item => {
        const itemStatus = pendingMoves[item.id] || item.status || "Active"
        return itemStatus === status
      })
      .sort((a, b) => (a.priority || 0) - (b.priority || 0))
  }

  function handleDragStart(e, item) {
    e.dataTransfer.setData("text/plain", item.id)
    e.dataTransfer.effectAllowed = "move"
  }

  function handleDragOver(e, colKey) {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverCol(colKey)
  }

  function handleDragLeave(e, colKey) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverCol(null)
    }
  }

  async function handleDrop(e, newStatus) {
    e.preventDefault()
    setDragOverCol(null)
    const itemId = e.dataTransfer.getData("text/plain")
    const item = items.find(i => i.id === itemId)
    if (!item) return
    const currentStatus = item.status || "Active"
    if (currentStatus === newStatus) return

    setPendingMoves(prev => ({ ...prev, [itemId]: newStatus }))

    try {
      await onStatusChange(itemId, newStatus)
    } catch (err) {
      console.error("Status change failed, reverting:", err)
    }
    setPendingMoves(prev => {
      const next = { ...prev }
      delete next[itemId]
      return next
    })
  }

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: "16px",
      minHeight: "400px",
    }}>
      {COLUMNS.map(col => {
        const colItems = getColumnItems(col.key)
        const isOver = dragOverCol === col.key
        return (
          <div
            key={col.key}
            onDragOver={(e) => handleDragOver(e, col.key)}
            onDragLeave={(e) => handleDragLeave(e, col.key)}
            onDrop={(e) => handleDrop(e, col.key)}
            style={{
              background: isOver ? `${accentColor}11` : "#F9FAFB",
              borderRadius: "12px",
              padding: "12px",
              border: isOver ? `2px dashed ${accentColor}` : "2px solid transparent",
              transition: "all 0.15s ease",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "4px 8px",
              marginBottom: "4px",
            }}>
              <span style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "#374151",
              }}>{col.label}</span>
              <span style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#6B7280",
                background: "#E5E7EB",
                borderRadius: "9999px",
                padding: "2px 8px",
                minWidth: "24px",
                textAlign: "center",
              }}>{colItems.length}</span>
            </div>

            <div style={{
              flex: 1,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              minHeight: "100px",
            }}>
              {colItems.map(item => (
                <div
                  key={item.id}
                  draggable="true"
                  onDragStart={(e) => handleDragStart(e, item)}
                  style={{ cursor: "grab" }}
                >
                  {renderCard(item)}
                </div>
              ))}

              {colItems.length === 0 && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: 1,
                  color: "#9CA3AF",
                  fontSize: "13px",
                  fontStyle: "italic",
                }}>
                  Drop items here
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
