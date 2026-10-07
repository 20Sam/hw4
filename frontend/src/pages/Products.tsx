import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchProducts } from '../api'
import ProductCard from '../components/ProductCard'
import type { ProductSummary } from '../types'

const QUICK_FILTERS = ['hoodie', 'crewneck', 't-shirt', 'quarter-zip', 'jacket']

export default function Products() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [draft, setDraft] = useState(q)
  const [products, setProducts] = useState<ProductSummary[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setDraft(q)
    setProducts(null)
    setError('')
    fetchProducts(q || undefined)
      .then(setProducts)
      .catch(() => setError('We could not load the catalogue. Is the backend running on port 8000?'))
  }, [q])

  function applySearch(value: string) {
    setParams(value ? { q: value } : {})
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    applySearch(draft.trim())
  }

  return (
    <>
      <section className="page-banner">
        <div className="page-banner-inner">
          <p className="ed-kicker">The collection</p>
          <h1>Shop all products</h1>
          <p>Click any item for full details, sizes, and live stock.</p>
        </div>
      </section>
      <section className="section">
        <form className="search-bar" onSubmit={onSubmit} role="search">
          <input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search hoodies, colleges, sports…"
            aria-label="Search products"
          />
          <button className="btn btn-primary" type="submit">
            Search
          </button>
        </form>

        <div className="chips">
          <button className={`chip ${q === '' ? 'active' : ''}`} onClick={() => applySearch('')}>
            All
          </button>
          {QUICK_FILTERS.map((f) => (
            <button key={f} className={`chip ${q === f ? 'active' : ''}`} onClick={() => applySearch(f)}>
              {f}
            </button>
          ))}
        </div>

        {error && <p className="notice notice-error">{error}</p>}
        {!error && products === null && <p className="muted">Loading the catalogue…</p>}
        {products && (
          <>
            <p className="muted result-count">
              {products.length} {products.length === 1 ? 'item' : 'items'}
              {q && <> matching “{q}”</>}
            </p>
            {products.length === 0 ? (
              <p className="notice">No products match that search yet. Try “hoodie” or “crewneck”.</p>
            ) : (
              <div className="product-grid">
                {products.map((p) => (
                  <ProductCard key={p.product_id} product={p} />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </>
  )
}
