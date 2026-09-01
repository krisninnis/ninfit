import { describe, expect, it } from 'vitest';
import dataScreenSource from '../ui/screens/DataScreen.tsx?raw';
import useDataSource from '../ui/hooks/useData.ts?raw';

describe('Data backup transparency', () => {
  it('keeps Journeys explicit in backup and restore presentation', () => {
    expect(dataScreenSource).toMatch(/Includes your fitness history, Journeys, profile/i);
    expect(dataScreenSource).toContain('stat__label">Journeys');
    expect(dataScreenSource).toContain('hasJourneyData');
    expect(dataScreenSource).toContain('hasActiveJourney');
    expect(dataScreenSource).toMatch(/predates Journey backup support/i);
    expect(dataScreenSource).toMatch(/current Journey history will be\s+left alone/i);
  });

  it('shows descriptive version metadata before replacement', () => {
    expect(dataScreenSource).toContain('NinFit version');
    expect(dataScreenSource).toContain('pending.summary.appVersion');
    expect(dataScreenSource).toContain('Backup format');
    expect(dataScreenSource).toContain('pending.summary.schemaVersion');
    expect(dataScreenSource).not.toMatch(/safe because.*version/i);
    expect(dataScreenSource).not.toMatch(/trusted because.*schema/i);
  });

  it('warns before destructive device/browser actions without making site-data clearing an update step', () => {
    expect(dataScreenSource).toMatch(/Before replacing your phone/i);
    expect(dataScreenSource).toMatch(/removing the installed app/i);
    expect(dataScreenSource).toMatch(/clearing browser\/site data/i);
    expect(dataScreenSource).toMatch(/export a JSON backup/i);
    expect(dataScreenSource).toMatch(/should not need to clear site data just to get a newer NinFit build/i);
    expect(dataScreenSource).toMatch(/Closing and\s+reopening the installed app while online is the safe first step/i);
  });

  it('reports Journey restore outcomes from the import boundary', () => {
    expect(useDataSource).toContain('journeysRestored: result.journeysRestored');
    expect(useDataSource).toContain('activeJourneyRestored: result.activeJourneyRestored');
    expect(dataScreenSource).toContain('status.journeysRestored');
    expect(dataScreenSource).toContain('status.activeJourneyRestored');
  });
});
