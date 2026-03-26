"use client"

import React from "react"
import { Button } from "@/components/ui/button"

interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error.message, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <svg className="h-8 w-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Algo salió mal</h2>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
              {this.state.error?.message ?? "Error inesperado en la aplicación"}
            </p>
          </div>
          <Button onClick={() => this.setState({ hasError: false, error: null })}>
            Reintentar
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
