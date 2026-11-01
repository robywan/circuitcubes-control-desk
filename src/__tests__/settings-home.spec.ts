import { DOMWrapper, enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import HomeView from '../views/HomeView.vue'
import { batteryDevice, batteryNotifications, connectionButton, openSettings } from './battery-fixture'

enableAutoUnmount(afterEach)

afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
  vi.unstubAllGlobals()
})

it('apre le Impostazioni nello Sheet', async () => {
  const view = mount(HomeView, { attachTo: document.body })
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  const trigger = view.get('button[aria-label="Impostazioni"]')
  ;(trigger.element as HTMLButtonElement).focus()
  await trigger.trigger('click')
  await flushPromises()
  const dialog = document.querySelector('[role="dialog"]')!
  expect(dialog.textContent).toContain('Impostazioni')
  expect(dialog.contains(document.activeElement)).toBe(true)
  await new DOMWrapper(document.body).get('button[data-slot="sheet-close"]').trigger('click')
  await flushPromises()
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  expect(document.activeElement).toBe(trigger.element)
  view.unmount()
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
  const view = mount(HomeView, { attachTo: document.body })
  const sheet = await openSettings(view)
  expect(sheet.get('[role="radiogroup"][aria-labelledby="channel-label"]').text()).toContain('Channel')
  await sheet.get('button[role="radio"][value="B"]').trigger('click')
  await sheet.get('button[role="switch"]').trigger('click')
  await sheet.get('#min-power').setValue('100')
  await sheet.get('#min-power').trigger('blur')
  await sheet.get('#max-power').setValue('99')
  await sheet.get('#max-power').trigger('blur')
  expect((sheet.get('#max-power').element as HTMLInputElement).value).toBe('100')
  expect(sheet.get('[role="radiogroup"][aria-labelledby="remote-side-label"]').text()).toContain('Lato del Remote')
  await sheet.get('button[role="radio"][value="right"]').trigger('click')
  view.unmount()
  const reloaded = mount(HomeView, { attachTo: document.body })
  const reloadedSheet = await openSettings(reloaded)
  expect(reloadedSheet.get('button[role="radio"][value="B"]').attributes('aria-checked')).toBe('true')
  expect(reloadedSheet.get('button[role="switch"]').attributes('aria-checked')).toBe('true')
  expect((reloadedSheet.get('#min-power').element as HTMLInputElement).value).toBe('100')
  expect(reloadedSheet.get('button[role="radio"][value="right"]').attributes('aria-checked')).toBe('true')
  await connectionButton(reloaded, 'Battery Cube').trigger('click')
  await flushPromises()
  await reloaded.get('button[aria-label="Aumenta marcia"]').trigger('click')
  await vi.advanceTimersByTimeAsync(500)
  expect(writes).toEqual(['b', '-055b', '-057b', '-060b', '-062b', '-064b', '-066b'])
  expect((reloadedSheet.get('fieldset[disabled]').element as HTMLFieldSetElement).disabled).toBe(true)
  for (const control of reloadedSheet.findAll('[role="radio"], [role="switch"]')) {
    expect((control.element as HTMLButtonElement).disabled).toBe(true)
  }
  await reloadedSheet.get('button[role="radio"][value="A"]').trigger('click')
  await reloadedSheet.get('button[role="switch"]').trigger('click')
  expect(reloadedSheet.get('button[role="radio"][value="B"]').attributes('aria-checked')).toBe('true')
  expect(reloadedSheet.get('button[role="switch"]').attributes('aria-checked')).toBe('true')
  reloaded.unmount()
})

it('riporta la Power minima al limite dinamico quando si lascia il campo', async () => {
  vi.stubGlobal('navigator', {})
  const view = mount(HomeView, { attachTo: document.body })
  const sheet = await openSettings(view)
  const max = sheet.get('#max-power')
  await max.setValue('100')
  await max.trigger('blur')
  const min = sheet.get('#min-power')
  await min.setValue('150')
  await min.trigger('blur')
  expect((min.element as HTMLInputElement).value).toBe('100')
  view.unmount()
})

it('riporta ai limiti fissi e dinamici e consente i pulsanti', async () => {
  vi.stubGlobal('navigator', {})
  const view = mount(HomeView, { attachTo: document.body })
  const sheet = await openSettings(view)
  const edit = async (selector: string, value: string) => {
    const input = sheet.get(selector)
    await input.setValue(value)
    await input.trigger('blur')
    return (input.element as HTMLInputElement).value
  }
  expect(await edit('#min-power', '0')).toBe('55')
  expect(await edit('#max-power', '300')).toBe('255')
  expect(await edit('#min-power', '120')).toBe('120')
  expect(await edit('#max-power', '80')).toBe('120')
  expect(await edit('#inertia', '11')).toBe('10')
  expect(await edit('#inertia', '-1')).toBe('0')
  expect(await edit('#inertia', '')).toBe('0')
  await sheet.get('[aria-label="Aumenta Inerzia"]').trigger('pointerdown', { pointerType: 'mouse' })
  window.dispatchEvent(new Event('pointerup'))
  expect((sheet.get('#inertia').element as HTMLInputElement).value).toBe('0,5')
  await sheet.get('[aria-label="Diminuisci Inerzia"]').trigger('pointerdown', { pointerType: 'mouse' })
  window.dispatchEvent(new Event('pointerup'))
  expect((sheet.get('#inertia').element as HTMLInputElement).value).toBe('0')
  view.unmount()
})

