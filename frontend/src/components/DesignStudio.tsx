import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ApiError, fetchStudioProfile, formatPrice, generateStudio, sendStudioFeedback } from '../api'
import { useAuth } from '../auth'
import { addDwell } from '../interest'
import type { StudioAnswers, StudioPick, StudioResult } from '../types'
import Dan from './Dan'
import { colorHex } from '../swatch'
import GarmentMockup from './GarmentMockup'

// "Pitch the next Campus Customs piece": a short questionnaire, Dan's original concept (a sketch for the
// store team, not for sale), and real pieces from the shop that fit the vibe. Likes teach Dan your style;
// they're saved to your account when you're signed in, and in this browser when you're a guest.

const VIBES = ['classic ivy', 'game day', 'cozy', 'vintage', 'minimal', 'sporty', 'preppy'] as const
const FITS = ['fitted', 'regular', 'relaxed', 'oversized'] as const
const OCCASIONS = ['class and library', 'game day', 'family weekend', 'reunion', 'gift', 'gym', 'night out'] as const
const GARMENTS = ['surprise me', 'hoodie', 'crewneck', 't-shirt', 'quarter-zip', 'jacket'] as const
const COLORS = ['yale navy', 'heather gray', 'cream', 'white', 'black', 'royal blue', 'red accents', 'forest green']
const MATERIALS = ['heavy fleece', 'soft cotton', 'tri-blend', 'sweater knit', 'performance', 'waffle knit']
const LOGOS = ['yale wordmark', 'y monogram', 'bulldog', 'college crest', 'school or sport', 'est. 1701'] as const
const PLACEMENTS = ['left chest', 'center chest', 'sleeve', 'back', 'hood'] as const
const STEPS = ['Your vibe', 'The piece', 'Logo and inspiration']
const SKETCHING = ['Reading your vibe…', 'Sketching the concept…', 'Picking pieces from the shop…']

const DEFAULT_ANSWERS: StudioAnswers = {
  vibe: 'classic ivy',
  fit: 'regular',
  occasion: 'class and library',
  garment: 'surprise me',
  colors: ['yale navy'],
  materials: [],
  logo: 'yale wordmark',
  logo_detail: '',
  placement: 'left chest',
  inspired_by: '',
  notes: '',
}

type Verdict = 'like' | 'dislike'
const ANSWERS_KEY = 'cc-studio-answers'
const FEEDBACK_KEY = 'cc-studio-feedback'

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

const localVerdicts = () => readLocal<Record<string, Verdict>>(FEEDBACK_KEY, {})
const split = (v: Record<string, Verdict>, kind: Verdict) => Object.keys(v).filter((id) => v[id] === kind)

