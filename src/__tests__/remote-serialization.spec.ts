import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import HomeView from '../views/HomeView.vue'
import { batteryDevice, batteryNotifications, connectionButton } from './battery-fixture'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('ferma la Locomotive se l’attivazione del Remote fallisce', async () => {
  vi.useFakeTimers()
  const error = new DOMException('GATT operation not permitted.', 'NotSupportedError')
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  const commands: string[] = []
  const remoteCharacteristic = Object.assign(new EventTarget(), {
    startNotifications: async () => {},
    writeValueWithResponse: async () => {
      throw error
    },
  })
  const device = (characteristic: unknown) =>
    batteryDevice(characteristic, batteryNotifications(), vi.fn<() => void>())
  const cube = device({
    properties: { write: true },
    writeValueWithResponse: async (value: Uint8Array) => {
      commands.push(new TextDecoder().decode(value))
    },
  })
  const remote = device(remoteCharacteristic)
  const requestDevice = vi
    .fn<() => Promise<typeof cube>>()
    .mockResolvedValueOnce(cube)
    .mockResolvedValueOnce(remote)
  vi.stubGlobal('navigator', { bluetooth: { requestDevice } })
  const view = mount(HomeView)
  await connectionButton(view, 'Battery Cube').trigger('click')
  await flushPromises()
  await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await flushPromises()
  await connectionButton(view, 'Remote').trigger('click')
  await flushPromises()
  await vi.advanceTimersByTimeAsync(100)
  await flushPromises()
  expect(log).toHaveBeenCalledWith(error)
  expect(remote.gatt.disconnect).toHaveBeenCalledOnce()
  expect(view.text()).toContain('Errore di scrittura')
  expect(view.get('[data-testid="step"]').text()).toBe('0')
  expect(commands).toEqual(['b', '+055a', '+065a', '+000a'])
  view.unmount()
})

it('serializza l’attivazione dei due lati e ignora eventi iniziali duplicati', async () => {
  vi.useFakeTimers()
  let finish!: () => void
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  const write = vi
    .fn<(value: Uint8Array) => Promise<void>>()
    .mockReturnValueOnce(pending)
    .mockResolvedValue(undefined)
  const characteristic = new EventTarget() as EventTarget & {
    value: DataView
    startNotifications: () => Promise<unknown>
    writeValueWithResponse: typeof write
  }
  characteristic.startNotifications = async () => characteristic
  characteristic.writeValueWithResponse = write
  const device = new EventTarget() as EventTarget & { gatt: unknown }
  device.gatt = {
    connect: async () => ({
      connected: true,
      getPrimaryService: async () => ({ getCharacteristic: async () => characteristic }),
    }),
    disconnect: () => {},
  }
  vi.stubGlobal('navigator', { bluetooth: { requestDevice: async () => device } })
  const view = mount(HomeView)
  await connectionButton(view, 'Remote').trigger('click')
  await flushPromises()
  characteristic.value = new DataView(Uint8Array.from([5, 0, 4, 0x3c, 1]).buffer)
  characteristic.dispatchEvent(new Event('characteristicvaluechanged'))
  characteristic.dispatchEvent(new Event('characteristicvaluechanged'))
  await vi.advanceTimersByTimeAsync(500)
  expect(write).toHaveBeenCalledTimes(1)
  finish()
  await vi.advanceTimersByTimeAsync(300)
  expect(write).toHaveBeenCalledTimes(2)
  view.unmount()
})

it('non completa una vecchia attivazione dopo la riconnessione', async () => {
  vi.useFakeTimers()
  let finish!: () => void
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  const write = vi
    .fn<(value: Uint8Array) => Promise<void>>()
    .mockReturnValueOnce(pending)
    .mockResolvedValue(undefined)
  const characteristic = new EventTarget() as EventTarget & {
    value: DataView
    startNotifications: () => Promise<unknown>
    writeValueWithResponse: typeof write
  }
  characteristic.startNotifications = async () => characteristic
  characteristic.writeValueWithResponse = write
  const device = new EventTarget() as EventTarget & { gatt: unknown }
  device.gatt = {
    connect: async () => ({
      connected: true,
      getPrimaryService: async () => ({ getCharacteristic: async () => characteristic }),
    }),
    disconnect: () => {},
  }
  vi.stubGlobal('navigator', { bluetooth: { requestDevice: async () => device } })
  const view = mount(HomeView)
  const remote = connectionButton(view, 'Remote')
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
  await vi.advanceTimersByTimeAsync(100)
  expect(write).toHaveBeenCalledTimes(2)
  expect([...write.mock.calls[1]![0]]).toEqual([10, 0, 0x41, 0, 0, 1, 0, 0, 0, 1])
  await vi.advanceTimersByTimeAsync(100)
  expect(write).toHaveBeenCalledTimes(3)
  expect([...write.mock.calls[2]![0]]).toEqual([10, 0, 0x41, 1, 0, 1, 0, 0, 0, 1])
  view.unmount()
})
