import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const accountSection = readFileSync(
  fileURLToPath(new URL('../ui/components/AccountSection.tsx', import.meta.url)),
  'utf8',
)

describe('Profile optional-account boundary', () => {
  it('does not start Supabase session wiring when NinFit ID is not configured', () => {
    expect(accountSection).toContain("import { isSupabaseConfigured } from '../../data/supabase/env'")
    expect(accountSection).toContain('if (!isSupabaseConfigured) return undefined')
    expect(accountSection.indexOf('if (!isSupabaseConfigured) return undefined')).toBeLessThan(
      accountSection.indexOf('getSession()'),
    )
  })

  it('renders an honest local-only account state instead of crashing Profile', () => {
    expect(accountSection).toContain('Not available in this build')
    expect(accountSection).toContain('NinFit still works without an account')
    expect(accountSection).toContain('Your fitness records remain on this')
  })

  it('contains the auth subscription inside a fail-closed synchronous guard', () => {
    const subscriptionStart = accountSection.indexOf('try {\n      unsubscribe = onAuthStateChange')
    const subscriptionCatch = accountSection.indexOf('} catch (caught)', subscriptionStart)
    expect(subscriptionStart).toBeGreaterThan(-1)
    expect(subscriptionCatch).toBeGreaterThan(subscriptionStart)
  })
})
