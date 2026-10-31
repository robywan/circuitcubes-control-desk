export const txId = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'
export function batteryNotifications() {
  return Object.assign(new EventTarget(), { startNotifications: async () => {} })
}
