import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import HomeView from '../views/HomeView.vue'
import { batteryDevice, batteryNotifications, connectionButton } from './battery-fixture'

afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
  vi.unstubAllGlobals()
})

it('salva le impostazioni, consente le modifiche solo con la Locomotive ferma e applica Channel e Power', async () => {
  vi.useFakeTimers()
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
  await connectionButton(reloaded, 'Battery Cube').trigger('click')
  await flushPromises()
  await reloaded.get('button[aria-label="Aumenta marcia"]').trigger('click')
  await vi.advanceTimersByTimeAsync(500)
  expect(writes).toEqual(['b', '-055b', '-065b', '-075b', '-085b', '-095b', '-100b'])
  expect((reloaded.get('fieldset[disabled]').element as HTMLFieldSetElement).disabled).toBe(true)
  reloaded.unmount()
})

it.each(['#min-power', '#max-power'])('valida il limite della Power in %s', async (selector) => {
  vi.stubGlobal('navigator', {})
  const view = mount(HomeView)
  if (selector === '#max-power') await view.get('#min-power').setValue(55)
  const input = view.get(selector)
  const previous = (input.element as HTMLInputElement).value
  expect(input.attributes('min')).toBe('55')
  await input.setValue(54)
  expect(view.get('#power-error').text()).toBe(
    'Inserisci un valore intero tra 55 e 255; la Power minima non può superare la massima.',
  )
  expect((input.element as HTMLInputElement).value).toBe(previous)
  await input.setValue(55)
  expect((input.element as HTMLInputElement).value).toBe('55')
  expect(view.find('#power-error').exists()).toBe(false)
  view.unmount()
})

it('ricarica la Power minima salvata non valida al default', () => {
  vi.stubGlobal('navigator', {})
  localStorage.setItem('control-desk-settings', '{"minPower":30,"maxPower":200}')
  const view = mount(HomeView)
  expect((view.get('#min-power').element as HTMLInputElement).value).toBe('80')
  expect((view.get('#max-power').element as HTMLInputElement).value).toBe('200')
  view.unmount()
})

it('salva e ricarica Inerzia, ripristinando il valore precedente se non valido', async () => {
  vi.stubGlobal('navigator', {})
  const view = mount(HomeView)
  await view.get('#inertia').setValue(5.5)
  await view.get('#inertia').setValue(5.3)
  expect(view.get('#inertia-error').text()).toContain('0,5')
  expect((view.get('#inertia').element as HTMLInputElement).value).toBe('5.5')
  view.unmount()
  const reloaded = mount(HomeView)
  expect((reloaded.get('#inertia').element as HTMLInputElement).value).toBe('5.5')
  reloaded.unmount()
})

it('applica Inerzia 0 immediatamente e Inerzia 5 alla guida successiva', async () => {
  vi.useFakeTimers()
  const writes: string[] = []
  const device = batteryDevice(
    { properties: { write: true }, writeValueWithResponse: async (value: Uint8Array) => {
      writes.push(new TextDecoder().decode(value))
    } },
    batteryNotifications(),
  )
  vi.stubGlobal('navigator', { bluetooth: { requestDevice: async () => device } })
  const view = mount(HomeView)
  await view.get('#inertia').setValue(0)
  await connectionButton(view, 'Battery Cube').trigger('click')
  await vi.advanceTimersByTimeAsync(0)
  for (let i = 0; i < 5; i++) await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await vi.advanceTimersByTimeAsync(0)
  expect(view.get('[data-testid="power"]').text()).toBe('Power 255')
  expect(writes[writes.length - 1]).toBe('+255a')
  expect(view.get('#inertia').element.closest('fieldset[disabled]')).not.toBeNull()
  await view.findAll('button').find((button) => button.text() === 'Stop')!.trigger('click')
  await view.get('#inertia').setValue(5)
  for (let i = 0; i < 5; i++) await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await vi.advanceTimersByTimeAsync(2500)
  expect(view.get('[data-testid="power"]').text()).toBe('Power 155')
  await vi.advanceTimersByTimeAsync(2500)
  expect(view.get('[data-testid="power"]').text()).toBe('Power 255')
  view.unmount()
})

it('mostra la Power fuori dalle regioni live e blocca le impostazioni durante la frenata', async () => {
  vi.useFakeTimers()
  const device = batteryDevice(
    { properties: { write: true }, writeValueWithResponse: async () => {} },
    batteryNotifications(),
  )
  vi.stubGlobal('navigator', { bluetooth: { requestDevice: async () => device } })
  const view = mount(HomeView)
  await connectionButton(view, 'Battery Cube').trigger('click')
  await vi.advanceTimersByTimeAsync(0)
  for (let i = 0; i < 5; i++) await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await vi.advanceTimersByTimeAsync(1000)
  for (let i = 0; i < 5; i++) await view.get('[aria-label="Diminuisci marcia"]').trigger('click')
  const display = view.get('[data-testid="power"]')
  expect(display.text()).toBe('Power 155')
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
        return message === '+055a' ? blocked : Promise.resolve()
      },
    },
    batteryNotifications(),
  )
  vi.stubGlobal('navigator', { bluetooth: { requestDevice: async () => device } })
  const view = mount(HomeView)
  await connectionButton(view, 'Battery Cube').trigger('click')
  await vi.advanceTimersByTimeAsync(0)
  for (let i = 0; i < 5; i++) await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await vi.advanceTimersByTimeAsync(500)
  expect(messages).toEqual(['b', '+055a'])
  finish()
  await vi.advanceTimersByTimeAsync(0)
  expect(messages).toEqual(['b', '+055a', '+105a'])
  await vi.advanceTimersByTimeAsync(100)
  expect(messages).toEqual(['b', '+055a', '+105a', '+115a'])
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
  await connectionButton(view, 'Battery Cube').trigger('click')
  await flushPromises()
  await connectionButton(view, 'Remote').trigger('click')
  await flushPromises()
  for (const port of [0, 1]) {
    characteristic.value = new DataView(Uint8Array.from([5, 0, 0x45, port, 1]).buffer)
    characteristic.dispatchEvent(new Event('characteristicvaluechanged'))
  }
  await flushPromises()
  expect(writes).toEqual(['b', '+055a'])
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
