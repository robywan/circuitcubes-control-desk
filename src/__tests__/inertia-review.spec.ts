import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import HomeView from '../views/HomeView.vue'
import { batteryDevice, batteryNotifications, connectionButton } from './battery-fixture'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

async function connect() {
  vi.useFakeTimers()
  const messages: string[] = []
  const cube = batteryDevice(
    {
      properties: { write: true },
      writeValueWithResponse: async (value: Uint8Array) => {
        messages.push(new TextDecoder().decode(value))
      },
    },
    batteryNotifications(),
    () => {
      messages.push('disconnect')
    },
  )
  const characteristic = Object.assign(new EventTarget(), {
    value: new DataView(new ArrayBuffer(0)),
    startNotifications: async () => {},
    writeValueWithResponse: async () => {},
  })
  const remote = batteryDevice(characteristic, batteryNotifications())
  vi.stubGlobal('navigator', {
    wakeLock: {
      request: async () => Object.assign(new EventTarget(), { release: async () => {} }),
    },
    bluetooth: {
      requestDevice: vi
        .fn<() => Promise<typeof cube | typeof remote>>()
        .mockResolvedValueOnce(cube)
        .mockResolvedValueOnce(remote),
    },
  })
  const view = mount(HomeView, { attachTo: document.body })
  await connectionButton(view, 'Battery Cube').trigger('click')
  await flushPromises()
  return { view, messages, remote, characteristic }
}

it.each([
  ['Aumenta marcia', 'Diminuisci marcia', '+', '−1'],
  ['Diminuisci marcia', 'Aumenta marcia', '-', '+1'],
])('accelera e frena allo Speed step 1 in entrambe le Direction: %s', async (start, brake, sign, oppositeStep) => {
  const { view, messages } = await connect()
  await view.get(`[aria-label="${start}"]`).trigger('click')
  await flushPromises()
  expect(messages).toEqual(['b', `${sign}055a`])
  await vi.advanceTimersByTimeAsync(300)
  expect(messages).toEqual(['b', `${sign}055a`, `${sign}065a`, `${sign}075a`, `${sign}080a`])
  expect(view.get('[data-testid="power"]').text()).toBe('Power 80')
  await view.get(`[aria-label="${brake}"]`).trigger('click')
  await vi.advanceTimersByTimeAsync(250)
  expect(view.get('[data-testid="power"]').text()).toBe('Power 60')
  await vi.advanceTimersByTimeAsync(50)
  expect(messages.slice(-3)).toEqual([`${sign}070a`, `${sign}060a`, '+000a'])
  expect(view.get('[data-testid="power"]').text()).toBe('Power 0')
  await view.get(`[aria-label="${brake}"]`).trigger('click')
  await flushPromises()
  expect(view.get('[data-testid="step"]').text()).toBe(oppositeStep)
  expect(messages[messages.length - 1]).toBe(`${sign === '+' ? '-' : '+'}055a`)
  view.unmount()
})

it.each(['schermo', 'Remote'])('Stop %s ferma subito durante l’accelerazione allo Speed step 1', async (kind) => {
  const { view, messages, characteristic } = await connect()
  if (kind === 'Remote') {
    await connectionButton(view, 'Remote').trigger('click')
    await flushPromises()
  }
  await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await vi.advanceTimersByTimeAsync(100)
  expect(view.get('[data-testid="power"]').text()).toBe('Power 65')
  if (kind === 'schermo') await view.findAll('button').find((button) => button.text() === 'Stop')!.trigger('click')
  else {
    characteristic.value = new DataView(Uint8Array.from([5, 0, 0x45, 0, 0x7f]).buffer)
    characteristic.dispatchEvent(new Event('characteristicvaluechanged'))
  }
  await flushPromises()
  expect(view.get('[data-testid="power"]').text()).toBe('Power 0')
  expect(view.get('[data-testid="step"]').text()).toBe('0')
  expect(messages[messages.length - 1]).toBe('+000a')
  await vi.advanceTimersByTimeAsync(500)
  expect(messages[messages.length - 1]).toBe('+000a')
  view.unmount()
})

