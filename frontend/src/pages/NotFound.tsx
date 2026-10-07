import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <section className="section center">
      <h1>We couldn't find that page</h1>
      <p className="muted">It may have moved. Let's get you back to the shop.</p>
      <Link to="/" className="btn btn-primary">
        Go home
      </Link>
    </section>
  )
}
