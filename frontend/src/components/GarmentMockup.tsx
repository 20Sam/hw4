import { colorHex, isLight, shade } from '../swatch'
import type { StudioConcept } from '../types'

// A flat sketch of Dan's concept, drawn in SVG: the garment in its colors, with the logo where it goes.

const LONG_SLEEVES = 'M95 62 L58 92 L30 250 L60 260 L101 142 Z M205 62 L242 92 L270 250 L240 260 L199 142 Z'
const SHORT_SLEEVES = 'M95 62 L56 86 L72 132 L101 118 Z M205 62 L244 86 L228 132 L199 118 Z'
const TORSO = 'M95 62 L126 48 Q150 64 174 48 L205 62 L199 124 L199 292 L101 292 L101 124 Z'

export default function GarmentMockup({ concept }: { concept: StudioConcept }) {
  const base = colorHex(concept.base_color)
  // The logo needs to show on the garment: pick the accent, or a contrasting one if it's too close.
  let accent = colorHex(concept.accent_color, isLight(base) ? '#1f2a4d' : '#f8f6f1')
  if (isLight(accent) === isLight(base)) accent = isLight(base) ? '#1f2a4d' : '#f8f6f1'
  const outline = shade(base, isLight(base) ? -0.28 : 0.35)
  const rib = shade(base, isLight(base) ? -0.12 : 0.18)
  const g = concept.garment
  const longSleeves = g !== 't-shirt'
  const text = concept.logo_text.toUpperCase()
  const placement = concept.placement === 'hood' && g !== 'hoodie' ? 'center chest' : concept.placement
  // Big chest/back logos: shrink long names ("DAVENPORT") so they fit across the chest.
  const fit = (width: number, max: number) => Math.max(11, Math.min(max, width / (text.length * 0.78)))
  const archSize = fit(118, 30)
  const bigSize = fit(124, 34)
  const font = {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontWeight: 700,
    letterSpacing: '0.06em',
  }

  return (
    <svg className="mockup" viewBox="0 0 300 320" role="img" aria-label={`Sketch: ${concept.name}`}>
      <defs>
        <linearGradient id="mockup-light" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.12" />
        </linearGradient>
        <path id="mockup-arch" d="M88 152 Q150 116 212 152" />
      </defs>
      <ellipse cx="150" cy="306" rx="110" ry="9" fill="#000" opacity="0.08" />

      {g === 'hoodie' && (
        <path d="M116 56 Q108 6 150 4 Q192 6 184 56 Q150 70 116 56 Z" fill={base} stroke={outline} strokeWidth="2" />
      )}
      <g stroke={outline} strokeWidth="2" strokeLinejoin="round">
        <path d={longSleeves ? LONG_SLEEVES : SHORT_SLEEVES} fill={base} />
        <path d={TORSO} fill={base} />
      </g>
      {/* ribbed hem and cuffs */}
      {g !== 't-shirt' && <rect x="101" y="278" width="98" height="14" fill={rib} stroke={outline} strokeWidth="1.5" />}
      {longSleeves && (
        <g fill={rib} stroke={outline} strokeWidth="1.5">
          <path d="M33 236 L62 246 L60 260 L30 250 Z" />
          <path d="M267 236 L238 246 L240 260 L270 250 Z" />
        </g>
      )}

      {/* neckline by garment */}
      {g === 'hoodie' && placement !== 'back' && (
        <>
          <path d="M128 54 Q150 30 172 54 Q150 66 128 54 Z" fill={shade(base, -0.3)} />
          <g stroke={accent} strokeWidth="2.5" strokeLinecap="round">
            <path d="M141 62 L139 110" />
            <path d="M159 62 L161 110" />
          </g>
          <path d="M116 214 L184 214 L194 266 L106 266 Z" fill="none" stroke={outline} strokeWidth="1.5" />
        </>
      )}
      {(g === 'crewneck' || g === 't-shirt') && (
        <path d="M126 48 Q150 64 174 48" fill="none" stroke={rib} strokeWidth="7" strokeLinecap="round" />
      )}
      {g === 'quarter-zip' && placement !== 'back' && (
        <>
          <path
            d="M124 50 L124 34 Q150 28 176 34 L176 50 Q150 60 124 50 Z"
            fill={rib}
            stroke={outline}
            strokeWidth="1.5"
          />
          <path d="M150 34 L150 112" stroke={accent} strokeWidth="2.5" />
          <rect x="146" y="108" width="8" height="14" rx="2" fill={accent} />
        </>
      )}
      {g === 'jacket' && placement !== 'back' && (
        <>
          <path d="M126 48 L136 78 L150 60 L164 78 L174 48" fill={rib} stroke={outline} strokeWidth="1.5" />
          <path d="M150 60 L150 292" stroke={accent} strokeWidth="2.5" />
          <path d="M112 190 L132 190 M168 190 L188 190" stroke={outline} strokeWidth="2" />
        </>
      )}
      <path d={TORSO} fill="url(#mockup-light)" />

      {/* the logo, where the shopper asked for it */}
      <g fill={accent} style={font}>
        {placement === 'left chest' && (
          <text x="177" y="104" fontSize={Math.max(8, Math.min(15, 60 / text.length))} textAnchor="middle">
            {text}
          </text>
        )}
        {placement === 'center chest' &&
          (text.length >= 4 && text.length <= 12 ? (
            <text fontSize={archSize} textAnchor="middle">
              <textPath href="#mockup-arch" startOffset="50%">
                {text}
              </textPath>
            </text>
          ) : (
            <text x="150" y="160" fontSize={bigSize} textAnchor="middle">
              {text}
            </text>
          ))}
        {placement === 'sleeve' && (
          <text
            x="0"
            y="0"
            fontSize={Math.max(8, Math.min(14, 90 / text.length))}
            textAnchor="middle"
            transform={longSleeves ? 'translate(66 172) rotate(-80)' : 'translate(76 104) rotate(-68)'}
          >
            {text}
          </text>
        )}
        {placement === 'back' && (
          <text x="150" y="140" fontSize={bigSize} textAnchor="middle">
            {text}
          </text>
        )}
        {placement === 'hood' && (
          <text x="150" y="30" fontSize={Math.max(7, Math.min(12, 54 / text.length))} textAnchor="middle">
            {text}
          </text>
        )}
      </g>
      {placement === 'back' && (
        <text x="150" y="316" fontSize="10" textAnchor="middle" fill="#6b6878" letterSpacing="0.14em">
          BACK VIEW
        </text>
      )}
    </svg>
  )
}
