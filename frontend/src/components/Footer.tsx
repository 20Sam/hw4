import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <p className="footer-brand">Campus Customs</p>
          <p>57 Broadway, New Haven, CT 06511</p>
          <p>Officially licensed Yale merchandise</p>
        </div>
        <div className="footer-links">
          <Link to="/products">Shop all</Link>
          <Link to="/about">About us</Link>
          <Link to="/login">Log in</Link>
          <Link to="/create-account">Create account</Link>
        </div>
      </div>
      <p className="footer-note">© 2026 Campus Customs · Built as a student project for AI Foundations (Homework 4).</p>
    </footer>
  )
}
