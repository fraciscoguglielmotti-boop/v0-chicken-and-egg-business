"use client"

import { createContext, useContext, useState } from "react"

interface BalanceVisibilityContextType {
  hidden: boolean
  toggle: () => void
}

const BalanceVisibilityContext = createContext<BalanceVisibilityContextType>({
  hidden: false,
  toggle: () => {},
})

export function BalanceVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false)
  return (
    <BalanceVisibilityContext.Provider value={{ hidden, toggle: () => setHidden((h) => !h) }}>
      {children}
    </BalanceVisibilityContext.Provider>
  )
}

export const useBalanceVisibility = () => useContext(BalanceVisibilityContext)
