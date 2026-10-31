import { defaultSettings, type Settings } from './settings'

export type Action = -1 | 0 | 1

function configuredPower(step: number, settings: Settings): number {
  return step === 0
    ? 0
    : Math.round(
        settings.minPower + ((Math.abs(step) - 1) * (settings.maxPower - settings.minPower)) / 4,
      )
}

export function targetPower(step: number, settings: Settings): number {
  return Math.sign(step) * configuredPower(step, settings)
}

export function nextPower(
  currentSignedPower: number,
  step: number,
  elapsedMs: number,
  settings: Settings,
): number {
  const target = targetPower(step, settings)
  const { minPower, maxPower, inertia } = settings
  if (inertia === 0 || minPower === maxPower) return target
  const distance = ((maxPower - minPower) * elapsedMs) / (inertia * 1000)
  const position =
    currentSignedPower === 0
      ? 0
      : Math.sign(currentSignedPower) * (Math.abs(currentSignedPower) - minPower)
  const destination = target === 0 ? 0 : Math.sign(target) * (Math.abs(target) - minPower)
  if (Math.sign(currentSignedPower) !== Math.sign(target) && currentSignedPower !== 0) {
    const remaining = Math.abs(position)
    if (distance < remaining)
      return Math.sign(currentSignedPower) * (minPower + remaining - distance)
    if (target === 0) return 0
    return Math.sign(target) * (minPower + Math.min(Math.abs(destination), distance - remaining))
  }
  if (target === 0) return 0
  const magnitude = Math.abs(position)
  const goal = Math.abs(destination)
  return (
    Math.sign(target) *
    (minPower +
      (magnitude < goal
        ? Math.min(goal, magnitude + distance)
        : Math.max(goal, magnitude - distance)))
  )
}

export function powerCommand(signedPower: number, settings: Settings = defaultSettings): string {
  const rounded = Math.round(Math.abs(signedPower))
  return (
    (signedPower !== 0 && signedPower < 0 !== settings.inverted ? '-' : '+') +
    String(rounded).padStart(3, '0') +
    settings.channel.toLowerCase()
  )
}

export function nextStep(step: number, action: Action): number {
  return action === 0 ? 0 : Math.max(-5, Math.min(5, step + action))
}
