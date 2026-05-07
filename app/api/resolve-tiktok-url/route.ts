import { NextRequest, NextResponse } from 'next/server'

// Resolves TikTok short links (tiktok.com/t/, vm.tiktok.com/, vt.tiktok.com/)
// to their canonical /@user/video/<id> form by following redirects server-side.
// CORS-restricted on the browser, so it has to live on the server.

function isTikTokUrl(url: string): boolean {
  return /(?:^|\.)tiktok\.com/i.test(url)
}

export async function POST(req: NextRequest) {
  let url: string | undefined
  try {
    const body = await req.json()
    url = typeof body?.url === 'string' ? body.url.trim() : undefined
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  if (!url) return NextResponse.json({ error: 'URL requerida' }, { status: 400 })
  if (!/^https?:\/\//i.test(url)) return NextResponse.json({ error: 'URL inválida' }, { status: 400 })
  if (!isTikTokUrl(url)) return NextResponse.json({ error: 'No es una URL de TikTok' }, { status: 400 })

  try {
    // GET (not HEAD) — TikTok's short-link redirectors return 405 for HEAD.
    // A real User-Agent avoids the bot/CAPTCHA wall TikTok serves to default
    // fetch UAs.
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })

    const finalUrl = res.url
    if (!finalUrl || !isTikTokUrl(finalUrl)) {
      return NextResponse.json({ error: 'No se pudo resolver el link' }, { status: 502 })
    }

    // Strip query string / tracking params — TikTok appends ?_t=…&_r=… etc.
    // when sharing. The canonical form is /@handle/video/<id>.
    const cleaned = finalUrl.split('?')[0]
    return NextResponse.json({ resolvedUrl: cleaned })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al resolver link'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
