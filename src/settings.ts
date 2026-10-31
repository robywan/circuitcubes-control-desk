export const channels = ['A', 'B', 'C'] as const

export interface Settings {
  channel: typeof channels[number]
  inverted: boolean
  minPower: number
  maxPower: number
  remoteSide: 'left' | 'right'
}

export const defaultSettings: Settings = { channel: 'A', inverted: false, minPower: 80, maxPower: 255, remoteSide: 'left' }

export function validPower(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255
}

export function loadSettings(raw: string | null): Settings {
  let data: Partial<Settings> = {}
  try {
    const parsed: unknown = JSON.parse(raw ?? '{}')
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed as Partial<Settings>
  } catch {}
  const minPower = validPower(data.minPower) ? data.minPower : defaultSettings.minPower
  const maxPower = validPower(data.maxPower) ? data.maxPower : defaultSettings.maxPower
  return {
    channel: channels.find(channel => channel === data.channel) ?? defaultSettings.channel,
    inverted: typeof data.inverted === 'boolean' ? data.inverted : defaultSettings.inverted,
    minPower: minPower <= maxPower ? minPower : defaultSettings.minPower,
    maxPower: minPower <= maxPower ? maxPower : defaultSettings.maxPower,
    remoteSide: data.remoteSide === 'left' || data.remoteSide === 'right' ? data.remoteSide : defaultSettings.remoteSide,
  }
}
