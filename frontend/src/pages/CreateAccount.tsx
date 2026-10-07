import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

export default function CreateAccount() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirm_password: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user && !submitting) return <Navigate to="/" replace />

  const update = (field: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    // Quick checks here for a friendly message; the backend enforces the same rules.
    if (form.password.length < 8) return setError('Use at least 8 characters for your password.')
    if (form.password !== form.confirm_password) return setError('Passwords do not match.')
    setError('')
    setSubmitting(true)
    try {
      await register(form)
      navigate('/', { replace: true, state: { welcome: true } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <section className="section auth">
      <div className="auth-split">
        <div className="auth-photo" role="img" aria-label="Yale's rooftops at dusk">
          <p>
            Join the Campus Customs community.
            <span>Campus Customs · New Haven</span>
          </p>
        </div>
        <form className="auth-card" onSubmit={onSubmit}>
          <h1>Create your account</h1>
          <p className="muted">Join Campus Customs to keep your chat history and favorites.</p>
          <div className="form-row">
            <label>
              First name
              <input
                value={form.first_name}
                onChange={update('first_name')}
                required
                maxLength={50}
                autoComplete="given-name"
              />
            </label>
            <label>
              Last name
              <input
                value={form.last_name}
                onChange={update('last_name')}
                required
                maxLength={50}
                autoComplete="family-name"
              />
            </label>
          </div>
          <label>
            Email
            <input type="email" value={form.email} onChange={update('email')} required autoComplete="email" />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={update('password')}
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
            />
            <span className="field-hint">At least 8 characters.</span>
          </label>
          <label>
            Confirm password
            <input
              type="password"
              value={form.confirm_password}
              onChange={update('confirm_password')}
              required
              autoComplete="new-password"
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}
          <p className="muted">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </form>
      </div>
    </section>
  )
}
