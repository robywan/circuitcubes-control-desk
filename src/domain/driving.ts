import { defaultSettings, STALL_POWER, type Settings } from './settings'

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
  const { maxPower, inertia } = settings
  if (inertia === 0 || maxPower === STALL_POWER) return target
  const distance = ((maxPower - STALL_POWER) * elapsedMs) / (inertia * 1000)
  const position =
    currentSignedPower === 0
      ? 0
      : Math.sign(currentSignedPower) * (Math.abs(currentSignedPower) - STALL_POWER)
  const destination = target === 0 ? 0 : Math.sign(target) * (Math.abs(target) - STALL_POWER)
  if (Math.sign(currentSignedPower) !== Math.sign(target) && currentSignedPower !== 0) {
    const remaining = Math.abs(position)
    if (distance < remaining)
      return Math.sign(currentSignedPower) * (STALL_POWER + remaining - distance)
    if (target === 0) return 0
    return Math.sign(target) * (STALL_POWER + Math.min(Math.abs(destination), distance - remaining))
  }
  if (target === 0) return 0
  const magnitude = Math.abs(position)
  const goal = Math.abs(destination)
  return (
    Math.sign(target) *
    (STALL_POWER +
      (magnitude < goal
        ? Math.min(goal, magnitude + distance)
        : Math.max(goal, magnitude - distance)))
  )
}

export function brakePower(power: number, elapsedMs: number, settings: Settings): number {
  if (settings.maxPower === STALL_POWER) return 0
  const magnitude =
    Math.abs(power) - ((settings.maxPower - STALL_POWER) * elapsedMs) / (settings.brake * 1000)
  return magnitude <= STALL_POWER ? 0 : Math.sign(power) * magnitude
}

export function brakeStep(step: number, power: number, settings: Settings): number {
  let magnitude = Math.abs(step)
  while (magnitude > 0 && configuredPower(magnitude, settings) > Math.abs(power)) magnitude--
  return Math.sign(step) * magnitude || 0
}

export function powerCommand(signedPower: number, settings: Settings = defaultSettings): string {
  const rounded = Math.round(Math.abs(signedPower))
  return (
    (signedPower !== 0 && signedPower < 0 !== settings.inverted ? '-' : '+') +
    String(rounded).padStart(3, '0') +
    settings.channel.toLowerCase()
  )
}

export function nextStep(step: number, action: Action, signedPower: number): number {
  if (step === 0 && action !== 0 && Math.sign(signedPower) === -action) return 0
  return action === 0 ? 0 : Math.max(-5, Math.min(5, step + action))
}
