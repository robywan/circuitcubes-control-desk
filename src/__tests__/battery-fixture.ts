import { DOMWrapper, type VueWrapper } from '@vue/test-utils'

export async function openSettings(view: VueWrapper) {
  await view.get('button[aria-label="Impostazioni"]').trigger('click')
  return new DOMWrapper(document.body)
}

export function connectionButton(view: VueWrapper, name: 'Battery Cube' | 'Remote') {
  return view.findAll('section[aria-labelledby="connections"] > div').find((row) => row.get('strong').text() === name)!.get('button')
}

export const txId = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'
export function batteryDevice<R, T>(rx: R, tx: T, disconnect: () => void = () => {}) {
  return Object.assign(new EventTarget(), {
    gatt: {
      connect: async () => ({
        connected: true,
        getPrimaryService: async () => ({
          getCharacteristic: async (id: string) => (id === txId ? tx : rx),
        }),
      }),
      disconnect,
    },
  })
}

export function batteryNotifications() {
  return Object.assign(new EventTarget(), { startNotifications: async () => {} })
}
