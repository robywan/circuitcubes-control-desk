import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import HomeView from '../views/HomeView.vue'

import { batteryDevice } from './battery-fixture'

afterEach(() => {
  vi.useRealTimers()
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
  const device = batteryDevice(rx, tx)
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
  expect(view.findAll('span').find((span) => span.text().includes('· Batteria'))!.classes()).toContain('ml-1')
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
    const device = batteryDevice(rx, tx, disconnect)
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

it('aggiorna la Battery voltage ogni 60 s e riparte una sola volta dopo la riconnessione', async () => {
  vi.useFakeTimers()
  const tx = Object.assign(new EventTarget(), {
    startNotifications: async () => {},
    value: new DataView(new ArrayBuffer(0)),
  })
  const messages: string[] = []
  const rx = {
    properties: { write: true },
    writeValueWithResponse: async (value: Uint8Array) => {
      messages.push(new TextDecoder().decode(value))
    },
  }
  const device = batteryDevice(rx, tx)
  vi.stubGlobal('navigator', { bluetooth: { requestDevice: async () => device } })
  const view = mount(HomeView)
  await view.get('button').trigger('click')
  await flushPromises()
  expect(messages).toEqual(['b'])
  await vi.advanceTimersByTimeAsync(59_999)
  expect(messages).toEqual(['b'])
  await vi.advanceTimersByTimeAsync(1)
  expect(messages).toEqual(['b', 'b'])
  const bytes = new TextEncoder().encode('3.76')
  tx.value = new DataView(bytes.buffer)
  tx.dispatchEvent(new Event('characteristicvaluechanged'))
  await view.vm.$nextTick()
  expect(view.text()).toContain('Batteria 3,76 V')
  device.dispatchEvent(new Event('gattserverdisconnected'))
  await vi.advanceTimersByTimeAsync(120_000)
  expect(messages).toEqual(['b', 'b'])
  expect(view.text()).not.toContain('Batteria')
  await view.get('button').trigger('click')
  await flushPromises()
  await vi.advanceTimersByTimeAsync(60_000)
  expect(messages).toEqual(['b', 'b', 'b', 'b'])
  view.unmount()
  await vi.advanceTimersByTimeAsync(120_000)
  expect(messages).toEqual(['b', 'b', 'b', 'b'])
})

it('annulla le letture in coda e i timer mentre lo Stop finale è in corso', async () => {
  vi.useFakeTimers()
  let finishDrive!: () => void
  let finishStop!: () => void
  const drivePending = new Promise<void>((resolve) => {
    finishDrive = resolve
  })
  const stopPending = new Promise<void>((resolve) => {
    finishStop = resolve
  })
  const messages: string[] = []
  const tx = Object.assign(new EventTarget(), { startNotifications: async () => {} })
  const rx = {
    properties: { write: true },
    writeValueWithResponse: async (value: Uint8Array) => {
      const message = new TextDecoder().decode(value)
      messages.push(message)
      if (message === '+080a') await drivePending
      if (message === '+000a') await stopPending
    },
  }
  const device = batteryDevice(rx, tx, () => {
    messages.push('disconnect')
  })
  vi.stubGlobal('navigator', { bluetooth: { requestDevice: async () => device } })
  const view = mount(HomeView)
  await view.get('button').trigger('click')
  await flushPromises()
  await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await vi.advanceTimersByTimeAsync(60_000)
  expect(messages).toEqual(['b', '+080a'])
  await view.get('button').trigger('click')
  finishDrive()
  await flushPromises()
  expect(messages).toEqual(['b', '+080a', '+000a'])
  await vi.advanceTimersByTimeAsync(120_000)
  expect(messages).toEqual(['b', '+080a', '+000a'])
  finishStop()
  await flushPromises()
  expect(messages).toEqual(['b', '+080a', '+000a', 'disconnect'])
  view.unmount()
})

it('ignora la conclusione delle notifiche dopo la disconnessione', async () => {
  let finish!: () => void
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  const tx = Object.assign(new EventTarget(), { startNotifications: () => pending })
  const write = vi.fn<() => void>()
  const rx = { properties: { write: true }, writeValueWithResponse: write }
  const device = batteryDevice(rx, tx)
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
