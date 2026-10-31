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
