// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NinFitIdScreen } from '../ui/screens/NinFitIdScreen'

afterEach(cleanup)

describe('NinFit ID without Supabase configuration', () => {
  it('keeps the local-first app usable instead of throwing', () => {
    const onSkip = vi.fn()
    render(<NinFitIdScreen onSkip={onSkip} supabaseConfigured={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Continue with email' }))

    expect(screen.getByRole('heading', { name: 'NinFit ID is not available locally.' })).toBeTruthy()
    expect(screen.getByText(/fitness app still works normally/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Continue to Today' }))
    expect(onSkip).toHaveBeenCalledOnce()
  })
})
