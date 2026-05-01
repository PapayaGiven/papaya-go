import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Public routes
  if (path === '/admin' || path.startsWith('/api/')) {
    return supabaseResponse
  }

  // Not logged in → go to login (root)
  if (!user && path !== '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Logged in: route by is_internal flag
  if (user) {
    const { data: creator } = await supabase
      .from('go_creators')
      .select('is_internal, status')
      .eq('email', user.email!)
      .maybeSingle()

    const isInternal = creator?.is_internal === true

    if (path === '/') {
      const url = request.nextUrl.clone()
      url.pathname = isInternal ? '/internal-dashboard' : '/dashboard'
      return NextResponse.redirect(url)
    }

    // Internal creators: don't render the regular dashboard
    if (isInternal && path === '/dashboard') {
      const url = request.nextUrl.clone()
      url.pathname = '/internal-dashboard'
      return NextResponse.redirect(url)
    }

    // Regular creators: don't render the internal dashboard
    if (!isInternal && path.startsWith('/internal-dashboard')) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|manifest.json|sw.js).*)'],
}
