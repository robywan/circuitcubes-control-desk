import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import HomeView from '../views/HomeView.vue'
import {
  batteryDevice,
  batteryNotifications,
  connectionButton,
  openSettings,
} from './battery-fixture'

enableAutoUnmount(afterEach)

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
  return { view, messages, cube, remote, characteristic }
}

it('Freno a schermo riduce la Power e la mantiene al rilascio', async () => {
  const { view, messages } = await connect()
  for (let i = 0; i < 5; i++) await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await vi.advanceTimersByTimeAsync(2000)
  const brake = view.get('button[aria-label="Freno"]')
  await brake.trigger('pointerdown')
  await vi.advanceTimersByTimeAsync(500)
  await brake.trigger('pointerup')
  expect(messages.slice(-5)).toEqual(['+235a', '+215a', '+195a', '+175a', '+155a'])
  expect(view.get('[data-testid="step"]').text()).toBe('+2')
  await vi.advanceTimersByTimeAsync(500)
  expect(view.get('[data-testid="power"]').text()).toBe('Power 155')
  await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await vi.advanceTimersByTimeAsync(200)
  expect(messages.slice(-2)).toEqual(['+165a', '+168a'])
})

it.each([
  ['Aumenta marcia', '+', '+4'],
  ['Diminuisci marcia', '-', '−4'],
])('Freno completa la fermata in entrambe le Direction: %s', async (button, sign, firstStep) => {
  const { view, messages } = await connect()
  for (let i = 0; i < 5; i++) await view.get(`[aria-label="${button}"]`).trigger('click')
  await vi.advanceTimersByTimeAsync(2000)
  const brake = view.get('[aria-label="Freno"]')
  await brake.trigger('pointerdown')
  await vi.advanceTimersByTimeAsync(100)
  expect(view.get('[data-testid="step"]').text()).toBe(firstStep)
  await vi.advanceTimersByTimeAsync(900)
  expect(messages.slice(-10)).toEqual([
    `${sign}235a`,
    `${sign}215a`,
    `${sign}195a`,
    `${sign}175a`,
    `${sign}155a`,
    `${sign}135a`,
    `${sign}115a`,
    `${sign}095a`,
    `${sign}075a`,
    '+000a',
  ])
  expect(view.get('[data-testid="step"]').text()).toBe('0')
})

it('Freno a +1 prosegue dopo il rilascio e permette di ripartire nella stessa Direction', async () => {
  const { view, messages } = await connect()
  await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await vi.advanceTimersByTimeAsync(300)
  const brake = view.get('[aria-label="Freno"]')
  await brake.trigger('pointerdown')
  await vi.advanceTimersByTimeAsync(100)
  await brake.trigger('pointerup')
  expect(messages[messages.length - 1]).toBe('+060a')
  await view.get('[aria-label="Diminuisci marcia"]').trigger('click')
  expect(view.get('[data-testid="step"]').text()).toBe('0')
  await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  expect(view.get('[data-testid="step"]').text()).toBe('+1')
  await vi.advanceTimersByTimeAsync(200)
  expect(messages[messages.length - 1]).toBe('+080a')
})

it('ignora la guida durante Freno e Stop ferma subito', async () => {
  const { view, messages } = await connect()
  await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await vi.advanceTimersByTimeAsync(300)
  await view.get('[aria-label="Freno"]').trigger('pointerdown')
  await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await view.get('[aria-label="Diminuisci marcia"]').trigger('click')
  expect(view.get('[data-testid="step"]').text()).toBe('+1')
  await view
    .findAll('button')
    .find((button) => button.text() === 'Stop')!
    .trigger('click')
  await flushPromises()
  expect(messages[messages.length - 1]).toBe('+000a')
})