function Chips<T extends string>(props: {
  label: string
  options: readonly T[]
  value: T | T[]
  onChange: (next: T) => void
  swatches?: boolean
}) {
  const selected = (o: T) => (Array.isArray(props.value) ? props.value.includes(o) : props.value === o)
  return (
    <fieldset className="studio-field">
      <legend>{props.label}</legend>
      <div className="chips">
        {props.options.map((o) => (
          <button
            key={o}
            type="button"
            className={`chip ${selected(o) ? 'active' : ''}`}
            aria-pressed={selected(o)}
            onClick={() => props.onChange(o)}
          >
            {props.swatches && <span className="studio-swatch" style={{ background: colorHex(o) }} />}
            {o}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

// A fresh studio for each shopper: logging in or out never shows the last person's pitch or likes.
export default function DesignStudio() {
  const { user } = useAuth()
  return <Studio key={user ? `user-${user.id}` : 'guest'} />
}

function Studio() {
  const { user } = useAuth()
  const location = useLocation()
  const onProductPage = /^\/products\/[^/]+$/.test(location.pathname)
  const [stage, setStage] = useState<'teaser' | 'questions' | 'sketching' | 'result'>('teaser')
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<StudioAnswers>(() => readLocal(ANSWERS_KEY, DEFAULT_ANSWERS))
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>(() => (user ? {} : localVerdicts()))
  const [result, setResult] = useState<StudioResult | null>(null)
  const [tiles, setTiles] = useState<StudioPick[]>([])
  const [reserve, setReserve] = useState<StudioPick[]>([])
  const [error, setError] = useState<string | null>(null)
  const [sketchLine, setSketchLine] = useState(0)
  const [remembered, setRemembered] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  // Signed in: move any likes made as a guest onto the account, then load the saved style.
  // Guests' likes and answers stay in this browser (read when the studio starts).
  useEffect(() => {
    if (!user) return
    let cancelled = false
    const pending = localVerdicts()
    Promise.allSettled(Object.entries(pending).map(([id, v]) => sendStudioFeedback(id, v)))
      .then(() => {
        localStorage.removeItem(FEEDBACK_KEY)
        return fetchStudioProfile()
      })
      .then((profile) => {
        if (cancelled) return
        setVerdicts({
          ...Object.fromEntries(profile.liked.map((id) => [id, 'like' as const])),
          ...Object.fromEntries(profile.disliked.map((id) => [id, 'dislike' as const])),
        })
        if (profile.answers) setAnswers({ ...DEFAULT_ANSWERS, ...profile.answers })
        setRemembered(Boolean(profile.answers) || profile.liked.length > 0)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    if (stage !== 'sketching') return
    const timer = window.setInterval(() => setSketchLine((n) => Math.min(n + 1, SKETCHING.length - 1)), 2200)
    return () => window.clearInterval(timer)
  }, [stage])

  const set = <K extends keyof StudioAnswers>(key: K, value: StudioAnswers[K]) =>
    setAnswers((a) => ({ ...a, [key]: value }))
  const toggle = (key: 'colors' | 'materials', value: string, max: number) =>
    setAnswers((a) => {
      const list = a[key]
      if (list.includes(value)) return { ...a, [key]: list.filter((v) => v !== value) }
      return list.length >= max ? a : { ...a, [key]: [...list, value] }
    })

  async function pitch() {
    setStage('sketching')
    setSketchLine(0)
    setError(null)
    localStorage.setItem(ANSWERS_KEY, JSON.stringify(answers))
    const local = user ? {} : localVerdicts()
    try {
      const res = await generateStudio(answers, split(local, 'like'), split(local, 'dislike'))
      setResult(res)
      setTiles(res.picks)
      setReserve(res.reserve)
      setStage('result')
      requestAnimationFrame(() =>
        sectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        }),
      )
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? err.message
          : "Dan couldn't reach the studio just now. Your answers are saved, so try again in a moment.",
      )
      setStage('questions')
    }
  }

  function remember(productId: string, verdict: Verdict | null) {
    setVerdicts((v) => {
      const next = { ...v }
      if (verdict) next[productId] = verdict
      else delete next[productId]
      if (!user) localStorage.setItem(FEEDBACK_KEY, JSON.stringify(next))
      return next
    })
    if (user) void sendStudioFeedback(productId, verdict ?? 'clear').catch(() => undefined)
  }

  // Swap the tile at `index` for the next reserve pick; skipped ones go to the back of the line.
  function swap(index: number, keepSkipped: boolean) {
    if (!reserve.length) return
    const [next, ...rest] = reserve
    const skipped = tiles[index]
    setTiles((t) => t.map((tile, i) => (i === index ? next : tile)))
    setReserve(keepSkipped ? [...rest, skipped] : rest)
  }

  function like(pick: StudioPick) {
    const liked = verdicts[pick.product.product_id] === 'like'
    remember(pick.product.product_id, liked ? null : 'like')
    if (!liked) addDwell(pick.product.product_id, 30) // the falling leaves and "picked for you" learn it too
  }

  function notForMe(index: number) {
    remember(tiles[index].product.product_id, 'dislike')
    swap(index, false)
  }

  if (stage === 'teaser') {
    return (
      <section className="studio studio-teaser reveal" aria-label="Design studio" ref={sectionRef}>
        <div className="studio-teaser-art" aria-hidden="true">
          <GarmentMockup
            concept={{
              name: 'Sketch',
              tagline: '',
              garment: 'crewneck',
              base_color: 'yale navy',
              accent_color: 'cream',
              material: '',
              logo_text: 'YALE',
              placement: 'center chest',
              details: [],
              inspired_by_note: '',
              why_it_fits: '',
            }}
          />
        </div>
        <div>
          <p className="eyebrow">The design studio</p>
          <h2>
            {onProductPage ? 'Not quite your style? Pitch the next piece.' : 'Pitch the next Campus Customs piece'}
          </h2>
          <p className="muted">
            Tell Dan your vibe, colors, and which Yale logo goes where. He'll sketch an original design for our team and
            pick pieces from the shop that fit you today, each with a note on why.
            {remembered && ` Welcome back${user ? `, ${user.first_name}` : ''}: Dan remembers your style.`}
          </p>
          <button className="btn btn-primary" onClick={() => setStage('questions')}>
            Start designing
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="studio" aria-label="Design studio" ref={sectionRef}>
      <header className="studio-head">
        <Dan size={44} />
        <div>
          <p className="eyebrow">The design studio</p>
          <h2>{stage === 'result' && result ? "Dan's pitch for you" : 'Tell Dan your vibe'}</h2>
        </div>
        <button className="studio-close" onClick={() => setStage('teaser')} aria-label="Close the studio">
          ×
        </button>
      </header>

      {stage === 'questions' && (
        <form
          className="studio-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (step < STEPS.length - 1) setStep(step + 1)
            else void pitch()
          }}
        >
          <ol className="studio-steps" aria-label="Steps">
            {STEPS.map((s, i) => (
              <li key={s} className={i === step ? 'current' : i < step ? 'done' : ''}>
                <button type="button" onClick={() => setStep(i)}>
                  {i + 1}. {s}
                </button>
              </li>
            ))}
          </ol>

          {step === 0 && (
            <>
              <Chips label="What's the vibe?" options={VIBES} value={answers.vibe} onChange={(v) => set('vibe', v)} />
              <Chips
                label="How do you like it to fit?"
                options={FITS}
                value={answers.fit}
                onChange={(v) => set('fit', v)}
              />
              <Chips
                label="Where will you wear it?"
                options={OCCASIONS}
                value={answers.occasion}
                onChange={(v) => set('occasion', v)}
              />
            </>
          )}
          {step === 1 && (
            <>
              <Chips
                label="What kind of piece?"
                options={GARMENTS}
                value={answers.garment}
                onChange={(v) => set('garment', v)}
              />
              <Chips
                label="Colors (up to 4)"
                options={COLORS}
                value={answers.colors}
                onChange={(v) => toggle('colors', v, 4)}
                swatches
              />
              <Chips
                label="Materials (up to 3)"
                options={MATERIALS}
                value={answers.materials}
                onChange={(v) => toggle('materials', v, 3)}
              />
            </>
          )}
          {step === 2 && (
            <>
              <Chips label="Which Yale logo?" options={LOGOS} value={answers.logo} onChange={(v) => set('logo', v)} />
              {(answers.logo === 'college crest' || answers.logo === 'school or sport') && (
                <label className="studio-text">
                  Which one?
                  <input
                    value={answers.logo_detail}
                    maxLength={40}
                    placeholder={
                      answers.logo === 'college crest' ? 'e.g. Berkeley, Davenport' : 'e.g. Rowing, Law School'
                    }
                    onChange={(e) => set('logo_detail', e.target.value)}
                  />
                </label>
              )}
              <Chips
                label="Where does it go?"
                options={PLACEMENTS}
                value={answers.placement}
                onChange={(v) => set('placement', v)}
              />
              <label className="studio-text">
                Inspired by…
                <input
                  value={answers.inspired_by}
                  maxLength={160}
                  placeholder="e.g. 90s vintage sweatshirts, Sterling Library at night, old rowing photos"
                  onChange={(e) => set('inspired_by', e.target.value)}
                />
              </label>
              <label className="studio-text">
                Anything else? Describe it in your own words
                <textarea
                  value={answers.notes}
                  maxLength={240}
                  rows={2}
                  placeholder="e.g. something warm for late nights, a gift for my dad who rowed"
                  onChange={(e) => set('notes', e.target.value)}
                />
              </label>
            </>
          )}

          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}
          <div className="studio-nav">
            {step > 0 && (
              <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)}>
                Back
              </button>
            )}
            <button type="submit" className="btn btn-primary">
              {step < STEPS.length - 1 ? 'Next' : 'Pitch it, Dan'}
            </button>
          </div>
        </form>
      )}

      {stage === 'sketching' && (
        <div className="studio-sketching" role="status" aria-live="polite">
          <div className="studio-pencil" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p>{SKETCHING[sketchLine]}</p>
        </div>
      )}

      {stage === 'result' && result && (
        <div className="studio-result">
          <div className="studio-concept">
            <figure className="studio-sketch">
              <GarmentMockup concept={result.concept} />
              <figcaption>Concept sketch · not for sale</figcaption>
            </figure>
            <div className="studio-concept-text">
              <p className="studio-pitch-no">Pitch no. {result.pitch_id}, sent to the Campus Customs team</p>
              <h3>{result.concept.name}</h3>
              <p className="studio-tagline">{result.concept.tagline}</p>
              <dl className="studio-specs">
                <div>
                  <dt>Colors</dt>
                  <dd>
                    <span
                      className="studio-swatch"
                      style={{
                        background: colorHex(result.concept.base_color),
                      }}
                    />
                    {result.concept.base_color}
                    <span
                      className="studio-swatch"
                      style={{
                        background: colorHex(result.concept.accent_color),
                      }}
                    />
                    {result.concept.accent_color}
                  </dd>
                </div>
                <div>
                  <dt>Material</dt>
                  <dd>{result.concept.material}</dd>
                </div>
                <div>
                  <dt>Logo</dt>
                  <dd>
                    “{result.concept.logo_text}” on the {result.concept.placement}
                  </dd>
                </div>
              </dl>
              <ul className="studio-details">
                {result.concept.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              <p>
                <strong>The inspiration:</strong> {result.concept.inspired_by_note}
              </p>
              <p>
                <strong>Why it's you:</strong> {result.concept.why_it_fits}
              </p>
            </div>
          </div>

          <h3 className="studio-picks-title">
            In the shop now: Dan's picks for your vibe
            <small>Like the ones you'd wear; Dan learns your style.</small>
          </h3>
          <div className="studio-picks">
            {tiles.map((pick, i) => {
              const id = pick.product.product_id
              const liked = verdicts[id] === 'like'
              return (
                <article key={id} className={`studio-pick ${liked ? 'liked' : ''}`}>
                  <Link to={`/products/${id}`} className="studio-pick-link">
                    <img src={pick.product.image_url} alt="" />
                    <span className="studio-pick-name">{pick.product.name}</span>
                    <strong>{formatPrice(pick.product.price)}</strong>
                  </Link>
                  <p className="studio-why">
                    <Dan size={22} />
                    <span>{pick.why}</span>
                  </p>
                  <div className="studio-pick-actions">
                    <button type="button" aria-pressed={liked} onClick={() => like(pick)} className="studio-like">
                      {liked ? '♥ Liked' : '♡ Like'}
                    </button>
                    <button type="button" onClick={() => notForMe(i)}>
                      Not for me
                    </button>
                    <button type="button" onClick={() => swap(i, true)} disabled={!reserve.length}>
                      Show another
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
          {!reserve.length && (
            <p className="muted studio-out">That's every pick in this batch. Pitch another idea for a fresh set.</p>
          )}
          <p className="studio-styling">
            <strong>How to wear them:</strong> {result.styling_note}
          </p>
          <div className="studio-nav">
            <button className="btn btn-ghost" onClick={() => setStage('questions')}>
              Edit my answers
            </button>
            <button className="btn btn-primary" onClick={() => void pitch()}>
              Pitch another idea
            </button>
          </div>
          <p className="studio-saved">
            {result.saved_to_account ? (
              'Saved to your account: Dan remembers your style and likes, in the studio and in chat.'
            ) : (
              <>
                Your likes are saved in this browser. <Link to="/login">Log in</Link> to keep your style with your
                account.
              </>
            )}
          </p>
        </div>
      )}
    </section>
  )
}
