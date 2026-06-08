import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(value: number) {
  const roundedValue = Math.round((value + Number.EPSILON) * 100) / 100
  const hasDecimals = Math.abs(roundedValue % 1) > Number.EPSILON

  return `$${roundedValue.toFixed(hasDecimals ? 2 : 0)}`
}
