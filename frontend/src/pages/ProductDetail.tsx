import { Fragment, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchProduct, fetchRecommendations, formatPrice } from '../api'
import type { Recommendations } from '../api'
import ProductCard from '../components/ProductCard'
import { addDwell } from '../interest'
import { askDan } from '../sky'
import { swatch } from '../swatch'
import type { ProductDetail as Product } from '../types'

const KIND_PLURAL: Record<string, string> = {
  hoodie: 'Hoodies',
  crewneck: 'Crewnecks',
  't-shirt': 'Tees',
  'quarter-zip': 'Quarter-zips',
  jacket: 'Jackets',
  'long-sleeve': 'Long sleeves',
}

function stockLabel(qty: number) {
  if (qty === 0) return 'Sold out'
  if (qty <= 5) return `Only ${qty} left`
  return `${qty} in stock`
}

export default function ProductDetail() {
  const { productId = '' } = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [lens, setLens] = useState<{ x: number; y: number } | null>(null)
  const [recs, setRecs] = useState<Recommendations | null>(null)

  // Time spent reading this product counts as interest (twice as much as hovering a card).
  useEffect(() => {
    const started = performance.now()
    return () => addDwell(productId, ((performance.now() - started) / 1000) * 2)
  }, [productId])

  useEffect(() => {
    setRecs(null)
    fetchRecommendations(productId)
      .then(setRecs)
      .catch(() => setRecs(null))
  }, [productId])

  useEffect(() => {
    setProduct(null)
    setError('')
    setSelected(null)
    fetchProduct(productId)
      .then(setProduct)
      .catch(() => setError('We could not find that product.'))
  }, [productId])

  if (error) {
    return (
      <section className="section">
        <p className="notice notice-error">{error}</p>
        <Link to="/products" className="btn btn-primary">
          Back to all products
        </Link>
      </section>
    )
  }
  if (!product) return <section className="section muted">Loading…</section>

  const chosen = product.sizes.find((s) => s.size === selected)
  const asks = [
    selected ? `Is size ${selected} in stock?` : 'Is this in my size?',
    'What size should I get?',
    'Show me similar styles',
  ]

  return (
    <section className="section">
      <Link to="/products" className="back-link">
        ← All products
      </Link>
      <div className="detail">
        <div
          className="detail-image"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            setLens({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 })
          }}
          onMouseLeave={() => setLens(null)}
        >
          <img src={product.image_url} alt={product.name} />
          {lens && (
            <span
              className="detail-lens"
              aria-hidden="true"
              style={{
                left: `${lens.x}%`,
                top: `${lens.y}%`,
                backgroundImage: `url(${product.image_url})`,
                backgroundPosition: `${lens.x}% ${lens.y}%`,
              }}
            />
          )}
          <span className="detail-zoom-hint" aria-hidden="true">
            Hover to see the print up close
          </span>
        </div>

        <div className="detail-info">
          <p className="product-card-type">{product.garment_type}</p>
          <h1>{product.name}</h1>
          <p className="detail-price">{formatPrice(product.price)}</p>
          <p className="detail-desc">{product.description}</p>

          <h2 className="detail-label">Colors</h2>
          {product.colors.length > 0 ? (
            <div className="color-list">
              {product.colors.map((c) => (
                <span key={c} className="color-pill">
                  <span className="swatch" style={{ background: swatch(c) }} />
                  {c}
                </span>
              ))}
            </div>
          ) : (
            <p className="muted">Colors not listed. Ask our assistant or see the photo.</p>
          )}

          <h2 className="detail-label">Sizes and stock</h2>
          <div className="size-grid">
            {product.sizes.map((s) => (
              <button
                key={s.size}
                className={`size-btn ${selected === s.size ? 'selected' : ''} ${s.quantity === 0 ? 'sold-out' : ''}`}
                disabled={s.quantity === 0}
                onClick={() => setSelected(s.size)}
                aria-pressed={selected === s.size}
              >
                <strong>{s.size}</strong>
                <span>{stockLabel(s.quantity)}</span>
              </button>
            ))}
          </div>
          <p className="muted">
            {chosen
              ? `Size ${chosen.size}: ${stockLabel(chosen.quantity).toLowerCase()}.`
              : `${product.total_stock} units in stock across all sizes.`}
          </p>

          <div className="ask-dan">
            <p className="detail-label">Ask Dan about this one</p>
            <div className="ask-dan-chips">
              {asks.map((q) => (
                <button key={q} type="button" onClick={() => askDan(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {recs && recs.complete_the_look.items.length > 0 && (
        <section className="look reveal" aria-label="Complete the look">
          <div className="look-head">
            <p className="ed-number">Styling</p>
            <h2>Complete the look</h2>
            <p className="look-note">{recs.complete_the_look.note}</p>
          </div>
          <div className="look-row">
            <div className="look-item look-item-main">
              <img src={product.image_url} alt={product.name} />
              <span>{product.name}</span>
              <strong>{formatPrice(product.price)}</strong>
            </div>
            {recs.complete_the_look.items.map((item) => (
              <Fragment key={item.product_id}>
                <span className="look-plus" aria-hidden="true">
                  +
                </span>
                <Link to={`/products/${item.product_id}`} className="look-item">
                  <img src={item.image_url} alt={item.name} />
                  <span>{item.name}</span>
                  <strong>{formatPrice(item.price)}</strong>
                </Link>
              </Fragment>
            ))}
            <div className="look-total">
              <span>The whole look</span>
              <strong>{formatPrice(recs.complete_the_look.total)}</strong>
            </div>
          </div>
        </section>
      )}

      {recs && recs.other_colors.length > 0 && (
        <section className="recs reveal" aria-label="Other colors">
          <h2>{KIND_PLURAL[recs.kind] ?? 'More pieces'} in other colors</h2>
          <div className="product-grid">
            {recs.other_colors.map((p) => (
              <ProductCard key={p.product_id} product={p} />
            ))}
          </div>
        </section>
      )}

      {recs && recs.more_like_this.length > 0 && (
        <section className="recs reveal" aria-label="More like this">
          <h2>More {(KIND_PLURAL[recs.kind] ?? 'pieces').toLowerCase()} like this</h2>
          <div className="product-grid">
            {recs.more_like_this.map((p) => (
              <ProductCard key={p.product_id} product={p} />
            ))}
          </div>
        </section>
      )}
    </section>
  )
}
