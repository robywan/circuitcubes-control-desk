import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { useWakeLock } from '../useWakeLock'

const cube = ref(false)
const remote = ref(false)
const release = vi.fn<() => Promise<void>>(async () => {})
const request = vi.fn<() => Promise<ReturnType<typeof sentinel>>>(async () => sentinel())
const wrappers: ReturnType<typeof mount>[] = []

function sentinel() {
  return Object.assign(new EventTarget(), { release, released: false })
}

function start() {
  const wrapper = mount(defineComponent({
    setup() { useWakeLock(cube, remote); return () => null },
  }))
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
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  await flushPromises()
  vi.restoreAllMocks()
})

it('reacquires on visibility return after browser release, not while hidden', async () => {
  const first = sentinel()
  request.mockResolvedValueOnce(first)
  cube.value = true
  start()
  await flushPromises()
  vi.mocked(Object.getOwnPropertyDescriptor(document, 'visibilityState')!.get!).mockReturnValue('hidden')
  first.released = true
  first.dispatchEvent(new Event('release'))
  document.dispatchEvent(new Event('visibilitychange'))
  await flushPromises()
  expect(request).toHaveBeenCalledTimes(1)
  vi.mocked(Object.getOwnPropertyDescriptor(document, 'visibilityState')!.get!).mockReturnValue('visible')
  document.dispatchEvent(new Event('visibilitychange'))
  await flushPromises()
  expect(request).toHaveBeenCalledTimes(2)
})

it.each(['missing', 'rejected'])('keeps working when wake lock is %s', async mode => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  if (mode === 'missing') Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: undefined })
  else request.mockRejectedValue(new Error('denied'))
  cube.value = true
  start()
  await flushPromises()
  expect(error).toHaveBeenCalled()
})

it.each(['disconnect', 'unmount', 'hide'])('releases a pending request after %s', async action => {
  let resolve!: (value: ReturnType<typeof sentinel>) => void
  request.mockReturnValueOnce(new Promise(done => { resolve = done }))
  cube.value = true
  const wrapper = start()
  remote.value = true
  await flushPromises()
  expect(request).toHaveBeenCalledTimes(1)
  if (action === 'unmount') wrapper.unmount()
  else if (action === 'hide') {
    vi.mocked(Object.getOwnPropertyDescriptor(document, 'visibilityState')!.get!).mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
  } else { cube.value = false; remote.value = false }
  await flushPromises()
  resolve(sentinel())
  await flushPromises()
  expect(release).toHaveBeenCalledTimes(1)
})

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
  vi.mocked(Object.getOwnPropertyDescriptor(document, 'visibilityState')!.get!).mockReturnValue('hidden')
  cube.value = true
  start()
  await flushPromises()
  expect(request).not.toHaveBeenCalled()
  cube.value = false
  vi.mocked(Object.getOwnPropertyDescriptor(document, 'visibilityState')!.get!).mockReturnValue('visible')
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
