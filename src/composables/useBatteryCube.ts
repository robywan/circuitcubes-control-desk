import { onUnmounted, ref } from 'vue'
import { parseBatteryVoltage } from '../battery-voltage'
import { type Action, command, nextStep } from '../driving'
import type { Settings } from '../settings'

const SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
const RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'
const TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'
const VOLTAGE_INTERVAL_MS = 60_000

export function useBatteryCube(settings: () => Settings) {
  const available = !!navigator.bluetooth
  const connected = ref(false)
  const busy = ref(false)
  const status = ref('Disconnesso')
  const step = ref(0)
  const voltage = ref<number | null>(null)
  let notifications: BluetoothRemoteGATTCharacteristic | undefined
  let generation = 0
  let device: BluetoothDevice | undefined
  let characteristic: BluetoothRemoteGATTCharacteristic | undefined
  let writes = Promise.resolve()
  let voltageTimer: ReturnType<typeof setInterval> | undefined
  let polling = false

  function onVoltage(event: Event) {
    if (!connected.value || event.target !== notifications || !notifications.value) return
    const text = new TextDecoder().decode(notifications.value)
    const value = parseBatteryVoltage(text)
    if (value === null) console.error(`Risposta Battery voltage non valida: ${text}`)
    else voltage.value = value
  }

  function stopPolling() {
    polling = false
    clearInterval(voltageTimer)
    voltageTimer = undefined
  }

  function disconnected() {
    stopPolling()
    generation++
    notifications?.removeEventListener('characteristicvaluechanged', onVoltage)
    notifications = undefined
    voltage.value = null
    device?.removeEventListener('gattserverdisconnected', disconnected)
    connected.value = false
    step.value = 0
    characteristic = undefined
    if (!status.value.startsWith('Errore')) status.value = 'Disconnesso'
  }

  function drive(action: Action) {
    if (!connected.value || !characteristic || (busy.value && action !== 0)) return
    const next = nextStep(step.value, action)
    if (next === step.value) return
    step.value = next
    const target = characteristic
    const value = new TextEncoder().encode(command(next, settings()))
    writes = writes
      .then(async () => {
        if (characteristic !== target) return
        if (target.properties.write) await target.writeValueWithResponse(value)
        else await target.writeValueWithoutResponse(value)
      })
      .catch((error: unknown) => {
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
      stopPolling()
      drive(0)
      await writes
      device?.gatt?.disconnect()
      disconnected()
      busy.value = false
      return
    }
    status.value = 'Connessione in corso…'
    const currentGeneration = generation
    try {
      const selected = await navigator.bluetooth.requestDevice({
        filters: [{ services: [SERVICE] }],
      })
      if (generation !== currentGeneration) return
      device = selected
      device.addEventListener('gattserverdisconnected', disconnected)
      if (!device.gatt) throw new Error('GATT non disponibile')
      const server = await device.gatt.connect()
      const service = await server.getPrimaryService(SERVICE)
      const rx = await service.getCharacteristic(RX)
      if (generation !== currentGeneration) return
      characteristic = rx
      try {
        const tx = await service.getCharacteristic(TX)
        if (generation !== currentGeneration) return
        notifications = tx
        tx.addEventListener('characteristicvaluechanged', onVoltage)
        await tx.startNotifications()
      } catch (error) {
        console.error(error)
        notifications?.removeEventListener('characteristicvaluechanged', onVoltage)
        notifications = undefined
      }
      if (generation !== currentGeneration) return
      if (!server.connected) throw new Error('Battery Cube disconnesso durante la connessione')
      const target = characteristic
      polling = true
      const requestVoltage = () => {
        writes = writes
          .then(async () => {
            if (!polling || generation !== currentGeneration || characteristic !== target) return
            const value = new TextEncoder().encode('b')
            if (target.properties.write) await target.writeValueWithResponse(value)
            else await target.writeValueWithoutResponse(value)
          })
          .catch((error: unknown) => console.error(error))
      }
      requestVoltage()
      voltageTimer = setInterval(requestVoltage, VOLTAGE_INTERVAL_MS)
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

  return { available, connected, busy, status, step, voltage, drive, toggleConnection }
}
