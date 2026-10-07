// Scroll-reveal: anything with class "reveal" fades up the first time it scrolls into view.
// One observer for the whole app; a MutationObserver picks up cards added later (search, chat).
export function startReveal(): () => void {
  // Content is only hidden for the fade-in when the page is visible and the observer can run;
  // otherwise (hidden tab, screenshot tools, reduced motion) everything simply shows.
  if (
    typeof IntersectionObserver === 'undefined' ||
    document.hidden ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    document.documentElement.classList.add('no-reveal')
    return () => undefined
  }
  document.documentElement.classList.add('reveal-ready')
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed')
          io.unobserve(entry.target)
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  )
  const watch = (root: ParentNode) =>
    root.querySelectorAll<HTMLElement>('.reveal:not(.revealed)').forEach((el) => io.observe(el))
  watch(document)
  const mo = new MutationObserver((records) => {
    for (const r of records)
      r.addedNodes.forEach((n) => n instanceof HTMLElement && (n.matches('.reveal') ? io.observe(n) : watch(n)))
  })
  mo.observe(document.body, { childList: true, subtree: true })
  return () => {
    io.disconnect()
    mo.disconnect()
  }
}
