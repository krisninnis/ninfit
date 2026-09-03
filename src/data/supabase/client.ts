import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { supabaseEnv } from './env'

export const supabase = supabaseEnv
  ? createClient<Database>(
      supabaseEnv.url,
      supabaseEnv.publishableKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      },
    )
  : null
