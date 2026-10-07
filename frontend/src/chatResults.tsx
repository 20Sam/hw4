import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { ChatResults, ProductSummary } from './types'

interface ChatResultsState {
  results: ChatResults | null
  show: (title: string | null, query: string, products: ProductSummary[]) => void
  clear: () => void
}

const ChatResultsContext = createContext<ChatResultsState | null>(null)

// Holds the product cards from the latest chat answer, so any page can show them and they
// survive navigating to a product page and back.
export function ChatResultsProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState<ChatResults | null>(null)

  const show = useCallback((title: string | null, query: string, products: ProductSummary[]) => {
    if (products.length === 0) return
    setResults({ id: Date.now(), title: title || 'From your chat', query, products })
  }, [])

  const clear = useCallback(() => setResults(null), [])

  return <ChatResultsContext.Provider value={{ results, show, clear }}>{children}</ChatResultsContext.Provider>
}

export function useChatResults(): ChatResultsState {
  const ctx = useContext(ChatResultsContext)
  if (!ctx) throw new Error('useChatResults must be used inside ChatResultsProvider')
  return ctx
}
