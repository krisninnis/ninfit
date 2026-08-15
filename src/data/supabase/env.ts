const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL')
}

if (!supabasePublishableKey) {
  throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY')
}

export const supabaseEnv = Object.freeze({
  url: supabaseUrl,
  publishableKey: supabasePublishableKey,
})