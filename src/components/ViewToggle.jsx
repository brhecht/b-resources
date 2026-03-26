export default function ViewToggle({ view = "grid", onToggle, accentColor = "#2563EB" }) {
  const options = [
    { key: "grid", label: "Grid", icon: "⊞" },
    { key: "kanban", label: "Kanban", icon: "☰" },
  ]

  return (
    <div style={{
      display: "inline-flex",
      borderRadius: "8px",
      overflow: "hidden",
      border: "1px solid #D1D5DB",
    }}>
      {options.map(opt => {
        const active = view === opt.key
        return (
          <button
            key={opt.key}
            onClick={() => onToggle(opt.key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "6px 14px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              border: "none",
              background: active ? accentColor : "#fff",
              color: active ? "#fff" : "#374151",
              transition: "all 0.15s ease",
            }}
          >
            <span style={{ fontSize: "14px" }}>{opt.icon}</span>
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
