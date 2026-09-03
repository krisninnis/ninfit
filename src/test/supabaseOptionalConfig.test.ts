import { describe, expect, it } from 'vitest'
import { resolveSupabaseEnv } from '../config/supabase'

describe('optional Supabase configuration', () => {
  it('keeps NinFit available when both account variables are absent', () => {
    expect(resolveSupabaseEnv({})).toBeNull()
  })

  it('fails closed when only half of the account configuration exists', () => {
    expect(resolveSupabaseEnv({ VITE_SUPABASE_URL: 'https://example.supabase.co' })).toBeNull()
    expect(resolveSupabaseEnv({ VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' })).toBeNull()
  })

  it('accepts and trims a complete public client configuration', () => {
    expect(
      resolveSupabaseEnv({
        VITE_SUPABASE_URL: '  https://example.supabase.co  ',
        VITE_SUPABASE_PUBLISHABLE_KEY: '  sb_publishable_test  ',
      }),
    ).toEqual({
      url: 'https://example.supabase.co',
      publishableKey: 'sb_publishable_test',
    })
  })
})
