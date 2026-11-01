import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { useWakeLock } from '../composables/useWakeLock'

const cube = ref(false)
const remote = ref(false)
const release = vi.fn<() => Promise<void>>(async () => {})
const request = vi.fn<() => Promise<ReturnType<typeof sentinel>>>(async () => sentinel())
const wrappers: ReturnType<typeof mount>[] = []

function sentinel() {
  return Object.assign(new EventTarget(), { release, released: false })
}

function start() {
  const wrapper = mount(
    defineComponent({
      setup() {
        useWakeLock(cube, remote)
        return () => null
      },
    }),
  )
  wrappers.push(wrapper)
  return wrapper
}

beforeEach(() => {
  cube.value = false
  remote.value = false
  vi.clearAllMocks()
  request.mockImplementation(async () => sentinel())
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } })
})

afterEach(async () => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  await flushPromises()
  vi.restoreAllMocks()
})

it('reacquires on visibility return after browser release, not while hidden', async () => {
  const first = sentinel()
  request.mockResolvedValueOnce(first)
  cube.value = true
  start()
  await flushPromises()
  vi.mocked(Object.getOwnPropertyDescriptor(document, 'visibilityState')!.get!).mockReturnValue(
    'hidden',
  )
  first.released = true
  first.dispatchEvent(new Event('release'))
  document.dispatchEvent(new Event('visibilitychange'))
  await flushPromises()
  expect(request).toHaveBeenCalledTimes(1)
  vi.mocked(Object.getOwnPropertyDescriptor(document, 'visibilityState')!.get!).mockReturnValue(
    'visible',
  )
  document.dispatchEvent(new Event('visibilitychange'))
  await flushPromises()
  expect(request).toHaveBeenCalledTimes(2)
})

it('ignores unavailable wake lock without logging an error', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: undefined })
  cube.value = true
  start()
  await flushPromises()
  expect(request).not.toHaveBeenCalled()
  expect(error).not.toHaveBeenCalled()
})

it('keeps working and reports rejected wake lock requests', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  request.mockRejectedValue(new Error('denied'))
  cube.value = true
  start()
  await flushPromises()
  expect(error).toHaveBeenCalled()
})

it.each(['disconnect', 'unmount', 'hide'])(
  'releases a pending request after %s',
  async (action) => {
    let resolve!: (value: ReturnType<typeof sentinel>) => void
    request.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done
      }),
    )
    cube.value = true
    const wrapper = start()
    remote.value = true
    await flushPromises()
    expect(request).toHaveBeenCalledTimes(1)
    if (action === 'unmount') wrapper.unmount()
    else if (action === 'hide') {
      vi.mocked(Object.getOwnPropertyDescriptor(document, 'visibilityState')!.get!).mockReturnValue(
        'hidden',
      )
      document.dispatchEvent(new Event('visibilitychange'))
    } else {
      cube.value = false
      remote.value = false
    }
    await flushPromises()
    resolve(sentinel())
    await flushPromises()
    expect(release).toHaveBeenCalledTimes(1)
  },
)

it('releases on unmount and ignores later visibility events', async () => {
  cube.value = true
  const wrapper = start()
  await flushPromises()
  wrapper.unmount()
  document.dispatchEvent(new Event('visibilitychange'))
  await flushPromises()
  expect(release).toHaveBeenCalledTimes(1)
  expect(request).toHaveBeenCalledTimes(1)
})

it('contains release failures', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  release.mockRejectedValueOnce(new Error('release failed'))
  cube.value = true
  const wrapper = start()
  await flushPromises()
  wrapper.unmount()
  await flushPromises()
  expect(error).toHaveBeenCalled()
})

it('does not acquire while initially hidden or reacquire without devices', async () => {
  vi.mocked(Object.getOwnPropertyDescriptor(document, 'visibilityState')!.get!).mockReturnValue(
    'hidden',
  )
  cube.value = true
  start()
  await flushPromises()
  expect(request).not.toHaveBeenCalled()
  cube.value = false
  vi.mocked(Object.getOwnPropertyDescriptor(document, 'visibilityState')!.get!).mockReturnValue(
    'visible',
  )
  document.dispatchEvent(new Event('visibilitychange'))
  await flushPromises()
  expect(request).not.toHaveBeenCalled()
})

it('does not retain a sentinel already released by the browser', async () => {
  const expired = sentinel()
  expired.released = true
  request.mockResolvedValueOnce(expired)
  cube.value = true
  start()
  await flushPromises()
  document.dispatchEvent(new Event('visibilitychange'))
  await flushPromises()
  expect(request).toHaveBeenCalledTimes(2)
})

it('requests screen lock for the first device and releases after the last disconnects', async () => {
  start()
  expect(request).not.toHaveBeenCalled()
  cube.value = true
  await flushPromises()
  expect(request).toHaveBeenCalledWith('screen')
  remote.value = true
  cube.value = false
  await flushPromises()
  expect(request).toHaveBeenCalledTimes(1)
  expect(release).not.toHaveBeenCalled()
  remote.value = false
  await flushPromises()
  expect(release).toHaveBeenCalledTimes(1)
})

it.each(['rejected', 'released'])(
  'retries a %s pending request after visibility returns, without looping on denial',
  async (mode) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let finish!: () => void
    request.mockReturnValueOnce(
      new Promise((resolve, reject) => {
        finish = () => {
          if (mode === 'rejected') reject(new Error('hidden'))
          else resolve(Object.assign(sentinel(), { released: true }))
        }
      }),
    )
    request.mockRejectedValue(new Error('denied'))
    cube.value = true
    start()
    const visibility = vi.mocked(Object.getOwnPropertyDescriptor(document, 'visibilityState')!.get!)
    visibility.mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    finish()
    await flushPromises()
    expect(request).toHaveBeenCalledTimes(2)
    await flushPromises()
    expect(request).toHaveBeenCalledTimes(2)
  },
)
