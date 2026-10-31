import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import HomeView from '../views/HomeView.vue'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('serializza le attivazioni anche quando una scrittura è ancora in corso', async () => {
  vi.useFakeTimers()
  let finish!: () => void
  const pending = new Promise<void>((resolve) => { finish = resolve })
  const write = vi.fn<(value: Uint8Array) => Promise<void>>().mockReturnValueOnce(pending).mockResolvedValue(undefined)
  const characteristic = new EventTarget() as EventTarget & { value: DataView; startNotifications: () => Promise<unknown>; writeValueWithResponse: typeof write }
  characteristic.startNotifications = async () => characteristic
  characteristic.writeValueWithResponse = write
  const device = new EventTarget() as EventTarget & { gatt: unknown }
  device.gatt = { connect: async () => ({ connected: true, getPrimaryService: async () => ({ getCharacteristic: async () => characteristic }) }), disconnect: () => {} }
  vi.stubGlobal('navigator', { bluetooth: { requestDevice: async () => device } })
  const view = mount(HomeView)
  await view.findAll('button')[1]!.trigger('click')
  await flushPromises()
  characteristic.value = new DataView(Uint8Array.from([5, 0, 4, 0x3c, 1]).buffer)
  characteristic.dispatchEvent(new Event('characteristicvaluechanged'))
  characteristic.dispatchEvent(new Event('characteristicvaluechanged'))
  await vi.advanceTimersByTimeAsync(500)
  expect(write).toHaveBeenCalledTimes(1)
  finish()
  await vi.advanceTimersByTimeAsync(300)
  expect(write).toHaveBeenCalledTimes(4)
  view.unmount()
})

it('non completa una vecchia attivazione dopo la riconnessione', async () => {
  vi.useFakeTimers()
  let finish!: () => void
  const pending = new Promise<void>((resolve) => { finish = resolve })
  const write = vi.fn<(value: Uint8Array) => Promise<void>>().mockReturnValueOnce(pending).mockResolvedValue(undefined)
  const characteristic = new EventTarget() as EventTarget & { value: DataView; startNotifications: () => Promise<unknown>; writeValueWithResponse: typeof write }
  characteristic.startNotifications = async () => characteristic
  characteristic.writeValueWithResponse = write
  const device = new EventTarget() as EventTarget & { gatt: unknown }
  device.gatt = { connect: async () => ({ connected: true, getPrimaryService: async () => ({ getCharacteristic: async () => characteristic }) }), disconnect: () => {} }
  vi.stubGlobal('navigator', { bluetooth: { requestDevice: async () => device } })
  const view = mount(HomeView)
  const remote = view.findAll('button')[1]!
  await remote.trigger('click')
  await flushPromises()
  characteristic.value = new DataView(Uint8Array.from([5, 0, 4, 0x3c, 1]).buffer)
  characteristic.dispatchEvent(new Event('characteristicvaluechanged'))
  await vi.advanceTimersByTimeAsync(100)
  device.dispatchEvent(new Event('gattserverdisconnected'))
  await flushPromises()
  await remote.trigger('click')
  await flushPromises()
  finish()
  await vi.advanceTimersByTimeAsync(100)
  expect(write).toHaveBeenCalledTimes(1)
  view.unmount()
})
