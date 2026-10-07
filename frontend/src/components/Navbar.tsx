import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

// Real store facts only (see output/harness.md, "Store facts").
const TICKER = [
  'Officially licensed Yale apparel',
  'Visit us at 57 Broadway, New Haven',
  'We ship to 30+ countries',
  'Live stock and real prices on every page',
  'Ask Dan, our bulldog, to find your size',
]

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/products', label: 'Products' },
  { to: '/about', label: 'About Us' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()

  async function onLogout() {
    close()
    await logout()
    navigate('/')
  }

  return (
    <header className="navbar">
      <div className="announcement" aria-label="Store news">
        <div className="ticker">
          {[0, 1].map((copy) => (
            <span key={copy} className="ticker-run" aria-hidden={copy === 1}>
              {TICKER.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </span>
          ))}
        </div>
      </div>
      <nav className="nav-inner" aria-label="Main">
        <Link to="/" className="brand" onClick={close}>
          <span className="brand-mark" aria-hidden="true">
            CC
          </span>
          <span className="brand-text">
            Campus Customs
            <small>Yale · New Haven</small>
          </span>
        </Link>

        <button
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="nav-links"
          onClick={() => setOpen((o) => !o)}
        >
          Menu
        </button>

        <div id="nav-links" className={`nav-links ${open ? 'open' : ''}`}>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} onClick={close}>
              {l.label}
            </NavLink>
          ))}
          <span className="nav-divider" aria-hidden="true" />
          {loading ? null : user ? (
            <>
              <span className="nav-user">Hi, {user.first_name}</span>
              <button className="nav-logout" onClick={onLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" onClick={close}>
                Log in
              </NavLink>
              <NavLink to="/create-account" className="nav-cta" onClick={close}>
                Create account
              </NavLink>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
