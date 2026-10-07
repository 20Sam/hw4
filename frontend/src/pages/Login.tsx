import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user && !submitting) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
      navigate(from, { replace: true, state: { welcome: true } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log in. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <section className="section auth">
      <div className="auth-split">
        <div className="auth-photo" role="img" aria-label="Yale's rooftops at dusk">
          <p>
            Welcome back to the Bulldog family.
            <span>Campus Customs · New Haven</span>
          </p>
        </div>
        <form className="auth-card" onSubmit={onSubmit}>
          <h1>Welcome back</h1>
          <p className="muted">Log in to save your chats with our shop assistant.</p>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}
          <p className="muted">
            New here? <Link to="/create-account">Create an account</Link>
          </p>
        </form>
      </div>
    </section>
  )
}
