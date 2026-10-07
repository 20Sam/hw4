import type {
  ChatHistoryMessage,
  ChatReply,
  ChatTurn,
  PageContext,
  ProductDetail,
  ProductSummary,
  RegisterInput,
  StudioAnswers,
  StudioProfile,
  StudioResult,
  User,
} from './types'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// FastAPI errors are either {"detail": "text"} or {"detail": [{loc, msg}, ...]}.
function errorMessage(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((d: { loc?: string[]; msg?: string }) => {
        const field = d.loc?.[d.loc.length - 1]?.replace('_', ' ') ?? 'field'
        return `${field[0].toUpperCase()}${field.slice(1)} ${(d.msg ?? '').replace(/^Value error, /, '')}`
      })
      .join('. ')
  }
  return fallback
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin', ...init })
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  if (!res.ok) throw new ApiError(res.status, errorMessage(body, `${res.status} ${res.statusText}`))
  return body as T
}

const postJson = <T>(url: string, data?: unknown) =>
  getJson<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  })

export function fetchProducts(q?: string): Promise<ProductSummary[]> {
  const params = q ? `?q=${encodeURIComponent(q)}` : ''
  return getJson(`/api/products${params}`)
}

export function fetchProduct(id: string): Promise<ProductDetail> {
  return getJson(`/api/products/${encodeURIComponent(id)}`)
}

export function sendChat(message: string, history: ChatTurn[], page: PageContext): Promise<ChatReply> {
  return postJson('/api/chat', { message, history, page })
}

export type ChatStreamEvent =
  | { type: 'status'; text: string }
  | { type: 'delta'; text: string }
  | { type: 'reset' }
  | { type: 'done'; response: ChatReply }

// Streams one chat turn from POST /api/chat/stream (newline-delimited JSON events).
export async function streamChat(
  message: string,
  history: ChatTurn[],
  page: PageContext,
  onEvent: (event: ChatStreamEvent) => void,
): Promise<void> {
  const res = await fetch('/api/chat/stream', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history, page }),
  })
  if (!res.ok || !res.body) {
    const text = await res.text()
    throw new ApiError(res.status, errorMessage(text ? JSON.parse(text) : null, `${res.status} ${res.statusText}`))
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finished = false
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let newline = buffer.indexOf('\n')
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (line) {
        const event = JSON.parse(line) as ChatStreamEvent
        if (event.type === 'done') finished = true
        onEvent(event)
      }
      newline = buffer.indexOf('\n')
    }
  }
  if (!finished) throw new ApiError(0, 'The reply was cut off.')
}

export const fetchChatHistory = () => getJson<ChatHistoryMessage[]>('/api/chat/history')
export const clearChatHistory = () => getJson<null>('/api/chat/history', { method: 'DELETE' })

export const fetchMe = () => getJson<User>('/api/auth/me')
export const login = (email: string, password: string) => postJson<User>('/api/auth/login', { email, password })
export const register = (input: RegisterInput) => postJson<User>('/api/auth/register', input)
export const logout = () => postJson<null>('/api/auth/logout')

export const formatPrice = (price: number) => price.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export interface Recommendations {
  kind: string
  more_like_this: ProductSummary[]
  other_colors: ProductSummary[]
  complete_the_look: { items: ProductSummary[]; note: string; total: number }
}

export const fetchRecommendations = (id: string) =>
  getJson<Recommendations>(`/api/products/${encodeURIComponent(id)}/recommendations`)

export const fetchForYou = (interests: Record<string, number>) =>
  postJson<{ product_ids: string[]; products: ProductSummary[] }>('/api/recommendations/for-you', { interests })

// Design studio: Dan pitches a new piece and picks real ones that fit (guests send their likes along).
export const generateStudio = (answers: StudioAnswers, liked: string[], disliked: string[]) =>
  postJson<StudioResult>('/api/studio/generate', { answers, liked, disliked })
export const fetchStudioProfile = () => getJson<StudioProfile>('/api/studio/profile')
export const sendStudioFeedback = (product_id: string, verdict: 'like' | 'dislike' | 'clear') =>
  postJson<null>('/api/studio/feedback', { product_id, verdict })
