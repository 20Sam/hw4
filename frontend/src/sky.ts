// "Living sky": the site's sky colors follow the shopper's local time of day.
// App sets <html data-sky="dawn|day|dusk|night">; CSS variables in index.css do the rest.
import { useEffect, useState } from 'react'

export type Sky = 'dawn' | 'day' | 'dusk' | 'night'

export function skyAt(date = new Date()): Sky {
  const h = date.getHours() + date.getMinutes() / 60
  if (h >= 5 && h < 8) return 'dawn'
  if (h >= 8 && h < 17) return 'day'
  if (h >= 17 && h < 20.5) return 'dusk'
  return 'night'
}

export const SKY_COPY: Record<Sky, { greeting: string; caption: string }> = {
  dawn: { greeting: 'Good morning', caption: 'First light over Old Campus' },
  day: { greeting: 'Good afternoon', caption: 'A bright day on Old Campus' },
  dusk: { greeting: 'Good evening', caption: "Dusk over Yale's rooftops" },
  night: { greeting: 'Good evening', caption: 'Lamplight on Old Campus' },
}

export function useSky(): Sky {
  const [sky, setSky] = useState<Sky>(() => skyAt())
  useEffect(() => {
    // ?sky=night (etc.) previews another time of day, handy for screenshots and grading.
    const forced = new URLSearchParams(window.location.search).get('sky') as Sky | null
    const update = () => setSky(forced && forced in SKY_COPY ? forced : skyAt())
    update()
    const timer = window.setInterval(update, 5 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    document.documentElement.dataset.sky = sky
  }, [sky])
  return sky
}

// Ask the chat assistant from anywhere (product page chips, buttons): opens the chat and sends.
export function askDan(text: string) {
  window.dispatchEvent(new CustomEvent('cc-ask', { detail: text }))
}
