// Small color dots for catalogue color names ("navy blue", "heather gray", ...).
const SWATCH: [string, string][] = [
  ['multicolor', 'conic-gradient(#b3261e, #e9c43b, #2f5fa8, #2f6b4f, #b3261e)'],
  ['navy', '#1f2a4d'],
  ['royal blue', '#2c4fb5'],
  ['light blue', '#8db6e3'],
  ['blue', '#2f5fa8'],
  ['charcoal', '#4a4a50'],
  ['dark heather', '#5d5d63'],
  ['light gray', '#cfcfcf'],
  ['heather', '#b9b9bb'],
  ['gray', '#9c9c9e'],
  ['black', '#141414'],
  ['white', '#ffffff'],
  ['ivory', '#f6f0e1'],
  ['cream', '#efe6d2'],
  ['coral', '#d98a7a'],
  ['red', '#b3261e'],
  ['gold', '#c9a13b'],
  ['yellow', '#e9c43b'],
  ['green', '#2f6b4f'],
]

export const swatch = (color: string) => SWATCH.find(([key]) => color.toLowerCase().includes(key))?.[1] ?? '#cccccc'

// Design studio sketches: a solid garment color for any color name Dan picks ("yale navy", "oatmeal").
const COLOR_WORDS: [RegExp, string][] = [
  [/navy|midnight/, '#1f2a4d'],
  [/charcoal|graphite/, '#45474f'],
  [/gr[ae]y|heather|ash|silver/, '#a3a6ad'],
  [/cream|ivory|oat|natural|bone|sand/, '#efe5cf'],
  [/white/, '#f8f6f1'],
  [/black/, '#1e1e22'],
  [/royal|blue|cobalt/, '#2f57a6'],
  [/maroon|burgundy|wine/, '#6b2434'],
  [/red|crimson/, '#a8323a'],
  [/forest|green|olive/, '#2f5a43'],
  [/gold|mustard|yellow/, '#e0a341'],
  [/brown|tan|camel|khaki/, '#9b7651'],
  [/pink|rose/, '#e3a4a0'],
]

export function colorHex(name: string, fallback = '#1f2a4d'): string {
  const lower = name.toLowerCase()
  return COLOR_WORDS.find(([re]) => re.test(lower))?.[1] ?? fallback
}

export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const ch = (shift: number) => Math.max(0, Math.min(255, Math.round(((n >> shift) & 255) * (1 + amount))))
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`
}

export function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16)
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 160
}
