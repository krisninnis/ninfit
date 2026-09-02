import { useRef } from 'react';
import { STORAGE_KEYS, type StorageIssue } from '../../storage/repository';
import { Section } from '../components/Field';
import { AttentionIcon } from '../components/Icon';
import { Screen } from '../components/Screen';
import { formatLongDate } from '../format';
import { useData } from '../hooks/useData';

/**
 * Data portability.
 *
 * Two exports with genuinely different jobs, said plainly: JSON is the backup you
 * restore from, CSV is for looking at in a spreadsheet. Import replaces rather than
 * merges, takes a backup of what is here first, and asks before doing any of it.
 *
 * WEIGHT FOLLOWS CONSEQUENCE.
 *
 * The three actions used to be three identical full-width primary buttons, so the
 * backup you should actually take looked exactly like the spreadsheet that cannot be
 * restored from, which looked exactly like the restore that replaces everything. On
 * a screen whose own copy says this device is the only copy, that is the wrong shape.
 *
 * One primary action: the full backup. The everyday export and the entry to restore
 * are secondary. The confirmation inside restore keeps its attention styling, because
 * that is the step with consequences.
 *
 * ORDER.
 *
 *   Backup -> everyday export -> restore -> storage and privacy -> issues
 *
 * Explanation moved below the actions. It is worth reading once; it should not stand
 * between someone and the button they came for. What stays above everything is the
 * warning that this browser will not keep anything, because that one is urgent
 * rather than informative.
 */

/** Storage keys are an implementation detail; these are the human names. */
const KEY_LABELS: Record<string, string> = {
  [STORAGE_KEYS.profile]: 'your profile',
  [STORAGE_KEYS.health]: 'your health notes',
  [STORAGE_KEYS.baseline]: 'your baseline measurements',
  [STORAGE_KEYS.measurements]: 'your measurements',
  [STORAGE_KEYS.plans]: 'your programme',
  [STORAGE_KEYS.metricSamples]: 'device readings',
  [STORAGE_KEYS.meta]: 'app information',
  [STORAGE_KEYS.game]: 'game progress',
  [STORAGE_KEYS.gameSettings]: 'game settings',
};

function describeKey(key: string): string {
  if (KEY_LABELS[key] !== undefined) return KEY_LABELS[key];
  if (key.startsWith('ft:v1:log:')) return `your record for ${key.slice('ft:v1:log:'.length)}`;
  return 'some stored data';
}

