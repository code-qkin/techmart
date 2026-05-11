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
