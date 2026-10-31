import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import HomeView from '../views/HomeView.vue'

const txId = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('attende le notifiche, richiede la Battery voltage e la mostra fuori dalla regione live', async () => {
  let enable!: () => void
  const pending = new Promise<void>((resolve) => {
    enable = resolve
  })
  const tx = Object.assign(new EventTarget(), {
    startNotifications: () => pending,
    value: new DataView(new ArrayBuffer(0)),
  })
  const messages: string[] = []
  const rx = {
    properties: { write: true },
    writeValueWithResponse: async (value: Uint8Array) => {
      messages.push(new TextDecoder().decode(value))
    },
  }
  const device = Object.assign(new EventTarget(), {
    gatt: {
      connect: async () => ({
        connected: true,
        getPrimaryService: async () => ({
          getCharacteristic: async (id: string) => (id === txId ? tx : rx),
        }),
      }),
      disconnect: () => {},
    },
  })
  vi.stubGlobal('navigator', { bluetooth: { requestDevice: async () => device } })
  const view = mount(HomeView)
  await view.get('button').trigger('click')
  await flushPromises()
  expect(view.text()).not.toContain('Connesso')
  expect(messages).toEqual([])
  enable()
  await flushPromises()
  expect(messages).toEqual(['b'])
  expect(view.text()).not.toContain('Batteria')
  const bytes = new TextEncoder().encode('3.85\0')
  tx.value = new DataView(bytes.buffer)
  tx.dispatchEvent(new Event('characteristicvaluechanged'))
  await flushPromises()
  expect(view.text()).toContain('· Batteria 3,85 V')
  expect(
    view.findAll('[role="status"]').every((status) => !status.text().includes('Batteria')),
  ).toBe(true)
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  const invalid = new TextEncoder().encode('+124a')
  tx.value = new DataView(invalid.buffer)
  tx.dispatchEvent(new Event('characteristicvaluechanged'))
  await flushPromises()
  expect(log).toHaveBeenCalledWith(expect.stringContaining('+124a'))
  expect(view.text()).toContain('Batteria 3,85 V')
  device.dispatchEvent(new Event('gattserverdisconnected'))
  await flushPromises()
  expect(view.text()).not.toContain('Batteria')
  tx.dispatchEvent(new Event('characteristicvaluechanged'))
  await view.get('button').trigger('click')
  await flushPromises()
  expect(view.text()).not.toContain('Batteria')
  view.unmount()
})

it.each(['notifications', 'request'])(
  'un errore %s non interrompe connessione e guida',
  async (failure) => {
    const error = new Error(failure)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const tx = Object.assign(new EventTarget(), {
      startNotifications: async () => {
        if (failure === 'notifications') throw error
      },
    })
    const messages: string[] = []
    const rx = {
      properties: { write: true },
      writeValueWithResponse: async (value: Uint8Array) => {
        const message = new TextDecoder().decode(value)
        messages.push(message)
        if (message === 'b' && failure === 'request') throw error
      },
    }
    const disconnect = vi.fn<() => void>()
    const device = Object.assign(new EventTarget(), {
      gatt: {
        connect: async () => ({
          connected: true,
          getPrimaryService: async () => ({
            getCharacteristic: async (id: string) => (id === txId ? tx : rx),
          }),
        }),
        disconnect,
      },
    })
    vi.stubGlobal('navigator', { bluetooth: { requestDevice: async () => device } })
    const view = mount(HomeView)
    await view.get('button').trigger('click')
    await flushPromises()
    await view.get('[aria-label="Aumenta marcia"]').trigger('click')
    await flushPromises()
    expect(messages).toEqual(['b', '+080a'])
    expect(view.text()).toContain('Connesso')
    expect(view.text()).not.toContain('Errore di scrittura')
    expect(disconnect).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith(error)
    view.unmount()
  },
)

it('ignora la conclusione delle notifiche dopo la disconnessione', async () => {
  let finish!: () => void
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  const tx = Object.assign(new EventTarget(), { startNotifications: () => pending })
  const write = vi.fn<() => void>()
  const rx = { properties: { write: true }, writeValueWithResponse: write }
  const device = Object.assign(new EventTarget(), {
    gatt: {
      connect: async () => ({
        connected: true,
        getPrimaryService: async () => ({
          getCharacteristic: async (id: string) => (id === txId ? tx : rx),
        }),
      }),
      disconnect: () => {},
    },
  })
  vi.stubGlobal('navigator', { bluetooth: { requestDevice: async () => device } })
  const view = mount(HomeView)
  await view.get('button').trigger('click')
  await flushPromises()
  device.dispatchEvent(new Event('gattserverdisconnected'))
  finish()
  await flushPromises()
  expect(view.text()).not.toContain('Connesso')
  expect(write).not.toHaveBeenCalled()
  view.unmount()
})
