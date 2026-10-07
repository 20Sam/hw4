import { useEffect } from 'react'
import { startReveal } from './reveal'
import { useSky } from './sky'
import { Route, Routes, useLocation } from 'react-router-dom'
import Ambience from './components/Ambience'
import ChatResultsBand from './components/ChatResultsBand'
import ChatWidget from './components/ChatWidget'
import Footer from './components/Footer'
import DesignStudio from './components/DesignStudio'
import LeafPile from './components/LeafPile'
import Navbar from './components/Navbar'
import About from './pages/About'
import CreateAccount from './pages/CreateAccount'
import Home from './pages/Home'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import ProductDetail from './pages/ProductDetail'
import Products from './pages/Products'

export default function App() {
  const { pathname } = useLocation()
  useSky()
  useEffect(() => startReveal(), [])
  const hideChatResults = pathname.startsWith('/products/') || pathname === '/login' || pathname === '/create-account'
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="app">
      <Navbar />
      <main className="main">
        {/* Chat results sit above the page content, except on product, login, and sign-up pages. */}
        {!hideChatResults && <ChatResultsBand />}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:productId" element={<ProductDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/create-account" element={<CreateAccount />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <LeafPile />
        <DesignStudio />
      </main>
      <Footer />
      <Ambience />
      <ChatWidget />
    </div>
  )
}
