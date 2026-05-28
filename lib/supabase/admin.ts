import { createClient } from '@supabase/supabase-js'

// Service-role client for server-side admin work. RLS is bypassed, so this
// MUST never be imported into client code. autoRefreshToken/persistSession
// are off because there's no browser session to maintain in a serverless
// request — keeping them on can leak state across invocations.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
