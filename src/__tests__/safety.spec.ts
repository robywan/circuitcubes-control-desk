import { expect, it, vi, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import HomeView from '../views/HomeView.vue'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('se una scrittura fallisce disabilita la guida e mantiene visibile l’errore anche dopo la disconnessione', async () => {
  const error = new Error('write failed')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const device = new EventTarget() as EventTarget & { gatt: unknown }
  const characteristic = { writeValueWithResponse: vi.fn<() => Promise<void>>().mockRejectedValue(error) }
  device.gatt = {
    connect: async () => ({ connected: true, getPrimaryService: async () => ({ getCharacteristic: async () => characteristic }) }),
    disconnect: () => {},
  }
  vi.stubGlobal('navigator', { bluetooth: { requestDevice: async () => device } })
  const view = mount(HomeView)
  await view.get('button').trigger('click')
  await flushPromises()
  await view.findAll('button')[3]!.trigger('click')
  await flushPromises()
  device.dispatchEvent(new Event('gattserverdisconnected'))
  await flushPromises()
  expect(view.text()).toContain('Errore di scrittura')
  expect(view.get('[data-testid="step"]').text()).toBe('0')
  expect(view.findAll('button')[3]!.attributes('disabled')).toBeDefined()
  expect(console.error).toHaveBeenCalledWith(error)
})

it('ferma il Battery Cube prima della disconnessione volontaria', async () => {

  const messages: string[] = []

  const device = new EventTarget() as EventTarget & { gatt: unknown }

  device.gatt = {

    connect: async () => ({ connected: true, getPrimaryService: async () => ({ getCharacteristic: async () => ({ writeValueWithResponse: async (value: Uint8Array) => { messages.push(new TextDecoder().decode(value)) } }) }) }),

    disconnect: () => { messages.push('disconnect') },

  }

  vi.stubGlobal('navigator', { bluetooth: { requestDevice: async () => device } })

  const view = mount(HomeView)

  await view.get('button').trigger('click')

  await flushPromises()

  await view.findAll('button')[3]!.trigger('click')

  await view.get('button').trigger('click')

  await flushPromises()

  expect(messages).toEqual(['+080a', '+000a', 'disconnect'])

  expect(view.get('[data-testid="step"]').text()).toBe('0')

})
