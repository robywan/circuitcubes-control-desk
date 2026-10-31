import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import HomeView from '../views/HomeView.vue'

afterEach(() => { localStorage.clear(); vi.unstubAllGlobals() })

it('salva le impostazioni, consente le modifiche solo con la Locomotive ferma e applica Channel e Power', async () => {
  const writes: string[] = []
  const device = new EventTarget() as EventTarget & { gatt: { connect: () => Promise<unknown>; disconnect: () => void } }
  device.gatt = { connect: async () => ({ connected: true, getPrimaryService: async () => ({ getCharacteristic: async () => ({ writeValueWithResponse: async (v: Uint8Array) => { writes.push(new TextDecoder().decode(v)) } }) }) }), disconnect: () => {} }
  vi.stubGlobal('navigator', { bluetooth: { requestDevice: async () => device } })
  const view = mount(HomeView)
  await view.get('input[value="B"]').setValue()
  await view.get('input[type="checkbox"]').setValue(true)
  await view.get('#min-power').setValue(100)
  await view.get('#max-power').setValue(99)
  expect(view.get('[role="alert"]').text()).toContain('Power minima')
  expect((view.get('#max-power').element as HTMLInputElement).value).toBe('255')
  await view.get('input[value="right"]').setValue()
  view.unmount()
  const reloaded = mount(HomeView)
  expect((reloaded.get('input[value="B"]').element as HTMLInputElement).checked).toBe(true)
  expect((reloaded.get('#min-power').element as HTMLInputElement).value).toBe('100')
  expect((reloaded.get('input[value="right"]').element as HTMLInputElement).checked).toBe(true)
  await reloaded.get('button').trigger('click')
  await flushPromises()
  await reloaded.get('button[aria-label="Aumenta marcia"]').trigger('click')
  await flushPromises()
  expect(writes).toEqual(['-100b'])
  expect((reloaded.get('fieldset[disabled]').element as HTMLFieldSetElement).disabled).toBe(true)
  reloaded.unmount()
})

it('usa solo il lato Remote configurato', async () => {
  localStorage.setItem('control-desk-settings', JSON.stringify({ remoteSide: 'right' }))
  const characteristic = new EventTarget() as EventTarget & { value: DataView; startNotifications: () => Promise<unknown> }
  characteristic.startNotifications = async () => characteristic
  const device = (ch: unknown) => {
    const d = new EventTarget() as EventTarget & { gatt: { connect: () => Promise<unknown>; disconnect: () => void } }
    d.gatt = { connect: async () => ({ connected: true, getPrimaryService: async () => ({ getCharacteristic: async () => ch }) }), disconnect: () => {} }
    return d
  }
  const writes: string[] = []
  const cube = device({ writeValueWithResponse: async (v: Uint8Array) => { writes.push(new TextDecoder().decode(v)) } })
  const remote = device(characteristic)
  vi.stubGlobal('navigator', { bluetooth: { requestDevice: vi.fn<() => Promise<typeof cube>>().mockResolvedValueOnce(cube).mockResolvedValueOnce(remote) } })
  const view = mount(HomeView)
  await view.findAll('button')[0]!.trigger('click')
  await flushPromises()
  await view.findAll('button')[1]!.trigger('click')
  await flushPromises()
  for (const port of [0, 1]) {
    characteristic.value = new DataView(Uint8Array.from([5, 0, 0x45, port, 1]).buffer)
    characteristic.dispatchEvent(new Event('characteristicvaluechanged'))
  }
  await flushPromises()
  expect(writes).toEqual(['+080a'])
  expect(view.get('[data-testid="step"]').text()).toBe('+1')
  view.unmount()
})

it('funziona anche quando localStorage non è disponibile', async () => {
  vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') }, clear: () => {} })
  vi.stubGlobal('navigator', {})
  const view = mount(HomeView)
  await view.get('input[value="B"]').setValue()
  expect((view.get('input[value="B"]').element as HTMLInputElement).checked).toBe(true)
  view.unmount()
})
