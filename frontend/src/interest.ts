// Remembers how long the shopper lingers on each product (hovering a card, or reading its page).
// Kept only in this browser (localStorage); it steers the falling leaves and "picked for you".
const KEY = 'cc-interest'
const MAX_ITEMS = 40

export function readInterests(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}

export function addDwell(productId: string, seconds: number) {
  if (seconds < 0.8) return // a quick pass over a card isn't interest
  const all = readInterests()
  all[productId] = Math.min(600, (all[productId] ?? 0) + seconds)
  const top = Object.entries(all)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_ITEMS)
  localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(top)))
  window.dispatchEvent(new Event('cc-interest'))
}
