import { onUnmounted, ref } from 'vue'
import { command, nextStep } from './driving'

const SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
const RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'

export function useBatteryCube() {
  const available = !!navigator.bluetooth
  const connected = ref(false)
  const busy = ref(false)
  const status = ref('Disconnesso')
  const step = ref(0)
  let device: BluetoothDevice | undefined
  let characteristic: BluetoothRemoteGATTCharacteristic | undefined
  let writes = Promise.resolve()

  function disconnected() {
    device?.removeEventListener('gattserverdisconnected', disconnected)
    connected.value = false
    step.value = 0
    characteristic = undefined
    if (!status.value.startsWith('Errore')) status.value = 'Disconnesso'
  }

  function drive(action: -1 | 0 | 1) {
    if (!connected.value || !characteristic) return
    const next = nextStep(step.value, action)
    if (next === step.value) return
    step.value = next
    const target = characteristic
    const value = new TextEncoder().encode(command(next))
    writes = writes.then(async () => {
      if (characteristic === target) await target.writeValueWithResponse(value)
    }).catch((error: unknown) => {
      console.error(error)
      if (characteristic === target) {
        device?.gatt?.disconnect()
        disconnected()
        status.value = 'Errore di scrittura'
      }
    })
  }

  async function toggleConnection() {
    if (busy.value) return
    busy.value = true
    if (connected.value) {
      drive(0)
      await writes
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
      characteristic = await service.getCharacteristic(RX)
      if (!server.connected) throw new Error('Battery Cube disconnesso durante la connessione')
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
    device?.removeEventListener('gattserverdisconnected', disconnected)
    device?.gatt?.disconnect()
    disconnected()
  })

  return { available, connected, busy, status, step, drive, toggleConnection }
}
