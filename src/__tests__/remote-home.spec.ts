import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import HomeView from '../views/HomeView.vue'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('connette il Remote, attiva i tasti e ferma la Locomotive alla disconnessione', async () => {
  vi.useFakeTimers()
  const cubeWrites: string[] = []
  const remoteWrites: number[][] = []
  const characteristic = new EventTarget() as EventTarget & { value: DataView; startNotifications: () => Promise<unknown>; writeValueWithResponse: (value: Uint8Array) => Promise<void> }
  characteristic.startNotifications = async () => characteristic
  characteristic.writeValueWithResponse = async (value) => { remoteWrites.push([...value]) }
  const device = (ch: unknown) => {
    const d = new EventTarget() as EventTarget & { gatt: { connect: () => Promise<unknown>; disconnect: () => void } }
    d.gatt = { connect: async () => ({ connected: true, getPrimaryService: async () => ({ getCharacteristic: async () => ch }) }), disconnect: () => d.dispatchEvent(new Event('gattserverdisconnected')) }
    return d
  }
  const cube = device({ writeValueWithResponse: async (value: Uint8Array) => { cubeWrites.push(new TextDecoder().decode(value)) } })
  const remote = device(characteristic)
  const requestDevice = vi.fn<() => Promise<typeof remote>>().mockResolvedValueOnce(remote).mockResolvedValueOnce(cube).mockResolvedValueOnce(remote)
  vi.stubGlobal('navigator', { bluetooth: { requestDevice } })
  const view = mount(HomeView)
  const connect = () => view.findAll('button').filter((button) => button.text() === 'Connetti')
  await connect()[1]!.trigger('click')
  await flushPromises()
  expect(requestDevice).toHaveBeenCalledWith({ filters: [{ services: ['00001623-1212-efde-1623-785feabcd123'] }] })
  const notify = (bytes: number[]) => {
    characteristic.value = new DataView(Uint8Array.from(bytes).buffer)
    characteristic.dispatchEvent(new Event('characteristicvaluechanged'))
  }
  notify([5, 0, 0x45, 0, 1])
  expect(view.get('[data-testid="step"]').text()).toBe('0')
  notify([5, 0, 0x04, 0x3c, 1])
  await vi.advanceTimersByTimeAsync(99)
  expect(remoteWrites).toEqual([])
  await vi.advanceTimersByTimeAsync(1)
  expect(remoteWrites).toEqual([[0x41, 0, 0, 1, 0, 0, 0, 1]])
  await vi.advanceTimersByTimeAsync(100)
  expect(remoteWrites).toEqual([[0x41, 0, 0, 1, 0, 0, 0, 1], [0x41, 1, 0, 1, 0, 0, 0, 1]])
  await connect()[0]!.trigger('click')
  await flushPromises()
  notify([5, 0, 0x45, 1, 1])
  notify([5, 0, 0x08, 0, 1])
  notify([5, 0, 0x45, 0, 1])
  notify([5, 0, 0x45, 0, 0])
  await flushPromises()
  expect(view.get('[data-testid="step"]').text()).toBe('+1')
  notify([5, 0, 0x45, 0, 0xff])
  notify([5, 0, 0x45, 0, 0xff])
  notify([5, 0, 0x45, 0, 0x7f])
  notify([5, 0, 0x45, 0, 1])
  await flushPromises()
  remote.dispatchEvent(new Event('gattserverdisconnected'))
  await flushPromises()
  expect(view.get('[data-testid="step"]').text()).toBe('0')
  expect(cubeWrites).toEqual(['+080a', '+000a', '-080a', '+000a', '+080a', '+000a'])
  await connect()[0]!.trigger('click')
  await flushPromises()
  notify([5, 0, 0x45, 0, 1])
  await flushPromises()
  await view.findAll('button').filter((button) => button.text() === 'Disconnetti')[1]!.trigger('click')
  await flushPromises()
  expect(view.get('[data-testid="step"]').text()).toBe('0')
  expect(cubeWrites.slice(-2)).toEqual(['+080a', '+000a'])
  view.unmount()
})
