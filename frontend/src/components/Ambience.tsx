import { useEffect, useMemo, useState } from 'react'
import { fetchForYou } from '../api'
import { readInterests } from '../interest'
import { leafSvg, randomLeafColor } from '../leaf'

// Fall on Old Campus: string lights down both sides of the page, leaves drifting down the side
// gutters (they collect in the leaf pile at the bottom), and now and then a leaf settles on a
// product card the shopper might like. Hovering or tapping a card brushes its leaf away.

const MAX_FALLING = 9
const MAX_RESTING = 3

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function StringLights({ side }: { side: 'left' | 'right' }) {
  const [height, setHeight] = useState(() => window.innerHeight)
  useEffect(() => {
    const onResize = () => setHeight(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const step = 86
  const count = Math.ceil(height / step) + 1
  // Each bulb gets its own flicker rhythm (a fixed pseudo-random pattern, so it's stable across renders).
  const bulbs = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const r = (n: number) =>
          (((Math.sin((i + (side === 'left' ? 0 : 97)) * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1
        return {
          y: i * step + step / 2,
          x: i % 2 ? 26 : 14,
          delay: (r(1) * 6).toFixed(2),
          duration: (2.4 + r(2) * 3.6).toFixed(2),
          warm: r(3) < 0.25,
        }
      }),
    [count, side],
  )
  let d = 'M20 0'
  for (let i = 0; i < count; i++) {
    const y = i * step
    d += ` Q ${i % 2 ? 36 : 4} ${y + step / 2} 20 ${y + step}`
  }
  return (
    <svg
      className={`string-lights string-lights-${side}`}
      viewBox={`0 0 40 ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={d} className="string-wire" />
      {bulbs.map((b, i) => (
        <g key={i} transform={`translate(${b.x} ${b.y})`}>
          <rect x="-2" y="-6.5" width="4" height="4" rx="1" className="string-socket" />
          <ellipse
            cx="0"
            cy="1.6"
            rx="4.2"
            ry="5.6"
            className={`string-bulb ${b.warm ? 'string-bulb-warm' : ''}`}
            style={{ animationDelay: `${b.delay}s`, animationDuration: `${b.duration}s` }}
          />
        </g>
      ))}
    </svg>
  )
}

export default function Ambience() {
  const [forYou, setForYou] = useState<string[]>([])

  // Keep "picked for you" in step with what the shopper lingers on.
  useEffect(() => {
    let timer = 0
    const refresh = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const interests = readInterests()
        if (Object.keys(interests).length === 0) return setForYou([])
        fetchForYou(interests)
          .then((r) => {
            setForYou(r.product_ids)
            window.dispatchEvent(new CustomEvent('cc-for-you', { detail: r.products }))
          })
          .catch(() => undefined)
      }, 600)
    }
    refresh()
    window.addEventListener('cc-interest', refresh)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('cc-interest', refresh)
    }
  }, [])

  // Leaves drifting down the side gutters.
  useEffect(() => {
    if (reducedMotion()) return
    const layer = document.createElement('div')
    layer.className = 'leaf-layer'
    layer.setAttribute('aria-hidden', 'true')
    document.body.appendChild(layer)
    const spawn = () => {
      if (document.hidden || layer.childElementCount >= MAX_FALLING) return
      const gutter = Math.max(46, (window.innerWidth - 1200) / 2)
      const side = Math.random() < 0.5 ? 'left' : 'right'
      const leaf = document.createElement('span')
      leaf.className = 'falling-leaf'
      const size = 16 + Math.random() * 14
      const offset = 6 + Math.random() * Math.max(10, gutter - size - 18)
      leaf.style.cssText = `${side}:${offset}px;width:${size}px;height:${size}px;animation-duration:${9 + Math.random() * 7}s`
      leaf.innerHTML = `<span class="leaf-sway" style="animation-duration:${2.6 + Math.random() * 2}s">${leafSvg(randomLeafColor())}</span>`
      leaf.addEventListener('animationend', (e) => {
        if (e.animationName !== 'leaf-fall') return
        leaf.remove()
        const landed = Number(sessionStorage.getItem('cc-leaves') || '0') + 1
        sessionStorage.setItem('cc-leaves', String(landed))
        window.dispatchEvent(new Event('cc-leaf-landed'))
      })
      layer.appendChild(leaf)
    }
    const timer = window.setInterval(spawn, 1700)
    spawn()
    return () => {
      window.clearInterval(timer)
      layer.remove()
    }
  }, [])

  // Now and then a leaf settles on a card the shopper might like (or any card, less often).
  useEffect(() => {
    if (reducedMotion()) return
    const settle = () => {
      if (document.hidden || document.querySelectorAll('.resting-leaf').length >= MAX_RESTING) return
      const cards = [...document.querySelectorAll<HTMLElement>('.product-card[data-product-id]')].filter((c) => {
        const r = c.getBoundingClientRect()
        return r.top > 80 && r.bottom < window.innerHeight - 40 && !c.querySelector('.resting-leaf')
      })
      if (!cards.length) return
      const liked = cards.filter((c) => forYou.includes(c.dataset.productId ?? ''))
      const picked = liked.length > 0
      if (!picked && Math.random() < 0.5) return // without a hint, leaves land only occasionally
      const card = (picked ? liked : cards)[Math.floor(Math.random() * (picked ? liked : cards).length)]
      const frame = card.querySelector('.product-card-image')
      if (!frame) return
      const leaf = document.createElement('span')
      leaf.className = 'resting-leaf'
      leaf.setAttribute('aria-hidden', 'true')
      leaf.style.setProperty('--tilt', `${-30 + Math.random() * 60}deg`)
      leaf.innerHTML = leafSvg(randomLeafColor())
      frame.appendChild(leaf)
      if (picked && !frame.querySelector('.picked-tag')) {
        const tag = document.createElement('span')
        tag.className = 'picked-tag'
        tag.textContent = 'Picked for you'
        frame.appendChild(tag)
      }
    }
    // Hover, or a tap, brushes the leaf off the card.
    const brush = (e: Event) => {
      const card = (e.target as HTMLElement | null)?.closest?.('.product-card')
      card?.querySelectorAll('.resting-leaf:not(.brushed), .picked-tag').forEach((el) => {
        el.classList.add('brushed')
        window.setTimeout(() => el.remove(), 700)
      })
    }
    const timer = window.setInterval(settle, 6500)
    const first = window.setTimeout(settle, 3500)
    document.addEventListener('mouseover', brush)
    document.addEventListener('touchstart', brush, { passive: true })
    return () => {
      window.clearInterval(timer)
      window.clearTimeout(first)
      document.removeEventListener('mouseover', brush)
      document.removeEventListener('touchstart', brush)
    }
  }, [forYou])

  return (
    <>
      <StringLights side="left" />
      <StringLights side="right" />
    </>
  )
}