it('ricarica la Power minima salvata non valida al default', async () => {
  vi.stubGlobal('navigator', {})
  localStorage.setItem('control-desk-settings', '{"minPower":30,"maxPower":200}')
  const view = mount(HomeView, { attachTo: document.body })
  const sheet = await openSettings(view)
  expect((sheet.get('#min-power').element as HTMLInputElement).value).toBe('80')
  expect((sheet.get('#max-power').element as HTMLInputElement).value).toBe('200')
  view.unmount()
})

it('arrotonda e salva Inerzia con la virgola', async () => {
  vi.stubGlobal('navigator', {})
  const view = mount(HomeView, { attachTo: document.body })
  const sheet = await openSettings(view)
  await sheet.get('#inertia').setValue('5,3')
  await sheet.get('#inertia').trigger('blur')
  expect((sheet.get('#inertia').element as HTMLInputElement).value).toBe('5,5')
  view.unmount()
  const reloaded = mount(HomeView, { attachTo: document.body })
  const reloadedSheet = await openSettings(reloaded)
  expect((reloadedSheet.get('#inertia').element as HTMLInputElement).value).toBe('5,5')
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
  const view = mount(HomeView, { attachTo: document.body })
  const sheet = await openSettings(view)
  await sheet.get('#inertia').setValue('0')
  await sheet.get('#inertia').trigger('blur')
  await connectionButton(view, 'Battery Cube').trigger('click')
  await vi.advanceTimersByTimeAsync(0)
  for (let i = 0; i < 5; i++) await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await vi.advanceTimersByTimeAsync(0)
  expect(view.get('[data-testid="power"]').text()).toBe('Power 255')
  expect(writes[writes.length - 1]).toBe('+255a')
  expect(sheet.get('#inertia').element.closest('fieldset[disabled]')).not.toBeNull()
  await view.findAll('button').find((button) => button.text() === 'Stop')!.trigger('click')
  await sheet.get('#inertia').setValue('5')
  await sheet.get('#inertia').trigger('blur')
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
  const view = mount(HomeView, { attachTo: document.body })
  const sheet = await openSettings(view)
  await connectionButton(view, 'Battery Cube').trigger('click')
  await vi.advanceTimersByTimeAsync(0)
  expect(sheet.find('fieldset[disabled]').exists()).toBe(false)
  await sheet.get('#inertia').setValue('8')
  for (let i = 0; i < 5; i++) await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  expect((sheet.get('#inertia').element as HTMLInputElement).value).toBe('2')
  for (const selector of ['#min-power', '#max-power', '#inertia', '[aria-label="Aumenta Inerzia"]']) {
    expect((sheet.get(selector).element as HTMLInputElement).disabled).toBe(true)
  }
  expect(sheet.get('[role="alert"]').text()).toContain('Ferma la Locomotive per modificare le Impostazioni')
  expect(sheet.find('fieldset[disabled]').exists()).toBe(true)
  await vi.advanceTimersByTimeAsync(1000)
  for (let i = 0; i < 5; i++) await view.get('[aria-label="Diminuisci marcia"]').trigger('click')
  const display = view.get('[data-testid="power"]')
  expect(display.text()).toBe('Power 155')
  expect(display.element.closest('output, [aria-live], [role="status"], [role="alert"]')).toBeNull()
  expect(sheet.find('fieldset[disabled]').exists()).toBe(true)
  expect(sheet.get('[role="alert"]').text()).toContain('Ferma la Locomotive')
  for (const control of sheet.findAll('[role="radio"], [role="switch"]')) {
    expect((control.element as HTMLButtonElement).disabled).toBe(true)
  }
  await vi.advanceTimersByTimeAsync(1000)
  await view.vm.$nextTick()
  expect(display.text()).toBe('Power 0')
  expect(sheet.find('fieldset[disabled]').exists()).toBe(false)
  expect(sheet.find('[role="alert"]').exists()).toBe(false)
  for (const control of sheet.findAll('[role="radio"], [role="switch"]')) {
    expect((control.element as HTMLButtonElement).disabled).toBe(false)
  }
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
  const view = mount(HomeView, { attachTo: document.body })
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
  const setup = mount(HomeView, { attachTo: document.body })
  const setupSheet = await openSettings(setup)
  await setupSheet.get('button[role="radio"][value="right"]').trigger('click')
  setup.unmount()
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
  const view = mount(HomeView, { attachTo: document.body })
  await connectionButton(view, 'Battery Cube').trigger('click')
  await flushPromises()
  await connectionButton(view, 'Remote').trigger('click')
  await flushPromises()
  const sheet = await openSettings(view)
  expect(sheet.get('button[role="radio"][value="right"]').attributes('aria-checked')).toBe('true')
  expect(sheet.find('fieldset[disabled]').exists()).toBe(false)
  for (const port of [0, 1]) {
    characteristic.value = new DataView(Uint8Array.from([5, 0, 0x45, port, 1]).buffer)
    characteristic.dispatchEvent(new Event('characteristicvaluechanged'))
  }
  await flushPromises()
  expect(writes).toEqual(['b', '+055a'])
  expect(view.get('[data-testid="step"]').text()).toBe('+1')
  expect(sheet.find('fieldset[disabled]').exists()).toBe(true)
  expect(sheet.get('[role="alert"]').text()).toContain('Ferma la Locomotive')
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
  const view = mount(HomeView, { attachTo: document.body })
  const sheet = await openSettings(view)
  await sheet.get('button[role="radio"][value="B"]').trigger('click')
  expect(sheet.get('button[role="radio"][value="B"]').attributes('aria-checked')).toBe('true')
  view.unmount()
})
