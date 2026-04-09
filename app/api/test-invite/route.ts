import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()
  const testEmail = 'kamyla@papayagiven.com'
  const redirectTo = 'https://papaya-go.vercel.app/set-password'

  console.log('[test-invite] Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.log('[test-invite] Sending test invite to:', testEmail)
  console.log('[test-invite] Redirect URL:', redirectTo)

  try {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(
      testEmail,
      { redirectTo }
    )

    if (error) {
      console.error('[test-invite] ERROR:', JSON.stringify(error, null, 2))
      return NextResponse.json({
        success: false,
        error: {
          message: error.message,
          name: error.name,
          status: error.status,
          full: error,
        },
        config: {
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          testEmail,
          redirectTo,
        },
      }, { status: 400 })
    }

    console.log('[test-invite] SUCCESS:', JSON.stringify(data, null, 2))
    return NextResponse.json({
      success: true,
      user: {
        id: data.user?.id,
        email: data.user?.email,
        created_at: data.user?.created_at,
        invited_at: data.user?.invited_at,
      },
      config: {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        testEmail,
        redirectTo,
      },
    })
  } catch (err) {
    console.error('[test-invite] EXCEPTION:', err)
    return NextResponse.json({
      success: false,
      exception: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
    }, { status: 500 })
  }
}
