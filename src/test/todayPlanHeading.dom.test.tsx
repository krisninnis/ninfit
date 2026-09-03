// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TodayPlanHeading } from '../ui/screens/TodayScreen';

afterEach(cleanup);

describe('Today plan heading', () => {
  it('renders the normal planned-day heading as user-visible text', () => {
    render(<TodayPlanHeading isFirstDay={false} />);

    expect(screen.getByRole('heading', { name: 'Today’s session' })).toBeTruthy();
    expect(document.body.textContent).not.toContain('&rsquo;');
  });

  it('renders the first-day heading directly', () => {
    render(<TodayPlanHeading isFirstDay />);

    expect(screen.getByRole('heading', { name: 'Your first step' })).toBeTruthy();
  });
});
