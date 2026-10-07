import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { fetchProducts } from '../api'
import { useAuth } from '../auth'
import { SKY_COPY, useSky } from '../sky'
import ProductCard from '../components/ProductCard'
import type { ProductSummary } from '../types'

const FEATURED_IDS = [
  'basic-hoodie-big-yale',
  'baseball-left-chest-crewneck',
  '2025-yale-vs-harvard-t-shirt',
  'benjamin-franklin-1-4-zip',
]

const THE_EDIT = [
  { label: 'Hoodies', q: 'hoodie', note: 'Cozy pullovers for chilly walks to class' },
  { label: 'Crewnecks', q: 'crewneck', note: 'The classic sweatshirt, in Yale blue' },
  { label: 'T-shirts', q: 't-shirt', note: 'Easy tees for game day and every day' },
  { label: 'Quarter-zips', q: 'quarter-zip', note: 'Polished layers from seminar to dinner' },
  { label: 'Jackets', q: 'jacket', note: 'Fleece and outerwear for New Haven winters' },
]

// Residential colleges that have their own pieces in the catalogue.
const COLLEGES = [
  'Benjamin Franklin',
  'Berkeley',
  'Branford',
  'Davenport',
  'Grace Hopper',
  'Jonathan Edwards',
  'Morse',
  'Pierson',
  'Saybrook',
  'Timothy Dwight',
  'Trumbull',
]

export default function Home() {
  const [featured, setFeatured] = useState<ProductSummary[]>([])
  const { user } = useAuth()
  const sky = useSky()
  const welcome = (useLocation().state as { welcome?: boolean } | null)?.welcome

  useEffect(() => {
    fetchProducts()
      .then((all) => {
        const picks = FEATURED_IDS.map((id) => all.find((p) => p.product_id === id)).filter((p): p is ProductSummary =>
          Boolean(p),
        )
        setFeatured(picks.length === 4 ? picks : all.slice(0, 4))
      })
      .catch(() => setFeatured([]))
  }, [])

  return (
    <>
      {welcome && user && (
        <div className="welcome-banner">
          <p className="notice" role="status">
            Welcome, {user.first_name}! You're signed in as {user.email}.
          </p>
        </div>
      )}

      <section className="ed-hero" aria-label="Campus Customs">
        <div className="ed-hero-photo" role="img" aria-label="Yale's Gothic towers and rooftops at dusk" />
        <div className="ed-hero-inner">
          <p className="ed-kicker">{SKY_COPY[sky].greeting} from Campus Customs · New Haven</p>
          <h1 className="ed-hero-title">
            Wear your Yale,
            <br />
            <em>every season</em> of the year.
          </h1>
          <p className="ed-hero-lede">
            Soft hoodies, everyday crewnecks, and game-day tees for lecture halls, long library nights, and the walk
            across Old Campus.
          </p>
          <div className="hero-actions">
            <Link to="/products" className="btn btn-light">
              Shop the collection
            </Link>
            <Link to="/about" className="btn btn-outline-light">
              Our story
            </Link>
          </div>
        </div>
        <p className="ed-caption">
          <span className={`sky-dot sky-dot-${sky}`} aria-hidden="true" />
          {SKY_COPY[sky].caption} · the site follows your time of day
        </p>
      </section>

      <section className="ed-intro reveal">
        <p className="ed-number">57 Broadway · New Haven</p>
        <p className="ed-statement">
          Under Gothic spires and New England skies, a Yale wardrobe is part of the day. We keep it simple: officially
          licensed pieces, honest prices, and <em>the real stock on our shelves.</em>
        </p>
        <span className="ed-rule" aria-hidden="true" />
      </section>

      <section className="section ed-edit">
        <div className="ed-section-head reveal">
          <p className="ed-number">I.</p>
          <h2>The Edit</h2>
          <p className="muted">Pick a style to start. Every piece shows its real price and live stock by size.</p>
        </div>
        <ol className="ed-index reveal">
          {THE_EDIT.map((c, i) => (
            <li key={c.q}>
              <Link to={`/products?q=${encodeURIComponent(c.q)}`}>
                <span className="ed-index-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="ed-index-label">{c.label}</span>
                <span className="ed-index-note">{c.note}</span>
                <span className="ed-index-arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="section section-sand">
        <div className="ed-section-head reveal">
          <p className="ed-number">II.</p>
          <h2>Shopper favorites</h2>
          <p className="muted">The pieces our customers keep coming back for.</p>
        </div>
        <div className="product-grid">
          {featured.map((p) => (
            <ProductCard key={p.product_id} product={p} />
          ))}
        </div>
        <div className="center">
          <Link to="/products" className="btn btn-primary">
            See all products
          </Link>
        </div>
      </section>

      <section className="section colleges">
        <div className="ed-section-head reveal">
          <p className="ed-number">III.</p>
          <h2>Shop by residential college</h2>
          <p className="muted">
            Every Yalie belongs to one. Find your college's crest on a tee, quarter-zip, or fleece.
          </p>
        </div>
        <div className="college-shelf">
          {COLLEGES.map((c, i) => (
            <Link
              key={c}
              to={`/products?q=${encodeURIComponent(c)}`}
              className="college-tile reveal"
              style={{ ['--i' as string]: i }}
            >
              <span className="college-crest" aria-hidden="true">
                {c
                  .split(' ')
                  .map((w) => w[0])
                  .join('')}
              </span>
              <span className="college-name">{c}</span>
              <span className="college-label">College</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="ed-story reveal">
        <div className="ed-story-photo" role="img" aria-label="Yale's stone colleges lit up in the evening" />
        <div className="ed-story-text">
          <p className="ed-number">IV.</p>
          <h2>A shop on Broadway, a short walk from Old Campus</h2>
          <p>
            Campus Customs is the team behind Yale Bulldog Blue. Stop by 57 Broadway to try on a hoodie, or browse here
            and let our shop assistant check sizes for you, any time of day.
          </p>
          <div className="ed-facts">
            <div>
              <strong>Officially licensed</strong>
              <span>Accurate marks and quality that lasts</span>
            </div>
            <div>
              <strong>The whole Yale family</strong>
              <span>Colleges, teams, schools, parents, alumni</span>
            </div>
            <div>
              <strong>Honest answers</strong>
              <span>Real prices and stock, straight from our shelves</span>
            </div>
          </div>
          <Link to="/about" className="ed-link">
            Read our story →
          </Link>
        </div>
      </section>
    </>
  )
}
