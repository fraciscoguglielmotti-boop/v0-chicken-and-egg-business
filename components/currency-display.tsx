"use client"

import { useBalanceVisibility } from "@/contexts/balance-visibility"
import { formatCurrency } from "@/lib/utils"

interface CurrencyDisplayProps {
  amount: number
  className?: string
}

export function CurrencyDisplay({ amount, className }: CurrencyDisplayProps) {
  const { hidden } = useBalanceVisibility()
  return <span className={className}>{hidden ? "••••••" : formatCurrency(amount)}</span>
}
