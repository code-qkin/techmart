import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { StockStatus } from "../types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatNaira = (amount: number): string =>
  '₦' + amount.toLocaleString('en-NG')

export const getStockStatus = (
  stock: number,
  threshold: number
): StockStatus => {
  if (stock === 0) return 'out'
  if (stock <= threshold) return 'low'
  return 'in'
}

export const generateOrderId = (): string =>
  'TM-' + Math.floor(1000 + Math.random() * 9000)

export const getInitials = (name: string): string =>
  name.split(' ').map(n => n[0]).join('').toUpperCase()

const TECHNICAL_PATTERNS = [
  /VITE_/i, /supabase/i, /\.env/i, /service.?role/i, /service_key/i,
  /\bjwt\b/i, /postgres/i, /\bpq\b/i, /duplicate key/i, /foreign key/i,
  /violates.*constraint/i, /\.local\b/i, /fetch failed/i, /unexpected token/i,
  /http\s*[45]\d\d/i,
]

export function getErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!(err instanceof Error)) return fallback
  const msg = err.message

  if (/email.*already.*registered|user.*already.*registered|already.*exists/i.test(msg))
    return 'An account with this email already exists.'
  if (/too many requests|rate.?limit/i.test(msg))
    return 'Too many attempts. Please wait a moment and try again.'
  if (/network|failed to fetch|connection refused/i.test(msg))
    return 'Network error. Please check your connection and try again.'

  if (TECHNICAL_PATTERNS.some(p => p.test(msg))) return fallback
  return msg || fallback
}
