import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import HomeView from '../views/HomeView.vue'

const service = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('avvisa quando Bluetooth non è disponibile e disabilita i comandi', () => {
  vi.stubGlobal('navigator', {})
  const view = mount(HomeView)
  expect(view.text()).toContain('Chrome o Edge')
  expect(view.findAll('button').every((button) => button.attributes('disabled') !== undefined)).toBe(true)
})

it('connette, serializza i comandi e azzera la marcia alla disconnessione', async () => {
  const device = new EventTarget() as EventTarget & { gatt: { connected: boolean; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> } }
  let finish!: () => void
  const first = new Promise<void>((resolve) => { finish = resolve })
  const write = vi.fn<(value: Uint8Array) => Promise<void>>().mockReturnValueOnce(first).mockResolvedValue(undefined)
  const characteristic = { writeValueWithResponse: write }
  const server = { connected: true, getPrimaryService: vi.fn<() => Promise<{ getCharacteristic: () => Promise<typeof characteristic> }>>(async () => ({ getCharacteristic: vi.fn<() => Promise<typeof characteristic>>(async () => characteristic) })) }
  device.gatt = { connected: true, connect: vi.fn<() => Promise<typeof server>>(async () => server), disconnect: vi.fn<() => void>(() => {}) }
  const requestDevice = vi.fn<(options: unknown) => Promise<typeof device>>(async () => device)
  vi.stubGlobal('navigator', { bluetooth: { requestDevice } })
  const view = mount(HomeView)
  await view.get('button').trigger('click')
  await flushPromises()
  expect(requestDevice).toHaveBeenCalledWith({ filters: [{ services: [service] }] })
  expect(view.text()).toContain('Connesso')
  const buttons = view.findAll('button')
  await buttons[3]!.trigger('click')
  await buttons[3]!.trigger('click')
  expect(write).toHaveBeenCalledTimes(1)
  expect(new TextDecoder().decode(write.mock.calls[0]![0])).toBe('+080a')
  finish()
  await flushPromises()
  expect(new TextDecoder().decode(write.mock.calls[1]![0])).toBe('+124a')
  device.gatt.connected = false
  device.dispatchEvent(new Event('gattserverdisconnected'))
  await flushPromises()
  expect(view.text()).toContain('Disconnesso')
  expect(view.get('[data-testid="step"]').text()).toBe('0')
  expect(buttons[3]!.attributes('disabled')).toBeDefined()
})

it('mostra gli errori di connessione e registra il dettaglio', async () => {
  const error = new Error('Bluetooth failure')
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal('navigator', { bluetooth: { requestDevice: vi.fn<() => Promise<never>>(async () => { throw error }) } })
  const view = mount(HomeView)
  await view.get('button').trigger('click')
  await flushPromises()
  expect(view.text()).toContain('Errore')
  expect(log).toHaveBeenCalledWith(error)
})
