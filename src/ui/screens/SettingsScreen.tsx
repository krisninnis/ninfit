import type {
  GameSettings,
  MascotPersonality,
  SocialMode,
  ThemePreference,
} from '../../domain/game/types';
import {
  WEARABLE_PROVIDERS,
  wearableProviderIsConnectable,
} from '../../domain/wearable/provider';
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

      {/*
        CONNECTED DEVICES - AN HONEST LIST, NOT A SHOP WINDOW.

        Every row here is a provider NinFit has a position on, and the position is
        printed next to it. Nothing has a Connect button, because nothing can be
        connected: a button that opens an authorisation NinFit cannot complete would
        teach somebody their watch is nearly working, and they would go looking for
        their heart rate in a Journey that will never have one.

        The reviewed sentence for each provider lives in the registry, so this screen
        cannot invent a friendlier one. `wearableProviderIsConnectable` is the single
        gate on whether an action may ever appear beside a row - it answers false for
        every provider today, and the day it answers true for one, the action arrives
        for that one only.
      */}
      <Section title="Connected devices" defaultOpen={false}>
        <p className="settings__section-copy">
          NinFit records Journeys with this phone. Watches and health apps would add
          heart rate, steps and sleep alongside that - none are connected.
        </p>
        <div className="stats">
          {WEARABLE_PROVIDERS.map((provider) => (
            <div className="stat stat--row" key={provider.id}>
              <span className="stat__label">{provider.label}</span>
              <span className="stat__value">
                {wearableProviderIsConnectable(provider) ? 'Available' : 'Not connected'}
              </span>
            </div>
          ))}
        </div>
        <ul className="settings__device-notes">
          {WEARABLE_PROVIDERS.map((provider) => (
            <li key={provider.id}>
              <strong>{provider.label}</strong>
              <span>{provider.status}</span>
            </li>
          ))}
        </ul>
        <p className="footnote">
          Connecting a device would be a separate decision from sharing anything. A
          watch adding heart rate to a Journey does not make that Journey public.
        </p>
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
