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
  const remote = batteryDevice(
    Object.assign(new EventTarget(), {
      startNotifications: async () => {},
      writeValueWithResponse: async () => {},
    }),
    batteryNotifications(),
  )
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
  return { view, messages, remote }
}

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
