import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import HomeView from '../views/HomeView.vue'
import { batteryDevice, batteryNotifications } from './battery-fixture'

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
  const view = mount(HomeView)
  await view.get('button').trigger('click')
  await flushPromises()
  return { view, messages, remote, characteristic }
}

async function accelerateToPower168() {
  const connection = await connect()
  const { view } = connection
  const plus = view.get('[aria-label="Aumenta marcia"]')
  const minus = view.get('[aria-label="Diminuisci marcia"]')
  for (let i = 0; i < 5; i++) await plus.trigger('click')
  await vi.advanceTimersByTimeAsync(1000)
  return { ...connection, plus, minus }
}

it('ignora la Direction opposta fino allo stop, poi parte solo con una nuova pressione', async () => {
  const { view, messages, minus } = await accelerateToPower168()
  for (let i = 0; i < 4; i++) await minus.trigger('click')
  await minus.trigger('click')
  await minus.trigger('click')
  expect(view.get('[data-testid="step"]').text()).toBe('0')
  expect(view.get('[data-testid="power"]').text()).toBe('Power 168')
  await vi.advanceTimersByTimeAsync(100)
  expect(view.get('[data-testid="power"]').text()).toBe('Power 159')
  await vi.advanceTimersByTimeAsync(900)
  expect(view.get('[data-testid="power"]').text()).toBe('Power 0')
  expect(messages).toContain('+000a')
  expect(messages.filter((message) => message.startsWith('-'))).toEqual([])
  await minus.trigger('click')
  await flushPromises()
  expect(view.get('[data-testid="step"]').text()).toBe('−1')
  expect(messages[messages.length - 1]).toBe('-080a')
  view.unmount()
})

it('una pressione ignorata prima del tick ritardato non impedisce l’invio di Power 0', async () => {
  const { view, messages, minus } = await accelerateToPower168()
  for (let i = 0; i < 5; i++) await minus.trigger('click')
  const now = performance.now()
  vi.spyOn(performance, 'now').mockReturnValue(now + 2000)
  await minus.trigger('click')
  expect(view.get('[data-testid="step"]').text()).toBe('0')
  expect(view.get('[data-testid="power"]').text()).toBe('Power 168')
  await vi.advanceTimersByTimeAsync(100)
  expect(view.get('[data-testid="power"]').text()).toBe('Power 0')
  expect(messages[messages.length - 1]).toBe('+000a')
  view.unmount()
})

it('riprende nella stessa Direction dalla Power raggiunta durante la frenata', async () => {
  const { view, plus, minus } = await accelerateToPower168()
  for (let i = 0; i < 5; i++) await minus.trigger('click')
  await vi.advanceTimersByTimeAsync(200)
  expect(view.get('[data-testid="power"]').text()).toBe('Power 150')
  await plus.trigger('click')
  expect(view.get('[data-testid="step"]').text()).toBe('+1')
  expect(view.get('[data-testid="power"]').text()).toBe('Power 150')
  view.unmount()
})

it('ignora la Direction opposta dal Remote fino allo stop', async () => {
  const { view, messages, characteristic } = await connect()
  await view.findAll('button')[1]!.trigger('click')
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
  expect(view.get('[data-testid="power"]').text()).toBe('Power 159')
  await vi.advanceTimersByTimeAsync(900)
  expect(messages).toContain('+000a')
  expect(messages.filter((message) => message.startsWith('-'))).toEqual([])
  await press(0xff)
  await flushPromises()
  expect(view.get('[data-testid="step"]').text()).toBe('−1')
  expect(messages[messages.length - 1]).toBe('-080a')
  view.unmount()
})

it.each(['Battery Cube', 'Remote volontario', 'Remote caduta'])(
  'interrompe subito l’accelerazione alla disconnessione: %s',
  async (kind) => {
    const { view, messages, remote } = await connect()
    if (kind !== 'Battery Cube') {
      await view.findAll('button')[1]!.trigger('click')
      await flushPromises()
    }
    for (let i = 0; i < 5; i++) await view.get('[aria-label="Aumenta marcia"]').trigger('click')
    await vi.advanceTimersByTimeAsync(500)
    expect(view.get('[data-testid="power"]').text()).toBe('Power 124')
    const before = messages.length
    if (kind === 'Remote caduta') remote.dispatchEvent(new Event('gattserverdisconnected'))
    else await view.findAll('button')[kind === 'Battery Cube' ? 0 : 1]!.trigger('click')
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
  expect(messages).toEqual(['b', '+080a'])
  await vi.advanceTimersByTimeAsync(99)
  expect(messages).toEqual(['b', '+080a'])
  await vi.advanceTimersByTimeAsync(1)
  expect(messages).toEqual(['b', '+080a', '+089a'])
  await vi.advanceTimersByTimeAsync(99)
  expect(messages).toEqual(['b', '+080a', '+089a'])
  await vi.advanceTimersByTimeAsync(1)
  expect(messages).toEqual(['b', '+080a', '+089a', '+098a'])
  view.unmount()
})

it('scrive ogni 100 ms solo se cambia la Power intera e termina al target', async () => {
  const { view, messages } = await connect()
  await view.get('#max-power').setValue(82)
  for (let i = 0; i < 5; i++) await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await flushPromises()
  expect(messages).toEqual(['b', '+080a'])
  await vi.advanceTimersByTimeAsync(99)
  expect(messages).toEqual(['b', '+080a'])
  await vi.advanceTimersByTimeAsync(1)
  expect(messages).toEqual(['b', '+080a'])
  await vi.advanceTimersByTimeAsync(500)
  expect(messages).toEqual(['b', '+080a', '+081a'])
  await vi.advanceTimersByTimeAsync(1000)
  expect(messages).toEqual(['b', '+080a', '+081a', '+082a'])
  await vi.advanceTimersByTimeAsync(500)
  expect(view.get('[data-testid="power"]').text()).toBe('Power 82')
  expect(vi.getTimerCount()).toBe(1)
  await vi.advanceTimersByTimeAsync(1000)
  expect(messages).toEqual(['b', '+080a', '+081a', '+082a'])
  view.unmount()
})

it('recupera il tempo trascorso con un tick ritardato senza superare il target', async () => {
  const { view, messages } = await connect()
  const now = performance.now()
  for (let i = 0; i < 5; i++) await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await flushPromises()
  vi.spyOn(performance, 'now').mockReturnValue(now + 5000)
  await vi.advanceTimersByTimeAsync(100)
  expect(messages).toEqual(['b', '+080a', '+255a'])
  expect(view.get('[data-testid="power"]').text()).toBe('Power 255')
  await vi.advanceTimersByTimeAsync(1000)
  expect(messages).toEqual(['b', '+080a', '+255a'])
  view.unmount()
})
