export interface ProductSummary {
  product_id: string
  name: string
  garment_type: string
  short_description: string
  price: number
  image_url: string
  colors: string[]
  total_stock: number
}

export interface SizeStock {
  size: string
  quantity: number
}

export interface ProductDetail extends ProductSummary {
  description: string
  search_tags: string[]
  sizes: SizeStock[]
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

// POST /api/chat response: the agent's structured product matches, rendered as cards on the page.
export interface ChatReply {
  reply: string
  ok: boolean // false when the reply is an error message
  results_title: string | null
  products: ProductSummary[]
}

export interface ChatResults {
  id: number // changes on every new answer, so the page can re-animate
  title: string
  query: string
  products: ProductSummary[]
}

export interface User {
  id: number
  first_name: string
  last_name: string
  email: string
}

export interface RegisterInput {
  first_name: string
  last_name: string
  email: string
  password: string
  confirm_password: string
}

// Where the shopper is when they send a chat message (Problem 8).
export interface PageContext {
  path: string
  product_id: string | null
  search_query: string | null
  visible_product_ids: string[]
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
  products: ProductSummary[]
  created_at: string
}

// Design studio (Problem 12 feature)
export type Vibe = 'classic ivy' | 'game day' | 'cozy' | 'vintage' | 'minimal' | 'sporty' | 'preppy'
export type Fit = 'fitted' | 'regular' | 'relaxed' | 'oversized'
export type Occasion = 'class and library' | 'game day' | 'family weekend' | 'reunion' | 'gift' | 'gym' | 'night out'
export type Garment = 'hoodie' | 'crewneck' | 't-shirt' | 'quarter-zip' | 'jacket'
export type Logo = 'yale wordmark' | 'y monogram' | 'bulldog' | 'college crest' | 'school or sport' | 'est. 1701'
export type Placement = 'left chest' | 'center chest' | 'sleeve' | 'back' | 'hood'

export interface StudioAnswers {
  vibe: Vibe
  fit: Fit
  occasion: Occasion
  garment: Garment | 'surprise me'
  colors: string[]
  materials: string[]
  logo: Logo
  logo_detail: string
  placement: Placement
  inspired_by: string
  notes: string
}

export interface StudioConcept {
  name: string
  tagline: string
  garment: Garment
  base_color: string
  accent_color: string
  material: string
  logo_text: string
  placement: Placement
  details: string[]
  inspired_by_note: string
  why_it_fits: string
}

export interface StudioPick {
  product: ProductSummary
  why: string
}

export interface StudioResult {
  pitch_id: number
  concept: StudioConcept
  picks: StudioPick[]
  reserve: StudioPick[]
  styling_note: string
  saved_to_account: boolean
}

export interface StudioProfile {
  answers: StudioAnswers | null
  liked: string[]
  disliked: string[]
}
