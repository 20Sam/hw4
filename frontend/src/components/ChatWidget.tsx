import { Fragment, useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ApiError, clearChatHistory, fetchChatHistory, formatPrice, streamChat } from '../api'
import { useAuth } from '../auth'
import { useChatResults } from '../chatResults'
import type { PageContext, ProductSummary, User } from '../types'
import Dan from './Dan'

interface Message {
  role: 'user' | 'assistant'
  content: string
  products?: ProductSummary[]
  status?: string // live "Checking stock…" line while the reply is being prepared
  streaming?: boolean
  failed?: boolean // error replies: shown, but never sent back to the model as history
  greeting?: boolean // the built-in welcome line
}

const MAX_MESSAGE = 1000 // same limit as the backend

const HISTORY_LIMIT = 10 // guests: earlier messages sent along so follow-ups make sense

function greeting(user: User | null): Message {
  return {
    role: 'assistant',
    greeting: true,
    content: user
      ? `Hi ${user.first_name}! Dan here, welcome back. Ask me about hoodies, sizes, prices, or what's in stock.`
      : "Woof, I'm Dan, the Campus Customs bulldog. Ask me about hoodies, sizes, prices, or what's in stock.",
  }
}

// Show **bold** from saved replies as bold instead of asterisks.
function renderText(text: string): ReactNode {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    )
}

