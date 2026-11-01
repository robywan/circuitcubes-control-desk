export function parseBatteryVoltage(text: string): number | null {
  const match = text.match(/\d+\.\d+/)
  return match ? Number(match[0]) : null
}
