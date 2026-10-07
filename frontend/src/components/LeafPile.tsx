import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatPrice } from '../api'
import { leafSvg, LEAF_COLORS } from '../leaf'
import type { ProductSummary } from '../types'
import Dan from './Dan'

// Where all the falling leaves end up: a pile at the bottom of every page, with Dan's picks.
export default function LeafPile() {
  const [count, setCount] = useState(() => Number(sessionStorage.getItem('cc-leaves') || '0'))
  const [picks, setPicks] = useState<ProductSummary[]>([])

  useEffect(() => {
    const onLanded = () => setCount(Number(sessionStorage.getItem('cc-leaves') || '0'))
    const onPicks = (e: Event) => setPicks((e as CustomEvent<ProductSummary[]>).detail.slice(0, 3))
    window.addEventListener('cc-leaf-landed', onLanded)
    window.addEventListener('cc-for-you', onPicks)
    return () => {
      window.removeEventListener('cc-leaf-landed', onLanded)
      window.removeEventListener('cc-for-you', onPicks)
    }
  }, [])

  // A mound of up to 46 leaves; the same positions every time, growing as more leaves fall.
  const shown = Math.min(46, 8 + count)
  const leaves = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => {
        const r = (n: number) => (((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1
        const x = 50 + (r(1) + r(5) - 1) * 46 // bunched toward the middle
        const height = 64 * Math.max(0, 1 - Math.abs(x - 50) / 48) ** 1.15 // a mound
        return {
          x,
          y: r(2) * height,
          rot: r(3) * 360,
          size: 22 + r(4) * 16,
          color: LEAF_COLORS[i % LEAF_COLORS.length],
        }
      }),
    [],
  )

  return (
    <section className="leaf-pile-section reveal" aria-label="The leaf pile">
      <div className="leaf-pile" aria-hidden="true">
        {leaves.slice(0, shown).map((l, i) => (
          <span
            key={i}
            className="pile-leaf"
            style={{
              left: `${l.x}%`,
              bottom: `${l.y}px`,
              width: l.size,
              height: l.size,
              transform: `rotate(${l.rot}deg)`,
            }}
            dangerouslySetInnerHTML={{ __html: leafSvg(l.color) }}
          />
        ))}
      </div>
      <div className="leaf-pile-note">
        <Dan size={46} />
        <div>
          <p className="leaf-pile-title">
            You found the leaf pile. {count > 0 && <>{count} leaves have fallen while you browsed.</>}
          </p>
          {picks.length > 0 ? (
            <>
              <p className="muted">Dan's picks for you, based on what you've been looking at:</p>
              <div className="leaf-picks">
                {picks.map((p) => (
                  <Link key={p.product_id} to={`/products/${p.product_id}`} className="leaf-pick">
                    <img src={p.image_url} alt="" />
                    <span>{p.name}</span>
                    <strong>{formatPrice(p.price)}</strong>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <p className="muted">Browse a few pieces and Dan will pick favorites for you here.</p>
          )}
        </div>
      </div>
    </section>
  )
}
