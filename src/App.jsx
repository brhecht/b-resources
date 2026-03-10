import { useState, useEffect } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { auth, onAuthStateChanged } from "./firebase"
import SignIn from "./components/SignIn"
import Home from "./pages/Home"
import Library from "./pages/Library"
import Vault from "./pages/Vault"

export default function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setAuthLoading(false)
    })
    return unsubscribe
  }, [])

  if (authLoading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#FAF7F4",
        fontFamily: "system-ui, sans-serif",
        color: "#8A7A6E",
      }}>
        Loading...
      </div>
    )
  }

  if (!user) return <SignIn />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/library" element={<Library user={user} />} />
        <Route path="/vault" element={<Vault user={user} />} />
      </Routes>
    </BrowserRouter>
  )
}
