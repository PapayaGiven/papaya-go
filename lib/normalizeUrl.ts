// Canonical form for comparing TikTok submission links. Trivial differences —
// surrounding whitespace, casing, a trailing slash, and (crucially) the tracking
// query string / hash that TikTok's share sheet appends (e.g. "?_r=1&_t=abc")
// must NOT let the same video slip past duplicate detection. So every link is
// normalized the same way before it's compared or stored (admin "Agregar Videos"
// + internal dashboard).
//
// Order matters: strip the hash and query FIRST, then the trailing slash — that
// way "https://vt.tiktok.com/ZSxPg8u3s/?_t=abc" and ".../zsxpg8u3s" collapse to
// the same value.
export function normalizeTiktokUrl(url: string | null | undefined): string {
  return (url ?? '')
    .trim()
    .toLowerCase()
    .replace(/#.*$/, '')   // drop the hash fragment
    .replace(/\?.*$/, '')  // drop tracking query params (?_r=1&_t=...)
    .replace(/\/+$/, '')   // drop trailing slash(es)
}
