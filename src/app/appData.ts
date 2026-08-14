import { createSeedAppData } from '../domain/defaults';
import type { AppData } from '../domain/types';
import type { Repository } from '../storage/repository';

/**
 * Assemble the in-memory aggregate from the repository.
 *
 * Reading only. This is NOT export: no serialisation, no envelope, no file. Step 7
 * will build export on top of the same read, which is exactly why it lives here in
 * the application layer rather than in either the domain or the repository.
 *
 * The fallbacks matter. A missing profile or baseline means either a very early
 * first run or a key that could not be read, and in both cases the screens need
 * something coherent to render. They fall back to the seeded shape WITHOUT writing
 * anything, so a corrupt record is never quietly replaced on disk.
 */
export function readAppData(repository: Repository): AppData {
  const seed = createSeedAppData();

  return {
    meta: repository.getMeta() ?? seed.meta,
    profile: repository.getProfile() ?? seed.profile,
    healthContext: repository.getHealthContext() ?? seed.healthContext,
    baseline: repository.getBaseline() ?? seed.baseline,
    measurements: repository.getMeasurements(),
    weeklyPlans: repository.getWeeklyPlans(),
    dailyLogs: repository.listDailyLogs(),
    metricSamples: repository.getMetricSamples(),
  };
}