export default function ChatWidget() {
  const { user } = useAuth()
  const { results, show, clear } = useChatResults()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([greeting(null)])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // Each send gets an id; events from an older stream (after New chat, log in, or log out) are ignored.
  const requestId = useRef(0)
  const [nudge, setNudge] = useState(false)
  const onProductPage = /^\/products\/[^/]+$/.test(location.pathname)
  const suggestions = onProductPage
    ? ['Is this in my size?', 'What size should I get?', 'Show me similar styles']
    : ["What's good for game day?", 'Hoodies under $70', 'Help me find my size', 'A gift for a Yale dad']

  // A one-time friendly nudge from Dan, a few seconds into the first visit.
  useEffect(() => {
    if (open || localStorage.getItem('cc-nudged')) return
    const timer = window.setTimeout(() => setNudge(true), 7000)
    return () => window.clearTimeout(timer)
  }, [open])

  function dismissNudge() {
    setNudge(false)
    localStorage.setItem('cc-nudged', '1')
  }

  // Signed in: reload saved chat history. Guest or logged out: start fresh.
  useEffect(() => {
    let cancelled = false
    requestId.current += 1 // drop any reply still streaming for the previous shopper
    setSending(false)
    clear() // the previous shopper's chat results shouldn't stay on the page
    if (!user) {
      setMessages([greeting(null)])
      return
    }
    fetchChatHistory()
      .then((saved) => {
        if (cancelled) return
        const restored = saved.map((m) => ({
          role: m.role,
          content: m.content,
          products: m.products,
        }))
        setMessages([...restored, greeting(user)])
      })
      .catch(() => !cancelled && setMessages([greeting(user)]))
    return () => {
      cancelled = true
    }
  }, [user, clear])

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, sending, open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // What the agent needs to know about the page: which product is on screen, the search box,
  // and which chat cards are showing. The backend checks every product ID against the database.
  function pageContext(): PageContext {
    const productMatch = location.pathname.match(/^\/products\/([^/]+)$/)
    const query = location.pathname === '/products' ? new URLSearchParams(location.search).get('q') : null
    return {
      path: location.pathname.slice(0, 200),
      product_id: productMatch ? decodeURIComponent(productMatch[1]).slice(0, 120) : null,
      search_query: query ? query.slice(0, 100) : null,
      visible_product_ids: results?.products.map((p) => p.product_id) ?? [],
    }
  }

  async function send(e?: FormEvent, preset?: string) {
    e?.preventDefault()
    const text = (preset ?? input).trim()
    if (!text || sending || text.length > MAX_MESSAGE) return
    // Always send this tab's conversation: the server ignores it for signed-in shoppers (it reads their
    // saved history), and it still works if the session ran out. Greeting, error, and empty bubbles are skipped.
    const history = messages
      .filter((m) => m.content && !m.failed && !m.streaming && !m.greeting)
      .slice(-HISTORY_LIMIT)
      .map(({ role, content }) => ({ role, content: content.slice(0, 4000) }))
    const myId = ++requestId.current
    setInput('')
    setMessages((m) => [
      ...m,
      { role: 'user', content: text },
      { role: 'assistant', content: '', streaming: true, status: 'Thinking…' },
    ])
    setSending(true)
    // Update the reply bubble that is being streamed (the last message), unless this send is stale.
    const updateLast = (change: (last: Message) => Message) => {
      if (myId !== requestId.current) return
      setMessages((m) => (m.length && m[m.length - 1].streaming ? [...m.slice(0, -1), change(m[m.length - 1])] : m))
    }
    try {
      await streamChat(text, history, pageContext(), (event) => {
        if (event.type === 'status') updateLast((last) => ({ ...last, status: event.text }))
        else if (event.type === 'delta')
          updateLast((last) => ({
            ...last,
            content: last.content + event.text,
          }))
        else if (event.type === 'reset')
          updateLast((last) => ({
            ...last,
            content: '',
            status: 'Double-checking…',
          }))
        else if (event.type === 'done') {
          const res = event.response
          if (myId !== requestId.current) return
          updateLast(() => ({
            role: 'assistant',
            content: res.reply,
            products: res.products,
            failed: !res.ok,
          }))
          show(res.results_title, text, res.products) // put the matching cards on the page
        }
      })
    } catch (err) {
      // Show the server's own message for 4xx answers (too fast, too long); otherwise a friendly note.
      const content =
        err instanceof ApiError && err.status >= 400 && err.status < 500
          ? err.message
          : "Sorry, I couldn't reach the shop right now. Please try again in a moment."
      updateLast(() => ({ role: 'assistant', content, failed: true }))
    } finally {
      if (myId === requestId.current) setSending(false)
    }
  }

  // Other parts of the site (product page chips) can ask Dan a question: open the chat and send it.
  const sendRef = useRef(send)
  useEffect(() => {
    sendRef.current = send
  })
  useEffect(() => {
    const onAsk = (e: Event) => {
      setOpen(true)
      dismissNudge()
      void sendRef.current(undefined, (e as CustomEvent<string>).detail)
    }
    window.addEventListener('cc-ask', onAsk)
    return () => window.removeEventListener('cc-ask', onAsk)
  }, [])

  async function newChat() {
    if (user) {
      try {
        await clearChatHistory()
      } catch {
        return
      }
    }
    setMessages([greeting(user)])
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className={`chat ${open ? 'chat-open' : ''}`}>
      {open && (
        <section className="chat-panel" aria-label="Shop assistant chat">
          <header className="chat-header">
            <Dan size={40} className="chat-header-dan" />
            <div className="chat-header-text">
              <p className="chat-title">Dan · Shop assistant</p>
              <p className="chat-subtitle">
                {user ? `Signed in as ${user.first_name} · chat saved` : 'Guest chat · log in to save it'}
              </p>
            </div>
            <div className="chat-header-actions">
              <button
                className="chat-new"
                onClick={newChat}
                disabled={sending}
                title={user ? 'Delete saved chat and start over' : 'Start over'}
              >
                New chat
              </button>
              <button className="chat-close" onClick={() => setOpen(false)} aria-label="Close chat">
                ×
              </button>
            </div>
          </header>

          <div className="chat-messages" ref={listRef}>
            {messages.map((m, i) => (
              <div key={i} className={`chat-row chat-row-${m.role}`}>
                {m.role === 'assistant' && <Dan size={26} className="chat-avatar" />}
                <div className={`chat-msg chat-msg-${m.role} ${m.streaming ? 'chat-msg-streaming' : ''}`}>
                  {m.streaming && !m.content ? (
                    <div className="chat-status" aria-live="polite">
                      <span className="chat-typing" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                      {m.status}
                    </div>
                  ) : (
                    <p>
                      {renderText(m.content)}
                      {m.streaming && <span className="chat-caret" aria-hidden="true" />}
                    </p>
                  )}
                  {m.products && m.products.length > 0 && (
                    <div className="chat-products">
                      {m.products.length > 3 &&
                        (onProductPage ? (
                          <p className="chat-products-note">
                            Top 3 of {m.products.length}. <Link to="/products">See them all in the shop →</Link>
                          </p>
                        ) : (
                          <p className="chat-products-note">All {m.products.length} are on the page. Top picks:</p>
                        ))}
                      {m.products.slice(0, 3).map((p) => (
                        <Link key={p.product_id} to={`/products/${p.product_id}`} className="chat-product">
                          <img src={p.image_url} alt="" />
                          <span>{p.name}</span>
                          <strong>{formatPrice(p.price)}</strong>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {!sending && (
            <div className="chat-suggestions" aria-label="Suggested questions">
              {suggestions.map((q) => (
                <button key={q} type="button" onClick={() => send(undefined, q)}>
                  {q}
                </button>
              ))}
            </div>
          )}

          <form className="chat-input" onSubmit={send}>
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              placeholder="Ask about a product…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              maxLength={MAX_MESSAGE}
              aria-label="Chat message"
            />
            <button type="submit" disabled={!input.trim() || sending}>
              Send
            </button>
          </form>
        </section>
      )}

      {nudge && !open && (
        <div className="chat-nudge" role="status">
          <button className="chat-nudge-close" onClick={dismissNudge} aria-label="Dismiss">
            ×
          </button>
          <p>
            Need a size or a gift idea? <strong>Ask Dan.</strong> I check live stock.
          </p>
        </div>
      )}
      <button
        className="chat-launcher"
        onClick={() => {
          setOpen((o) => !o)
          dismissNudge()
        }}
        aria-expanded={open}
        aria-label={open ? 'Close chat' : 'Chat with Dan, the shop assistant'}
      >
        {open ? (
          <span className="chat-launcher-close">×</span>
        ) : (
          <>
            <Dan size={34} />
            <span className="chat-launcher-text">Ask Dan</span>
          </>
        )}
      </button>
    </div>
  )
}
