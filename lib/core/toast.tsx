'use client'

// CANONICAL: lib/core/toast.tsx — minimal toast primitive shared by dashboard
// pages. One toast at a time, auto-dismisses after 4s, accessible roles.

import { useCallback, useEffect, useState } from 'react'

export type ToastTone = 'success' | 'error'

export interface Toast {
  id: number
  message: string
  tone: ToastTone
}

export function useToast() {
  const [toast, setToast] = useState<Toast | null>(null)
  const showToast = useCallback((message: string, tone: ToastTone = 'success') => {
    setToast({ id: Date.now(), message, tone })
  }, [])
  return { toast, showToast }
}

export function ToastViewport({ toast }: { toast: Toast | null }) {
  const [visible, setVisible] = useState<Toast | null>(null)

  useEffect(() => {
    if (!toast) return
    setVisible(toast)
    const timer = setTimeout(() => {
      setVisible((current) => (current?.id === toast.id ? null : current))
    }, 4000)
    return () => clearTimeout(timer)
  }, [toast])

  if (!visible) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div
        role={visible.tone === 'error' ? 'alert' : 'status'}
        className={`animate-pop pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
          visible.tone === 'error'
            ? 'border border-rose-200 bg-rose-50 text-rose-800'
            : 'border border-emerald-200 bg-emerald-50 text-emerald-800'
        }`}
      >
        {visible.message}
      </div>
    </div>
  )
}
