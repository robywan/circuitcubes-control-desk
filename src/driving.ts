import { defaultSettings, type Settings } from './settings'

export type Action = -1 | 0 | 1

function configuredPower(step: number, settings: Settings): number {
  return step === 0 ? 0 : Math.round(settings.minPower + (Math.abs(step) - 1) * (settings.maxPower - settings.minPower) / 4)
}

export function command(step: number, settings: Settings = defaultSettings): string {
  return (step !== 0 && (step < 0) !== settings.inverted ? '-' : '+') + String(configuredPower(step, settings)).padStart(3, '0') + settings.channel.toLowerCase()
}

export function nextStep(step: number, action: Action): number {
  return action === 0 ? 0 : Math.max(-5, Math.min(5, step + action))
}
