import { onMounted, onUnmounted, watch, type Ref } from 'vue'

export function useWakeLock(cube: Readonly<Ref<boolean>>, remote: Readonly<Ref<boolean>>) {
  let lock: WakeLockSentinel | undefined
  let pending = false
  let disposed = false
  const wanted = () => !disposed && (cube.value || remote.value) && document.visibilityState === 'visible'

  async function release() {
    const previous = lock
    lock = undefined
    try {
      await previous?.release()
    } catch (error) {
      console.error('Screen Wake Lock:', error)
    }
  }

  async function update() {
    if (!wanted()) {
      await release()
      return
    }
    if (lock || pending) return
    pending = true
    try {
      const acquired = await navigator.wakeLock.request('screen')
      if (acquired.released) return
      lock = acquired
      acquired.addEventListener('release', () => {
        if (lock === acquired) lock = undefined
      }, { once: true })
      if (!wanted()) await release()
    } catch (error) {
      console.error('Screen Wake Lock:', error)
    } finally {
      pending = false
    }
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', update)
    void update()
  })
  watch([cube, remote], update)
  onUnmounted(() => {
    disposed = true
    document.removeEventListener('visibilitychange', update)
    void release()
  })
}