async function accelerateToPower155() {
  const connection = await connect()
  const { view } = connection
  const plus = view.get('[aria-label="Aumenta marcia"]')
  const minus = view.get('[aria-label="Diminuisci marcia"]')
  for (let i = 0; i < 5; i++) await plus.trigger('click')
  await vi.advanceTimersByTimeAsync(1000)
  return { ...connection, plus, minus }
}

it('ignora la Direction opposta fino allo stop, poi parte solo con una nuova pressione', async () => {
  const { view, messages, minus } = await accelerateToPower155()
  for (let i = 0; i < 4; i++) await minus.trigger('click')
  await minus.trigger('click')
  await minus.trigger('click')
  expect(view.get('[data-testid="step"]').text()).toBe('0')
  expect(view.get('[data-testid="power"]').text()).toBe('Power 155')
  await vi.advanceTimersByTimeAsync(100)
  expect(view.get('[data-testid="power"]').text()).toBe('Power 145')
  await vi.advanceTimersByTimeAsync(900)
  expect(view.get('[data-testid="power"]').text()).toBe('Power 0')
  expect(messages).toContain('+000a')
  expect(messages.filter((message) => message.startsWith('-'))).toEqual([])
  await minus.trigger('click')
  await flushPromises()
  expect(view.get('[data-testid="step"]').text()).toBe('−1')
  expect(messages[messages.length - 1]).toBe('-055a')
  view.unmount()
})

it('una pressione ignorata prima del tick ritardato non impedisce l’invio di Power 0', async () => {
  const { view, messages, minus } = await accelerateToPower155()
  for (let i = 0; i < 5; i++) await minus.trigger('click')
  const now = performance.now()
  vi.spyOn(performance, 'now').mockReturnValue(now + 2000)
  await minus.trigger('click')
  expect(view.get('[data-testid="step"]').text()).toBe('0')
  expect(view.get('[data-testid="power"]').text()).toBe('Power 155')
  await vi.advanceTimersByTimeAsync(100)
  expect(view.get('[data-testid="power"]').text()).toBe('Power 0')
  expect(messages[messages.length - 1]).toBe('+000a')
  view.unmount()
})

it('riprende nella stessa Direction dalla Power raggiunta durante la frenata', async () => {
  const { view, plus, minus } = await accelerateToPower155()
  for (let i = 0; i < 5; i++) await minus.trigger('click')
  await vi.advanceTimersByTimeAsync(200)
  expect(view.get('[data-testid="power"]').text()).toBe('Power 135')
  await plus.trigger('click')
  expect(view.get('[data-testid="step"]').text()).toBe('+1')
  expect(view.get('[data-testid="power"]').text()).toBe('Power 135')
  view.unmount()
})

it('ignora la Direction opposta dal Remote fino allo stop', async () => {
  const { view, messages, characteristic } = await connect()
  await connectionButton(view, 'Remote').trigger('click')
  await flushPromises()
  const press = async (button: number) => {
    characteristic.value = new DataView(Uint8Array.from([5, 0, 0x45, 0, button]).buffer)
    characteristic.dispatchEvent(new Event('characteristicvaluechanged'))
    await view.vm.$nextTick()
  }
  for (let i = 0; i < 5; i++) await press(1)
  await vi.advanceTimersByTimeAsync(1000)
  for (let i = 0; i < 6; i++) await press(0xff)
  expect(view.get('[data-testid="step"]').text()).toBe('0')
  await vi.advanceTimersByTimeAsync(100)
  expect(view.get('[data-testid="power"]').text()).toBe('Power 145')
  await vi.advanceTimersByTimeAsync(900)
  expect(messages).toContain('+000a')
  expect(messages.filter((message) => message.startsWith('-'))).toEqual([])
  await press(0xff)
  await flushPromises()
  expect(view.get('[data-testid="step"]').text()).toBe('−1')
  expect(messages[messages.length - 1]).toBe('-055a')
  view.unmount()
})

