// One autumn leaf, as an SVG string (a stylized maple leaf in New England fall colors).
export const LEAF_COLORS = ['#d9822b', '#b5462e', '#e0a93b', '#9a3b2c', '#c96a2b', '#e6b65a']

export function leafSvg(color: string): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="${color}" d="M12 1.5c.9 2 2.2 3 3.6 3.2-.4 1.3-.2 2.4.6 3.2 1.4-.9 2.8-1.2 4.3-.8-.5 1.6-.3 3 .7 4.1-1.7.3-3 1.1-3.7 2.5 1 .7 1.6 1.7 1.7 3-1.8-.5-3.4-.3-4.9.6-.4-1.1-1-2-1.9-2.5V22h-.8v-5.2c-.9.5-1.5 1.4-1.9 2.5-1.5-.9-3.1-1.1-4.9-.6.1-1.3.7-2.3 1.7-3-.7-1.4-2-2.2-3.7-2.5 1-1.1 1.2-2.5.7-4.1 1.5-.4 2.9-.1 4.3.8.8-.8 1-1.9.6-3.2C9.8 4.5 11.1 3.5 12 1.5z"/><path d="M12 6v15" stroke="rgba(60,30,10,.35)" stroke-width=".6" fill="none"/></svg>`
}

export const randomLeafColor = () => LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)]
