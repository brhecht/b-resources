import { BrowserRouter, Routes, Route } from "react-router-dom"
import Home from "./pages/Home"
import Library from "./pages/Library"
import Vault from "./pages/Vault"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/library" element={<Library />} />
        <Route path="/vault" element={<Vault />} />
      </Routes>
    </BrowserRouter>
  )
}
