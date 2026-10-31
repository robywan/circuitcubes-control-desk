import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import HomeView from '../views/HomeView.vue'
import { batteryDevice, batteryNotifications, txId } from './battery-fixture'

const service = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'

it.each([true, false])(
  'usa la modalità GATT supportata (write=%s) e serializza anche lo Stop',
  async (withResponse) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let finish!: () => void
    const first = new Promise<void>((resolve) => {
      finish = resolve
    })
    const write = vi
      .fn<(value: Uint8Array) => Promise<void>>()
      .mockResolvedValueOnce(undefined)
      .mockReturnValueOnce(first)
      .mockResolvedValue(undefined)
    const unsupported = vi
      .fn<(value: Uint8Array) => Promise<void>>()
      .mockRejectedValue(new DOMException('GATT operation not permitted.', 'NotSupportedError'))
    const characteristic = {
      properties: { write: withResponse, writeWithoutResponse: !withResponse },
      writeValueWithResponse: withResponse ? write : unsupported,
      writeValueWithoutResponse: withResponse ? unsupported : write,
    }
    const device = batteryDevice(characteristic, batteryNotifications(), vi.fn<() => void>())
    vi.stubGlobal('navigator', { bluetooth: { requestDevice: async () => device } })
    const view = mount(HomeView)
    await view.get('button').trigger('click')
    await flushPromises()
    await view.get('[aria-label="Aumenta marcia"]').trigger('click')
    await view.get('[aria-label="Aumenta marcia"]').trigger('click')
    await view
      .findAll('button')
      .find((button) => button.text() === 'Stop')!
      .trigger('click')
    await flushPromises()
    expect(unsupported).not.toHaveBeenCalled()
    expect(write).toHaveBeenCalledTimes(2)
    finish()
    await flushPromises()
    expect(write.mock.calls.map(([value]) => new TextDecoder().decode(value))).toEqual([
      'b',
      '+080a',
      '+124a',
      '+000a',
    ])
    expect(view.get('[data-testid="step"]').text()).toBe('0')
    expect(view.text()).not.toContain('Errore di scrittura')
    expect(device.gatt.disconnect).not.toHaveBeenCalled()
    view.unmount()
  },
)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('avvisa quando Bluetooth non è disponibile e disabilita i comandi', () => {
  vi.stubGlobal('navigator', {})
  const view = mount(HomeView)
  expect(view.text()).toContain('Chrome o Edge')
  expect(
    view.findAll('button').every((button) => button.attributes('disabled') !== undefined),
  ).toBe(true)
})

it('connette, serializza i comandi e azzera lo Speed step alla disconnessione', async () => {
  const device = new EventTarget() as EventTarget & {
    gatt: {
      connected: boolean
      connect: ReturnType<typeof vi.fn>
      disconnect: ReturnType<typeof vi.fn>
    }
  }
  let finish!: () => void
  const first = new Promise<void>((resolve) => {
    finish = resolve
  })
  const write = vi
    .fn<(value: Uint8Array) => Promise<void>>()
    .mockResolvedValueOnce(undefined)
    .mockReturnValueOnce(first)
    .mockResolvedValue(undefined)
  const characteristic = {
    properties: { write: true, writeWithoutResponse: false },
    writeValueWithResponse: write,
  }
  const server = {
    connected: true,
    getPrimaryService: vi.fn<
      () => Promise<{
        getCharacteristic: (
          id: string,
        ) => Promise<typeof characteristic | ReturnType<typeof batteryNotifications>>
      }>
    >(async () => ({
      getCharacteristic: async (id: string) =>
        id === txId ? batteryNotifications() : characteristic,
    })),
  }
  device.gatt = {
    connected: true,
    connect: vi.fn<() => Promise<typeof server>>(async () => server),
    disconnect: vi.fn<() => void>(() => {}),
  }
  const requestDevice = vi.fn<(options: unknown) => Promise<typeof device>>(async () => device)
  vi.stubGlobal('navigator', { bluetooth: { requestDevice } })
  const view = mount(HomeView)
  await view.get('button').trigger('click')
  await flushPromises()
  expect(requestDevice).toHaveBeenCalledWith({ filters: [{ services: [service] }] })
  expect(view.text()).toContain('Connesso')
  const buttons = view.findAll('button')
  await buttons[4]!.trigger('click')
  await buttons[4]!.trigger('click')
  expect(write).toHaveBeenCalledTimes(2)
  expect(new TextDecoder().decode(write.mock.calls[1]![0])).toBe('+080a')
  finish()
  await flushPromises()
  expect(new TextDecoder().decode(write.mock.calls[2]![0])).toBe('+124a')
  device.gatt.connected = false
  device.dispatchEvent(new Event('gattserverdisconnected'))
  await flushPromises()
  expect(view.text()).toContain('Disconnesso')
  expect(view.get('[data-testid="step"]').text()).toBe('0')
  expect(buttons[4]!.attributes('disabled')).toBeDefined()
})

it('mostra gli errori di connessione e registra il dettaglio', async () => {
  const error = new Error('Bluetooth failure')
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal('navigator', {
    bluetooth: {
      requestDevice: vi.fn<() => Promise<never>>(async () => {
        throw error
      }),
    },
  })
  const view = mount(HomeView)
  await view.get('button').trigger('click')
  await flushPromises()
  expect(view.text()).toContain('Errore')
  expect(log).toHaveBeenCalledWith(error)
})

it('gestisce la caduta GATT durante la ricerca del servizio mantenendo la guida disabilitata', async () => {
  const error = new DOMException(
    'GATT Server is disconnected. Cannot retrieve services.',
    'NetworkError',
  )
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  const device = new EventTarget() as EventTarget & { gatt: unknown }
  const server = {
    connected: false,
    connect: async () => {
      server.connected = true
      return server
    },
    getPrimaryService: async () => {
      server.connected = false
      device.dispatchEvent(new Event('gattserverdisconnected'))
      throw error
    },
    disconnect: vi.fn<() => void>(),
  }
  device.gatt = server
  vi.stubGlobal('navigator', { bluetooth: { requestDevice: async () => device } })
  const view = mount(HomeView)
  await view.get('button').trigger('click')
  await flushPromises()

  expect(log).toHaveBeenCalledWith(error)
  expect(server.disconnect).toHaveBeenCalledOnce()
  expect(view.text()).toContain('Errore di connessione')
  expect(view.get('[data-testid="step"]').text()).toBe('0')
  expect(view.get('[aria-label="Aumenta marcia"]').attributes('disabled')).toBeDefined()
  view.unmount()
})
