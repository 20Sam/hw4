import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { formatPrice } from '../api'
import { addDwell } from '../interest'
import { swatch } from '../swatch'
import type { ProductSummary } from '../types'

const ALMOST_GONE = 25 // units left across all sizes

export default function ProductCard({ product }: { product: ProductSummary }) {
  const low = product.total_stock > 0 && product.total_stock <= ALMOST_GONE
  const hoverStart = useRef(0)
  return (
    <Link
      to={`/products/${product.product_id}`}
      className="product-card reveal"
      data-product-id={product.product_id}
      onMouseEnter={() => (hoverStart.current = performance.now())}
      onMouseLeave={() => addDwell(product.product_id, (performance.now() - hoverStart.current) / 1000)}
    >
      <div className="product-card-image">
        <img src={product.image_url} alt={product.name} loading="lazy" />
        {product.total_stock === 0 ? (
          <span className="card-badge card-badge-out">Sold out</span>
        ) : (
          low && <span className="card-badge">Almost gone</span>
        )}
        <span className="card-peek" aria-hidden="true">
          Look closer →
        </span>
      </div>
      <div className="product-card-body">
        <p className="product-card-type">{product.garment_type}</p>
        <h3>{product.name}</h3>
        <p className="product-card-desc">{product.short_description}</p>
        <div className="product-card-foot">
          <p className="product-card-price">{formatPrice(product.price)}</p>
          {product.colors.length > 0 && (
            <span className="swatches" aria-label={`Colors: ${product.colors.join(', ')}`}>
              {product.colors.slice(0, 4).map((c) => (
                <span key={c} className="swatch" style={{ background: swatch(c) }} title={c} />
              ))}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
