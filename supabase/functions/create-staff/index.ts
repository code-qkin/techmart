import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Verify the caller is an authenticated CEO/admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401 })

    // Use anon key to verify the caller's JWT and role
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await callerClient.auth.getUser()
    if (userError || !user) return new Response('Unauthorized', { status: 401 })

    const { data: profile } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['ceo', 'admin'].includes(profile.role)) {
      return new Response('Forbidden — only CEO/admin can create staff', { status: 403 })
    }

    // Now use the service role key (lives only here, never in the browser)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { email, password, fullName, role, phone } = await req.json()

    if (!email || !password || !fullName || !role) {
      return new Response('Missing required fields', { status: 400 })
    }

    const validRoles = ['ceo', 'admin', 'secretary']
    if (!validRoles.includes(role)) {
      return new Response('Invalid role', { status: 400 })
    }

    const { data, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createError) throw createError
    if (!data.user) throw new Error('Failed to create user')

    const { error: profileError } = await adminClient
      .from('profiles')
      .update({ name: fullName, role, phone: phone || null, is_active: true })
      .eq('id', data.user.id)
    if (profileError) throw profileError

    return new Response(JSON.stringify({ id: data.user.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
