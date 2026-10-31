export function power(step: number): number {
  return step === 0 ? 0 : Math.round(80 + (Math.abs(step) - 1) * (255 - 80) / 4)
}

export function command(step: number): string {
  return (step < 0 ? '-' : '+') + String(power(step)).padStart(3, '0') + 'a'
}

export function nextStep(step: number, action: -1 | 0 | 1): number {
  return action === 0 ? 0 : Math.max(-5, Math.min(5, step + action))
}
