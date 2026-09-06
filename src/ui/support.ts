import type { SupportConfig } from '../config/support'
import type { AppBuildInfo } from './buildInfo'

export const LOST_DATA_GUIDANCE =
  'NinFit is local-first. If your data existed only on a lost, reset or unavailable device and you do not have a usable NinFit backup, NinFit cannot recover that history from a server. Keep a backup somewhere outside this device if the history matters to you.'

export function buildSupportMailto(config: SupportConfig, build: AppBuildInfo): string {
  const subject = 'NinFit support request'
  const body = [
    'Please describe what happened below.',
    '',
    '--- NinFit release identity ---',
    `Version: ${build.version}`,
    `Channel: ${build.channel}`,
    `Build: ${build.fingerprint}`,
    '--- end release identity ---',
    '',
    'What happened:',
  ].join('\n')

  return `mailto:${config.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
