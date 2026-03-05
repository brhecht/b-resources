import { BrowserRouter, Routes, Route } from "react-router-dom"
import Home from "./pages/Home"
import ComingSoon from "./pages/ComingSoon"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/library" element={<ComingSoon tool="library" />} />
        <Route path="/vault" element={<ComingSoon tool="vault" />} />
      </Routes>
    </BrowserRouter>
  )
}
