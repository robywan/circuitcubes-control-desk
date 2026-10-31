import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import HomeView from '../views/HomeView.vue'
import { batteryDevice, batteryNotifications } from './battery-fixture'

afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
  vi.unstubAllGlobals()
})

it('salva le impostazioni, consente le modifiche solo con la Locomotive ferma e applica Channel e Power', async () => {
  const writes: string[] = []
  const device = batteryDevice(
    {
      properties: { write: true, writeWithoutResponse: false },
      writeValueWithResponse: async (v: Uint8Array) => {
        writes.push(new TextDecoder().decode(v))
      },
    },
    batteryNotifications(),
  )
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
  expect(writes).toEqual(['b', '-100b'])
  expect((reloaded.get('fieldset[disabled]').element as HTMLFieldSetElement).disabled).toBe(true)
  reloaded.unmount()
})

it('mostra la Power fuori dalle regioni live e blocca le impostazioni durante la frenata', async () => {
  vi.useFakeTimers()
  const device = batteryDevice(
    { properties: { write: true }, writeValueWithResponse: async () => {} },
    batteryNotifications(),
  )
  vi.stubGlobal('navigator', { bluetooth: { requestDevice: async () => device } })
  const view = mount(HomeView)
  await view.get('button').trigger('click')
  await vi.advanceTimersByTimeAsync(0)
  for (let i = 0; i < 5; i++) await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await vi.advanceTimersByTimeAsync(1000)
  for (let i = 0; i < 5; i++) await view.get('[aria-label="Diminuisci marcia"]').trigger('click')
  const display = view.get('[data-testid="power"]')
  expect(display.text()).toBe('Power 168')
  expect(display.element.closest('output, [aria-live], [role="status"], [role="alert"]')).toBeNull()
  expect(view.find('fieldset[disabled]').exists()).toBe(true)
  await vi.advanceTimersByTimeAsync(1000)
  await view.vm.$nextTick()
  expect(display.text()).toBe('Power 0')
  expect(view.find('fieldset[disabled]').exists()).toBe(false)
  view.unmount()
  vi.useRealTimers()
})

it('accoda solo la Power più recente se una scrittura è lenta', async () => {
  vi.useFakeTimers()
  const messages: string[] = []
  let finish!: () => void
  const blocked = new Promise<void>((resolve) => {
    finish = resolve
  })
  const device = batteryDevice(
    {
      properties: { write: true },
      writeValueWithResponse: (value: Uint8Array) => {
        const message = new TextDecoder().decode(value)
        messages.push(message)
        return message === '+080a' ? blocked : Promise.resolve()
      },
    },
    batteryNotifications(),
  )
  vi.stubGlobal('navigator', { bluetooth: { requestDevice: async () => device } })
  const view = mount(HomeView)
  await view.get('button').trigger('click')
  await vi.advanceTimersByTimeAsync(0)
  for (let i = 0; i < 5; i++) await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await vi.advanceTimersByTimeAsync(500)
  expect(messages).toEqual(['b', '+080a'])
  finish()
  await vi.advanceTimersByTimeAsync(0)
  expect(messages).toEqual(['b', '+080a', '+124a'])
  await vi.advanceTimersByTimeAsync(100)
  expect(messages).toEqual(['b', '+080a', '+124a', '+133a'])
  await view
    .findAll('button')
    .find((button) => button.text() === 'Stop')!
    .trigger('click')
  await vi.advanceTimersByTimeAsync(0)
  expect(messages[messages.length - 1]).toBe('+000a')
  expect(view.get('[data-testid="power"]').text()).toBe('Power 0')
  await vi.advanceTimersByTimeAsync(1000)
  expect(messages[messages.length - 1]).toBe('+000a')
  view.unmount()
})

it('usa solo il lato Remote configurato', async () => {
  localStorage.setItem('control-desk-settings', JSON.stringify({ remoteSide: 'right' }))
  const characteristic = new EventTarget() as EventTarget & {
    value: DataView
    startNotifications: () => Promise<unknown>
  }
  characteristic.startNotifications = async () => characteristic
  const device = (ch: unknown) => batteryDevice(ch, batteryNotifications())
  const writes: string[] = []
  const cube = device({
    properties: { write: true, writeWithoutResponse: false },
    writeValueWithResponse: async (v: Uint8Array) => {
      writes.push(new TextDecoder().decode(v))
    },
  })
  const remote = device(characteristic)
  vi.stubGlobal('navigator', {
    bluetooth: {
      requestDevice: vi
        .fn<() => Promise<typeof cube>>()
        .mockResolvedValueOnce(cube)
        .mockResolvedValueOnce(remote),
    },
  })
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
  expect(writes).toEqual(['b', '+080a'])
  expect(view.get('[data-testid="step"]').text()).toBe('+1')
  view.unmount()
})

it('funziona anche quando localStorage non è disponibile', async () => {
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('denied')
    },
    setItem: () => {
      throw new Error('denied')
    },
    clear: () => {},
  })
  vi.stubGlobal('navigator', {})
  const view = mount(HomeView)
  await view.get('input[value="B"]').setValue()
  expect((view.get('input[value="B"]').element as HTMLInputElement).checked).toBe(true)
  view.unmount()
})
