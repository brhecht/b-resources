import { Link } from "react-router-dom"

const config = {
  library: {
    title: "Library",
    subtitle: "B Resources",
    desc: "Frameworks, playbooks, and reference material for the Humble Conviction team \u2014 all in one place.",
    accent: "#7B8FA8",
    bg: "#F6F8FA",
    gradient: "linear-gradient(135deg, #7B8FA8, #9AADBE)",
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  vault: {
    title: "Vault",
    subtitle: "B Resources",
    desc: "Brand assets, templates, credentials, and key documents \u2014 secured and organized for Humble Conviction.",
    accent: "#A89078",
    bg: "#FAF7F4",
    gradient: "linear-gradient(135deg, #A89078, #C0AA96)",
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
}

export default function ComingSoon({ tool }) {
  const c = config[tool]

  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif", background: c.bg, minHeight: "100vh",
      color: "#2D2A26", display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: 48, textAlign: "center" }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 64 }}>
          <Link
            to="/"
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: `${c.accent}1F`, display: "flex", alignItems: "center",
              justifyContent: "center", textDecoration: "none", color: c.accent, fontSize: 16,
            }}
            title="Back to B Resources"
          >&#8592;</Link>
          <div style={{
            width: 40, height: 40, background: c.accent, borderRadius: 11,
            display: "flex", alignItems: "center", justifyContent: "center", color: "white",
            fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700,
          }}>{c.title[0]}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, textAlign: "left" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: "#2D2A26" }}>{c.title}</div>
            <div style={{ fontSize: 11, color: `${c.accent}99`, fontWeight: 500, letterSpacing: "0.3px" }}>{c.subtitle}</div>
          </div>
        </div>

        {/* Icon */}
        <div style={{
          width: 80, height: 80, borderRadius: 20, background: c.gradient,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 32px", color: "white",
        }}>
          {c.icon}
        </div>

        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 800, letterSpacing: "-1px", color: "#2D2A26", marginBottom: 12 }}>
          Coming <span style={{ color: c.accent }}>soon.</span>
        </h1>
        <p style={{ fontSize: 16, color: `${c.accent}BB`, lineHeight: 1.6, maxWidth: 400, margin: "0 auto 40px" }}>
          {c.desc}
        </p>
        <span style={{
          display: "inline-block", fontSize: 11, fontWeight: 600, letterSpacing: "1px",
          textTransform: "uppercase", padding: "8px 20px", borderRadius: 8,
          background: `${c.accent}1A`, color: c.accent,
        }}>
          In Development
        </span>
      </div>
    </div>
  )
}