it.each(['Battery Cube', 'Remote volontario', 'Remote caduta'])(
  'interrompe subito l’accelerazione alla disconnessione: %s',
  async (kind) => {
    const { view, messages, remote } = await connect()
    if (kind !== 'Battery Cube') {
      await connectionButton(view, 'Remote').trigger('click')
      await flushPromises()
    }
    for (let i = 0; i < 5; i++) await view.get('[aria-label="Aumenta marcia"]').trigger('click')
    await vi.advanceTimersByTimeAsync(500)
    expect(view.get('[data-testid="power"]').text()).toBe('Power 105')
    const before = messages.length
    if (kind === 'Remote caduta') remote.dispatchEvent(new Event('gattserverdisconnected'))
    else await connectionButton(view, kind === 'Battery Cube' ? 'Battery Cube' : 'Remote').trigger('click')
    await view.vm.$nextTick()
    expect(view.get('[data-testid="power"]').text()).toBe('Power 0')
    expect(view.get('[data-testid="step"]').text()).toBe('0')
    await flushPromises()
    const stopped = kind === 'Battery Cube' ? ['+000a', 'disconnect'] : ['+000a']
    expect(messages.slice(before)).toEqual(stopped)
    await vi.advanceTimersByTimeAsync(3000)
    expect(messages.slice(before)).toEqual(stopped)
    view.unmount()
  },
)

it('manda il salto iniziale subito e poi scrive solo ai tick di 100 ms', async () => {
  const { view, messages } = await connect()
  for (let i = 0; i < 5; i++) await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await flushPromises()
  expect(messages).toEqual(['b', '+055a'])
  await vi.advanceTimersByTimeAsync(99)
  expect(messages).toEqual(['b', '+055a'])
  await vi.advanceTimersByTimeAsync(1)
  expect(messages).toEqual(['b', '+055a', '+065a'])
  await vi.advanceTimersByTimeAsync(99)
  expect(messages).toEqual(['b', '+055a', '+065a'])
  await vi.advanceTimersByTimeAsync(1)
  expect(messages).toEqual(['b', '+055a', '+065a', '+075a'])
  view.unmount()
})

it('scrive ogni 100 ms solo se cambia la Power intera e termina al target', async () => {
  const { view, messages } = await connect()
  await view.get('button[aria-label="Impostazioni"]').trigger('click')
  const sheet = new DOMWrapper(document.body)
  await sheet.get('#min-power').setValue(55)
  await sheet.get('#max-power').setValue(56)
  for (let i = 0; i < 5; i++) await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await flushPromises()
  expect(messages).toEqual(['b', '+055a'])
  await vi.advanceTimersByTimeAsync(99)
  expect(messages).toEqual(['b', '+055a'])
  await vi.advanceTimersByTimeAsync(1)
  expect(messages).toEqual(['b', '+055a'])
  await vi.advanceTimersByTimeAsync(500)
  expect(messages).toEqual(['b', '+055a'])
  await vi.advanceTimersByTimeAsync(1000)
  expect(messages).toEqual(['b', '+055a', '+056a'])
  await vi.advanceTimersByTimeAsync(500)
  expect(view.get('[data-testid="power"]').text()).toBe('Power 56')
  expect(vi.getTimerCount()).toBe(1)
  await vi.advanceTimersByTimeAsync(1000)
  expect(messages).toEqual(['b', '+055a', '+056a'])
  view.unmount()
})

it('recupera il tempo trascorso con un tick ritardato senza superare il target', async () => {
  const { view, messages } = await connect()
  const now = performance.now()
  for (let i = 0; i < 5; i++) await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await flushPromises()
  vi.spyOn(performance, 'now').mockReturnValue(now + 5000)
  await vi.advanceTimersByTimeAsync(100)
  expect(messages).toEqual(['b', '+055a', '+255a'])
  expect(view.get('[data-testid="power"]').text()).toBe('Power 255')
  await vi.advanceTimersByTimeAsync(1000)
  expect(messages).toEqual(['b', '+055a', '+255a'])
  view.unmount()
})