it.each(['pointerleave', 'pointercancel', 'blur'])('%s rilascia il Freno', async (event) => {
  const { view } = await connect()
  for (let i = 0; i < 5; i++) await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await vi.advanceTimersByTimeAsync(2000)
  const brake = view.get('[aria-label="Freno"]')
  await brake.trigger('pointerdown')
  await vi.advanceTimersByTimeAsync(500)
  if (event === 'blur') window.dispatchEvent(new Event('blur'))
  else await brake.trigger(event)
  await vi.advanceTimersByTimeAsync(500)
  expect(view.get('[data-testid="power"]').text()).toBe('Power 155')
  expect(brake.attributes('aria-pressed')).toBe('false')
  const sheet = await openSettings(view)
  expect(sheet.find('fieldset[disabled]').exists()).toBe(true)
})

it('dopo il rilascio − riprende dalla Power raggiunta', async () => {
  const { view, messages } = await connect()
  for (let i = 0; i < 5; i++) await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await vi.advanceTimersByTimeAsync(2000)
  const brake = view.get('[aria-label="Freno"]')
  await brake.trigger('pointerdown')
  await vi.advanceTimersByTimeAsync(500)
  await brake.trigger('pointerup')
  await view.get('[aria-label="Diminuisci marcia"]').trigger('click')
  await vi.advanceTimersByTimeAsync(800)
  expect(messages.slice(-8)).toEqual([
    '+145a',
    '+135a',
    '+125a',
    '+115a',
    '+105a',
    '+095a',
    '+085a',
    '+080a',
  ])
  expect(view.get('[data-testid="step"]').text()).toBe('+1')
})

it('Freno da fermo non invia comandi', async () => {
  const { view, messages } = await connect()
  const brake = view.get('[aria-label="Freno"]')
  await brake.trigger('pointerdown')
  await vi.advanceTimersByTimeAsync(1000)
  await brake.trigger('pointerup')
  expect(messages).toEqual(['b'])
  expect(brake.attributes('aria-pressed')).toBe('false')
})

it('rilascia al tempo effettivo tra due tick', async () => {
  const { view, messages } = await connect()
  for (let i = 0; i < 5; i++) await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await vi.advanceTimersByTimeAsync(2000)
  const brake = view.get('[aria-label="Freno"]')
  await brake.trigger('pointerdown')
  await vi.advanceTimersByTimeAsync(150)
  await brake.trigger('pointerup')
  await flushPromises()
  expect(messages.slice(-2)).toEqual(['+235a', '+225a'])
  await vi.advanceTimersByTimeAsync(500)
  expect(view.get('[data-testid="power"]').text()).toBe('Power 225')
})

it('Freno a +1 continua fino a fermarsi dopo il rilascio', async () => {
  const { view, messages } = await connect()
  await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await vi.advanceTimersByTimeAsync(300)
  const brake = view.get('[aria-label="Freno"]')
  await brake.trigger('pointerdown')
  await vi.advanceTimersByTimeAsync(100)
  await brake.trigger('pointerup')
  await vi.advanceTimersByTimeAsync(100)
  expect(messages.slice(-2)).toEqual(['+060a', '+000a'])
})

it('la disconnessione del Battery Cube rilascia il Freno', async () => {
  const { view, cube } = await connect()
  await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  const brake = view.get('[aria-label="Freno"]')
  await brake.trigger('pointerdown')
  expect(brake.attributes('aria-pressed')).toBe('true')
  cube.dispatchEvent(new Event('gattserverdisconnected'))
  await flushPromises()
  expect(brake.attributes('aria-pressed')).toBe('false')
  expect(view.get('[data-testid="power"]').text()).toBe('Power 0')
})

it('la pagina nascosta rilascia il Freno', async () => {
  const { view } = await connect()
  for (let i = 0; i < 5; i++) await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await vi.advanceTimersByTimeAsync(2000)
  const brake = view.get('[aria-label="Freno"]')
  await brake.trigger('pointerdown')
  await vi.advanceTimersByTimeAsync(500)
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
  document.dispatchEvent(new Event('visibilitychange'))
  await vi.advanceTimersByTimeAsync(500)
  expect(view.get('[data-testid="power"]').text()).toBe('Power 155')
})

