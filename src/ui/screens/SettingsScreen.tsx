import type {
  GameSettings,
  MascotPersonality,
  SocialMode,
  ThemePreference,
} from '../../domain/game/types';
import { Section, SelectField, Toggle } from '../components/Field';
import { Screen } from '../components/Screen';
import { currentAppBuildInfo } from '../buildInfo';

interface SettingsScreenProps {
  settings: GameSettings;
  onSettingsChange: (patch: Partial<GameSettings>) => void;
  onOpenData: () => void;
}

const THEMES: ReadonlyArray<{
  value: ThemePreference;
  label: string;
  detail: string;
}> = [
  { value: 'system', label: 'System', detail: 'Follow this device automatically.' },
  { value: 'light', label: 'Light', detail: 'Keep NinFit light on this device.' },
  { value: 'dark', label: 'Dark', detail: 'Keep NinFit dark on this device.' },
];

const PERSONALITIES: ReadonlyArray<{
  value: MascotPersonality;
  label: string;
}> = [
  { value: 'quiet', label: 'Quiet' },
  { value: 'normal', label: 'Normal' },
  { value: 'chatty', label: 'Chatty' },
];

const SOCIAL_MODES: ReadonlyArray<{ value: SocialMode; label: string }> = [
  { value: 'private', label: 'Private' },
  { value: 'friends', label: 'Friends' },
  { value: 'community', label: 'Community' },
];

export function SettingsScreen({
  settings,
  onSettingsChange,
  onOpenData,
}: SettingsScreenProps) {
  const build = currentAppBuildInfo();

  return (
    <Screen title="Settings" subtitle="Make NinFit work the way you prefer.">
      <Section title="Appearance">
        <fieldset className="settings__theme-fieldset">
          <legend className="control__label">Theme</legend>
          <div className="settings__theme-options">
            {THEMES.map((option) => (
              <label
                className={`settings__theme-option${
                  settings.theme === option.value ? ' settings__theme-option--selected' : ''
                }`}
                key={option.value}
              >
                <input
                  type="radio"
                  name="theme"
                  value={option.value}
                  checked={settings.theme === option.value}
                  onChange={() => onSettingsChange({ theme: option.value })}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.detail}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </Section>

      <Section title="App preferences">
        <SelectField
          label="Mascot personality"
          value={settings.mascotPersonality}
          options={PERSONALITIES}
          onChange={(mascotPersonality) => onSettingsChange({ mascotPersonality })}
        />
        <Toggle
          label="Sound"
          hint="Used only for supported NinFit moments."
          checked={settings.soundEnabled}
          onChange={(soundEnabled) => onSettingsChange({ soundEnabled })}
        />
        <Toggle
          label="Haptics"
          hint="Used only where this device and browser support them."
          checked={settings.hapticsEnabled}
          onChange={(hapticsEnabled) => onSettingsChange({ hapticsEnabled })}
        />
      </Section>

      <Section title="Privacy and participation" defaultOpen={false}>
        <SelectField
          label="Social mode"
          hint="Not connected to anything yet. Health data stays private whatever you pick."
          value={settings.socialMode}
          options={SOCIAL_MODES}
          onChange={(socialMode) => onSettingsChange({ socialMode })}
        />
        <Toggle
          label="Personal challenges"
          checked={settings.challenges.personal}
          onChange={(personal) =>
            onSettingsChange({
              challenges: { ...settings.challenges, personal },
            })
          }
        />
        <Toggle
          label="Friend challenges"
          checked={settings.challenges.friends}
          onChange={(friends) =>
            onSettingsChange({
              challenges: { ...settings.challenges, friends },
            })
          }
        />
        <Toggle
          label="Community challenges"
          checked={settings.challenges.community}
          onChange={(community) =>
            onSettingsChange({
              challenges: { ...settings.challenges, community },
            })
          }
        />
      </Section>

      <Section title="Data & privacy">
        <p className="settings__section-copy">
          Back up, export, restore, and review data stored by NinFit on this device.
        </p>
        <button
          type="button"
          className="btn btn--secondary btn--block settings__destination"
          onClick={onOpenData}
        >
          <span>
            <strong>Open data tools</strong>
            <small>Backup, CSV export, restore, storage and privacy</small>
          </span>
          <span aria-hidden="true">→</span>
        </button>
        <p className="footnote">
          NinFit remains local-first. Nothing here uploads your fitness history.
        </p>
      </Section>

      <Section title="About" defaultOpen={false}>
        <div className="stats">
          <div className="stat stat--row">
            <span className="stat__label">Version</span>
            <span className="stat__value">{build.version}</span>
          </div>
          <div className="stat stat--row">
            <span className="stat__label">Channel</span>
            <span className="stat__value">{build.channel}</span>
          </div>
          <div className="stat stat--row">
            <span className="stat__label">Build</span>
            <span className="stat__value">{build.fingerprint}</span>
          </div>
        </div>
        <p className="footnote">
          The build fingerprint comes from the loaded app assets, so it is a quick way
          to tell whether two phones are showing the same deployed version.
        </p>
      </Section>
    </Screen>
  );
}
