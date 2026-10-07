import { useEffect, useRef } from 'react'
import { useChatResults } from '../chatResults'
import ProductCard from './ProductCard'

// The cards the chat assistant found, shown on the page. They use the same ProductCard as the
// Products page, so clicking one opens the single-item page.
export default function ChatResultsBand() {
  const { results, clear } = useChatResults()
  const ref = useRef<HTMLElement>(null)

  const resultsId = results?.id
  // Bring new results into view so the shopper sees the page update while chatting.
  useEffect(() => {
    if (resultsId) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [resultsId])

  if (!results) return null
  const count = results.products.length

  return (
    <section
      ref={ref}
      key={results.id}
      className="chat-results"
      aria-live="polite"
      aria-label="Products from your chat"
    >
      <div className="chat-results-inner">
        <div className="chat-results-head">
          <div>
            <p className="eyebrow">From your chat</p>
            <h2>{results.title}</h2>
            <p className="muted">
              {count} {count === 1 ? 'item' : 'items'} for “{results.query}”. Click a card for sizes and stock.
            </p>
          </div>
          <button className="btn btn-ghost" onClick={clear}>
            Clear results
          </button>
        </div>
        <div className="product-grid">
          {results.products.map((p) => (
            <ProductCard key={p.product_id} product={p} />
          ))}
        </div>
      </div>
    </section>
  )
}
