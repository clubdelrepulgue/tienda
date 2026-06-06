export const FIRST_VISIT_PRELOADER_STORAGE_KEY = 'blazr:first-visit-preloader:v1'

export const FIRST_VISIT_PRELOADER_TEXTS = [
  'Diseño',
  'e-commerce',
  'pedidos',
  'cocina',
  'todo en un solo lugar',
  'para restaurantes',
  'comida rápida',
]

export const FIRST_VISIT_PRELOADER_MORPH_TIME = 1.35
export const FIRST_VISIT_PRELOADER_COOLDOWN_TIME = 0.45

export const FIRST_VISIT_PRELOADER_DURATION_MS = 2800

export function shouldRunFirstVisitPreloader(pathname: string | null | undefined) {
  if (!pathname) {
    return false
  }

  return pathname === '/landing' || pathname.startsWith('/menu')
}
