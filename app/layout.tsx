import React from "react"
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/toaster'
import { BalanceVisibilityProvider } from '@/contexts/balance-visibility'
import { ThemeProvider } from '@/components/theme-provider'

import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'AviGest - Gestion de Distribuidora',
  description: 'Sistema integral de gestion para distribuidora de pollos y huevos',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <BalanceVisibilityProvider>
            {children}
          </BalanceVisibilityProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  )
}
