export default function ViewSwitcher({ view = "group", onSwitch, accentColor = "#7B8FA8" }) {
  const tabs = [
    { key: "group", label: "By Group", icon: "▦" },
    { key: "grid", label: "All Resources", icon: "⊞" },
    { key: "pinned", label: "Quick Access", icon: "⭐" },
    { key: "list", label: "List", icon: "☰" },
  ]

  return (
    <div style={{
      display: "inline-flex",
      borderRadius: 8,
      overflow: "hidden",
      border: "1px solid #D1D5DB",
    }}>
      {tabs.map(tab => {
        const active = view === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => onSwitch(tab.key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 14px",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              border: "none",
              background: active ? accentColor : "#fff",
              color: active ? "#fff" : "#374151",
              transition: "all 0.15s ease",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: 14 }}>{tab.icon}</span>
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