it('Freno durante accelerazione adegua subito lo Speed step', async () => {
  const { view, messages } = await connect()
  for (let i = 0; i < 5; i++) await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await vi.advanceTimersByTimeAsync(1000)
  await view.get('[aria-label="Freno"]').trigger('pointerdown')
  expect(view.get('[data-testid="step"]').text()).toBe('+2')
  await vi.advanceTimersByTimeAsync(200)
  expect(messages.slice(-2)).toEqual(['+135a', '+115a'])
})

it('Freno completa una fermata con Inerzia anche dopo il rilascio', async () => {
  const { view, messages } = await connect()
  for (let i = 0; i < 5; i++) await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await vi.advanceTimersByTimeAsync(2000)
  for (let i = 0; i < 5; i++) await view.get('[aria-label="Diminuisci marcia"]').trigger('click')
  await vi.advanceTimersByTimeAsync(500)
  const brake = view.get('[aria-label="Freno"]')
  await brake.trigger('pointerdown')
  await vi.advanceTimersByTimeAsync(100)
  await brake.trigger('pointerup')
  await vi.advanceTimersByTimeAsync(700)
  expect(messages.slice(-8)).toEqual([
    '+185a',
    '+165a',
    '+145a',
    '+125a',
    '+105a',
    '+085a',
    '+065a',
    '+000a',
  ])
})

it('con Inerzia 0 Freno resta graduale e + riparte subito', async () => {
  const { view, messages } = await connect()
  const sheet = await openSettings(view)
  await sheet.get('#inertia').setValue('0')
  await sheet.get('#inertia').trigger('blur')
  for (let i = 0; i < 5; i++) await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await flushPromises()
  const brake = view.get('[aria-label="Freno"]')
  await brake.trigger('pointerdown')
  await vi.advanceTimersByTimeAsync(500)
  await brake.trigger('pointerup')
  expect(messages[messages.length - 1]).toBe('+155a')
  await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await flushPromises()
  expect(messages[messages.length - 1]).toBe('+168a')
})

it('Spazio tiene premuto il Freno fino al rilascio', async () => {
  const { view } = await connect()
  for (let i = 0; i < 5; i++) await view.get('[aria-label="Aumenta marcia"]').trigger('click')
  await vi.advanceTimersByTimeAsync(2000)
  const brake = view.get('[aria-label="Freno"]')
  await brake.trigger('keydown', { key: ' ' })
  await vi.advanceTimersByTimeAsync(500)
  await brake.trigger('keyup', { key: ' ' })
  await vi.advanceTimersByTimeAsync(500)
  expect(view.get('[data-testid="power"]').text()).toBe('Power 155')
})

it.each([
  ['Aumenta marcia', 'Diminuisci marcia', '+', '−1'],
  ['Diminuisci marcia', 'Aumenta marcia', '-', '+1'],
])(
  'accelera e frena allo Speed step 1 in entrambe le Direction: %s',
  async (start, brake, sign, oppositeStep) => {
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
  },
)

it.each(['schermo', 'Remote'])(
  'Stop %s ferma subito durante l’accelerazione allo Speed step 1',
  async (kind) => {
    const { view, messages, characteristic } = await connect()
    if (kind === 'Remote') {
      await connectionButton(view, 'Remote').trigger('click')
      await flushPromises()
    }
    await view.get('[aria-label="Aumenta marcia"]').trigger('click')
    await vi.advanceTimersByTimeAsync(100)
    expect(view.get('[data-testid="power"]').text()).toBe('Power 65')
    if (kind === 'schermo')
      await view
        .findAll('button')
        .find((button) => button.text() === 'Stop')!
        .trigger('click')
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
  },
)

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
    else
      await connectionButton(view, kind === 'Battery Cube' ? 'Battery Cube' : 'Remote').trigger(
        'click',
      )
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
  const sheet = await openSettings(view)
  await sheet.get('#min-power').setValue('55')
  await sheet.get('#min-power').trigger('blur')
  await sheet.get('#max-power').setValue('56')
  await sheet.get('#max-power').trigger('blur')
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
