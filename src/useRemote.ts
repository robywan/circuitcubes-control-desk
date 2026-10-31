import { onUnmounted, ref } from 'vue'
import { decodeRemote } from './remote'

const SERVICE = '00001623-1212-efde-1623-785feabcd123'
const CHARACTERISTIC = '00001624-1212-efde-1623-785feabcd123'

export function useRemote(drive: (action: -1 | 0 | 1) => void) {
  const connected = ref(false)
  const busy = ref(false)
  const status = ref('Disconnesso')
  let device: BluetoothDevice | undefined
  let characteristic: BluetoothRemoteGATTCharacteristic | undefined
  let writes = Promise.resolve()
  let generation = 0

  function disconnected() {
    generation++
    device?.removeEventListener('gattserverdisconnected', disconnected)
    characteristic?.removeEventListener('characteristicvaluechanged', notification)
    characteristic = undefined
    if (connected.value) drive(0)
    connected.value = false
    if (!status.value.startsWith('Errore')) status.value = 'Disconnesso'
  }

  function notification(event: Event) {
    const target = event.target as BluetoothRemoteGATTCharacteristic
    const value = target.value
    if (!value) return
    if (value.byteLength >= 4 && value.getUint8(2) === 0x04 && value.getUint8(3) === 0x3c) {
      const current = generation
      writes = writes.then(async () => {
        for (const port of [0, 1]) {
          await new Promise((resolve) => setTimeout(resolve, 100))
          if (generation !== current || characteristic !== target) return
          await target.writeValueWithResponse(new Uint8Array([0x41, port, 0, 1, 0, 0, 0, 1]))
        }
      }).catch((error: unknown) => {
        console.error(error)
        if (generation === current && characteristic === target) {
          status.value = 'Errore di scrittura'
          device?.gatt?.disconnect()
          disconnected()
        }
      })
      return
    }
    const button = decodeRemote(value)
    if (connected.value && button?.port === 0) drive(button.action)
  }

  async function toggleConnection() {
    if (busy.value) return
    busy.value = true
    if (connected.value) {
      device?.gatt?.disconnect()
      disconnected()
      busy.value = false
      return
    }
    status.value = 'Connessione in corso…'
    try {
      device = await navigator.bluetooth.requestDevice({ filters: [{ services: [SERVICE] }] })
      device.addEventListener('gattserverdisconnected', disconnected)
      if (!device.gatt) throw new Error('GATT non disponibile')
      const server = await device.gatt.connect()
      const service = await server.getPrimaryService(SERVICE)
      characteristic = await service.getCharacteristic(CHARACTERISTIC)
      characteristic.addEventListener('characteristicvaluechanged', notification)
      await characteristic.startNotifications()
      if (!server.connected) throw new Error('Remote disconnesso durante la connessione')
      connected.value = true
      status.value = 'Connesso'
    } catch (error) {
      console.error(error)
      device?.gatt?.disconnect()
      disconnected()
      status.value = 'Errore di connessione'
    } finally {
      busy.value = false
    }
  }

  onUnmounted(() => {
    device?.gatt?.disconnect()
    disconnected()
  })

  return { connected, busy, status, toggleConnection }
}