function IssueList({ issues }: { issues: readonly StorageIssue[] }) {
  return (
    <ul className="issues">
      {issues.map((issue) => (
        <li className="issues__item" key={`${issue.key}:${issue.kind}`}>
          <AttentionIcon />
          <span className="issues__what">Could not read {describeKey(issue.key)}.</span>
          {issue.quarantinedAs !== undefined ? (
            <span className="issues__note">
              The original is untouched, and a copy has been kept aside on this device.
            </span>
          ) : (
            <span className="issues__note">The original is untouched.</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function formatBackupTime(value: string | undefined): string {
  if (value === undefined) return 'Never';
  const day = value.slice(0, 10);
  const time = value.slice(11, 16);
  return `${formatLongDate(day)}, ${time}`;
}

export function DataScreen({ onClose }: { onClose: () => void }) {
  const {
    meta,
    issues,
    isPersistent,
    canDownload,
    status,
    pending,
    exportBackup,
    exportCsv,
    chooseFile,
    cancelImport,
    confirmImport,
  } = useData();

  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <Screen title="Your data" subtitle="Everything is stored on this device.">
      <button type="button" className="btn btn--secondary data__back" onClick={onClose}>
        ← Back to Settings
      </button>

      {!isPersistent ? (
        <section className="card card--attention">
          <AttentionIcon />
          <p>
            Changes are only available for this session, because this browser will not let the
            app store anything. Export a backup if you want to keep today&rsquo;s entries.
          </p>
        </section>
      ) : null}

      {status.kind === 'error' ? (
        <section className="card card--attention" role="status">
          <AttentionIcon />
          {status.messages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </section>
      ) : null}

      {status.kind === 'exported' ? (
        <section className="card" role="status">
          <p className="footnote">Saved {status.filename}.</p>
        </section>
      ) : null}

      {status.kind === 'imported' ? (
        <section className="card" role="status">
          <p>
            Restored {status.written} day{status.written === 1 ? '' : 's'}
            {status.removed > 0
              ? `, and removed ${status.removed} that the backup did not contain`
              : ''}
            {status.journeysRestored !== undefined
              ? `, plus ${status.journeysRestored} Journey${status.journeysRestored === 1 ? '' : 's'}`
              : ''}
            {status.activeJourneyRestored
              ? ', including an unfinished Journey recovery'
              : ''}
            .
          </p>
          <button type="button" className="btn btn--primary btn--block" onClick={() => window.location.reload()}>
            Reload the app
          </button>
          <p className="footnote">
            Reloading makes every screen read the restored data rather than what it had
            already loaded.
          </p>
        </section>
      ) : null}

      <Section title="Backup">
        <div className="stats">
          <div className="stat stat--row">
            <span className="stat__label">Last backup</span>
            <span className="stat__value">
              {meta?.lastExportedAt === undefined ? (
                <span className="attention-chip">
                  <AttentionIcon />
                  Never
                </span>
              ) : (
                formatBackupTime(meta.lastExportedAt)
              )}
            </span>
          </div>
        </div>
        <button type="button" className="btn btn--primary btn--block" onClick={exportBackup} disabled={!canDownload}>
          Export JSON backup
        </button>
        <p className="footnote">
          Includes your fitness history, Journeys, profile, programme and game progress. This is
          the file to keep, and the one to restore from.
        </p>
      </Section>

      <Section title="Everyday export">
        <button type="button" className="btn btn--secondary btn--block" onClick={exportCsv} disabled={!canDownload}>
          Export daily CSV
        </button>
        <p className="footnote">
          One row per day, for spreadsheets or analysis. This is not a full backup and cannot be
          restored from.
        </p>
      </Section>

      <Section title="Restore from a backup" defaultOpen={false}>
        {pending === undefined ? (
          <>
            <p className="footnote">
              Importing replaces the data currently in this app. A backup of what is here now
              will be saved first.
            </p>
            <input
              ref={fileInput}
              className="visually-hidden"
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file === undefined) return;
                void file.text().then(chooseFile);
              }}
            />
            <button
              type="button"
              className="btn btn--secondary btn--block"
              onClick={() => fileInput.current?.click()}
            >
              Choose a backup file
            </button>
          </>
        ) : (
          <div className="confirm">
            <p>
              <strong>This backup replaces everything currently in the app.</strong>
            </p>
            <div className="stats">
              <div className="stat stat--row">
                <span className="stat__label">Backed up</span>
                <span className="stat__value">
                  {formatBackupTime(pending.summary.exportedAt)}
                </span>
              </div>
              <div className="stat stat--row">
                <span className="stat__label">NinFit version</span>
                <span className="stat__value">{pending.summary.appVersion}</span>
              </div>
              <div className="stat stat--row">
                <span className="stat__label">Backup format</span>
                <span className="stat__value">Schema {pending.summary.schemaVersion}</span>
              </div>
              <div className="stat stat--row">
                <span className="stat__label">Daily records</span>
                <span className="stat__value">{pending.summary.dailyLogs}</span>
              </div>
              <div className="stat stat--row">
                <span className="stat__label">Measurements</span>
                <span className="stat__value">{pending.summary.measurements}</span>
              </div>
              <div className="stat stat--row">
                <span className="stat__label">Programme weeks</span>
                <span className="stat__value">{pending.summary.weeklyPlans}</span>
              </div>
              <div className="stat stat--row">
                <span className="stat__label">Journeys</span>
                <span className="stat__value">
                  {pending.summary.hasJourneyData
                    ? `${pending.summary.journeys ?? 0}${pending.summary.hasActiveJourney ? ' + unfinished recovery' : ''}`
                    : 'Not in this file'}
                </span>
              </div>
              <div className="stat stat--row">
                <span className="stat__label">Game progress</span>
                <span className="stat__value">
                  {pending.summary.hasGameData
                    ? `Level ${pending.summary.gameLevel ?? 1}, ${pending.summary.trophies ?? 0} trophies`
                    : 'Not in this file'}
                </span>
              </div>
            </div>
            {!pending.summary.hasJourneyData ? (
              <p className="footnote">
                This backup predates Journey backup support. Your current Journey history will be
                left alone rather than deleted by a file that could not have contained it.
              </p>
            ) : null}
            {!pending.summary.hasGameData ? (
              <p className="footnote">
                This backup predates game progress. Your fitness history will be restored, and
                the game will start fresh rather than awarding XP for past days.
              </p>
            ) : null}
            <p className="footnote">
              A backup of your current data will download first. Days not in this file will be
              removed.
            </p>
            <div className="confirm__actions">
              <button type="button" className="btn btn--secondary btn--block" onClick={cancelImport}>
                Cancel
              </button>
              <button type="button" className="btn btn--attention btn--block" onClick={confirmImport}>
                Back up and replace
              </button>
            </div>
          </div>
        )}
      </Section>

      <section className="card card--info">
        <p className="data__group">Storage and privacy</p>
        <p>
          Your fitness records are stored on this device, in the app&rsquo;s own browser storage.
          They are not synced to your NinFit ID or to the cloud, so this device is the only copy
          unless you export a backup.
        </p>
        <p className="footnote">
          A NinFit ID is only for sign-in and does not contain your fitness records.
        </p>
        <p className="footnote">
          Browsers can clear storage, so an occasional backup is worth having.
        </p>
        <p className="footnote">
          Before replacing your phone, removing the installed app, or clearing browser/site data,
          export a JSON backup and keep the file somewhere you trust.
        </p>
        <p className="footnote">
          You should not need to clear site data just to get a newer NinFit build. Closing and
          reopening the installed app while online is the safe first step.
        </p>
      </section>

      {issues.length > 0 ? (
        <Section title="Stored data issue">
          <IssueList issues={issues} />
          <p className="footnote">
            Nothing has been deleted or repaired. The unreadable values stay on this device, and
            a backup taken now will contain everything that could be read.
          </p>
        </Section>
      ) : null}

      <p className="today__disclaimer">
        Exported files may contain personal health and fitness information. Store them somewhere
        you trust.
      </p>
    </Screen>
  );
}
