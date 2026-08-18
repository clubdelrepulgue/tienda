/**
 * Valida un `?next=` antes de redirigir tras el login. Sólo rutas internas del
 * panel: evita que un link armado mande a un dominio ajeno.
 *
 * Vive en su propio módulo (y no en `lib/supabase/middleware.ts`) para que la
 * página de login, que es un client component, pueda usarlo sin arrastrar
 * `next/server` ni el cliente de Supabase de servidor al bundle del navegador.
 */
export function safeAdminPath(value: string | null | undefined): string | null {
  if (!value) return null
  if (!value.startsWith("/admin")) return null
  // "//host" y "/\host" los interpreta el navegador como otro origen.
  if (/^\/[/\\]/.test(value)) return null
  if (value.startsWith("/admin/login")) return null
  return value
}
