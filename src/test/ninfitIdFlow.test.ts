import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('..', import.meta.url))

const app = readFileSync(
  join(SRC, 'App.tsx'),
  'utf8',
)

const screen = readFileSync(
  join(SRC, 'ui', 'screens', 'NinFitIdScreen.tsx'),
  'utf8',
)

describe('NinFit ID entry flow', () => {
  it('has a dedicated NinFit ID screen', () => {
    expect(screen).toContain('Take your journey with you.')
  })

  it('explicitly keeps accounts optional', () => {
    expect(screen).toContain('NinFit works without an account')
    expect(screen).toContain('Not now')
  })

  it('offers email as the working account path', () => {
    expect(screen).toContain('Continue with email')
  })

  it('shows Google without pretending it is active yet', () => {
    expect(screen).toContain('Continue with Google')
    expect(screen).toContain('coming soon')
  })

  it('shows Apple without pretending it is active yet', () => {
    expect(screen).toContain('Continue with Apple')
  })

  it('shows the ID screen after onboarding completes', () => {
    expect(app).toContain('setShowNinFitId(true)')
  })

  it('does not show the ID screen when onboarding is merely dismissed', () => {
    expect(app).toContain('setDismissedOnboarding(true)')
  })

  it('lets a user skip the ID screen into Today', () => {
    expect(app).toContain("window.location.hash = '#/today'")
  })

  it('keeps one shared selected-path app root', () => {
    const occurrences = [...app.matchAll(/data-path=/g)]

    expect(occurrences).toHaveLength(1)
    expect(app).toContain(
      '<div className="app" data-path={game.state.pathId}>',
    )
  })

  it('hides the normal tab bar during the ID decision screen', () => {
    expect(app).toContain('!showNinFitId ? (')
    expect(app).toContain(
      '<TabBar current={tab} onSelect={setTab} />',
    )
  })
})
