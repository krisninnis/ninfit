import { describe, expect, it } from 'vitest'
import settingsSource from '../ui/screens/SettingsScreen.tsx?raw'
import { resolveSupportEnv } from '../config/support'
import { buildSupportMailto, LOST_DATA_GUIDANCE } from '../ui/support'

const BUILD = {
  version: '0.1.0',
  channel: 'preview' as const,
  fingerprint: 'abc123.def456',
}

describe('support configuration', () => {
  it('fails closed unless both a plausible address and response commitment exist', () => {
    expect(resolveSupportEnv({})).toBeNull()
    expect(resolveSupportEnv({ VITE_SUPPORT_EMAIL: 'support@example.com' })).toBeNull()
    expect(
      resolveSupportEnv({
        VITE_SUPPORT_EMAIL: 'not-an-email',
        VITE_SUPPORT_RESPONSE_COMMITMENT: 'reply within three working days',
      }),
    ).toBeNull()
    expect(
      resolveSupportEnv({
        VITE_SUPPORT_EMAIL: ' support@example.com ',
        VITE_SUPPORT_RESPONSE_COMMITMENT: ' reply within three working days ',
      }),
    ).toEqual({
      email: 'support@example.com',
      responseCommitment: 'reply within three working days',
    })
  })
})

describe('support report draft', () => {
  it('contains release identity and no NinFit fitness, health, route or account payload', () => {
    const uri = buildSupportMailto(
      {
        email: 'support@example.com',
        responseCommitment: 'reply within three working days',
      },
      BUILD,
    )
    const decoded = decodeURIComponent(uri)

    expect(decoded).toContain('mailto:support@example.com')
    expect(decoded).toContain('Version: 0.1.0')
    expect(decoded).toContain('Channel: preview')
    expect(decoded).toContain('Build: abc123.def456')
    expect(decoded).toContain('What happened:')
    expect(decoded).not.toMatch(/latitude|longitude|route point|heart rate|health note|weight|waist|email address|ninfit id/i)
  })
})

describe('support surface copy', () => {
  it('states the honest local-first data-loss boundary', () => {
    expect(LOST_DATA_GUIDANCE).toMatch(/local-first/i)
    expect(LOST_DATA_GUIDANCE).toMatch(/cannot recover that history from a server/i)
    expect(LOST_DATA_GUIDANCE).toMatch(/backup somewhere outside this device/i)
  })

  it('only renders contact and response claims behind configured support', () => {
    expect(settingsSource).toContain('supportEnv !== null')
    expect(settingsSource).toContain('buildSupportMailto(supportEnv, build)')
    expect(settingsSource).toContain('supportEnv.responseCommitment')
    expect(settingsSource).toContain('LOST_DATA_GUIDANCE')
  })
})
