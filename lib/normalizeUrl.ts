// Canonical form for comparing TikTok submission links. Trivial differences —
// surrounding whitespace, casing, a trailing slash — must NOT let the same
// video slip past duplicate detection, so every link is normalized the same way
// before it's compared or stored (admin "Agregar Videos" + internal dashboard).
export function normalizeTiktokUrl(url: string | null | undefined): string {
  return (url ?? '').trim().toLowerCase().replace(/\/+$/, '')
}
