<script setup lang="ts">
import { ref, watch } from 'vue'
import { useBatteryCube } from '../composables/useBatteryCube'
import { useRemote } from '../composables/useRemote'
import { channels, loadSettings, validPower } from '../settings'
import { useWakeLock } from '../composables/useWakeLock'

const storageKey = 'control-desk-settings'
let saved: string | null = null
try {
  saved = localStorage.getItem(storageKey)
} catch {}
const settings = ref(loadSettings(saved))
watch(
  settings,
  (value) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value))
    } catch {}
  },
  { deep: true, flush: 'sync' },
)
const error = ref('')
function setPower(field: 'minPower' | 'maxPower', event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.value === '' ? NaN : input.valueAsNumber
  if (
    !validPower(value) ||
    (field === 'minPower' ? value > settings.value.maxPower : value < settings.value.minPower)
  ) {
    error.value =
      'Inserisci un valore intero tra 0 e 255; la Power minima non può superare la massima.'
    input.value = String(settings.value[field])
    return
  }
  error.value = ''
  settings.value[field] = value
}

const { available, connected, busy, status, step, power, voltage, drive, toggleConnection } =
  useBatteryCube(() => settings.value)
const remote = useRemote(drive, () => settings.value.remoteSide)
useWakeLock(connected, remote.connected)
</script>

<template>
  <main class="mx-auto max-w-xl space-y-8 p-4 sm:p-8">
    <p
      v-if="!available"
      role="alert"
      class="rounded border border-amber-700 bg-amber-50 p-4 text-amber-950"
    >
      Web Bluetooth non è disponibile. Usa Chrome o Edge su desktop o Android.
    </p>
    <h1 class="text-2xl font-bold">CircuitCubes Control Desk</h1>
    <section aria-labelledby="connections" class="space-y-4">
      <h2 id="connections" class="text-xl font-semibold">Connessioni</h2>
      <div class="flex items-center gap-3">
        <strong>Battery Cube</strong>
        <div class="min-w-0 flex-1 text-sm">
          <span role="status">{{ status }}</span>
          <span v-if="connected && voltage !== null" class="ml-1 inline-block whitespace-nowrap">
            · Batteria {{ voltage.toFixed(2).replace('.', ',') }} V</span
          >
        </div>
        <button
          type="button"
          :disabled="!available || busy"
          class="rounded border border-slate-600 px-3 py-2 disabled:opacity-50"
          @click="toggleConnection"
        >
          {{ connected ? 'Disconnetti' : 'Connetti' }}
        </button>
      </div>
      <div class="flex items-center gap-3">
        <strong>Remote</strong>
        <span role="status" class="min-w-0 flex-1 text-sm">{{ remote.status.value }}</span>
        <button
          type="button"
          :disabled="!available || remote.busy.value"
          class="rounded border border-slate-600 px-3 py-2 disabled:opacity-50"
          @click="remote.toggleConnection"
        >
          {{ remote.connected.value ? 'Disconnetti' : 'Connetti' }}
        </button>
      </div>
    </section>
    <section aria-labelledby="driving" class="space-y-4">
      <h2 id="driving" class="text-xl font-semibold">Guida</h2>
      <div class="text-center">
        <p>Marcia</p>
        <output data-testid="step" class="text-5xl font-bold">{{
          step > 0 ? `+${step}` : step < 0 ? `−${-step}` : '0'
        }}</output>
        <p data-testid="power">Power {{ Math.round(Math.abs(power)) }}</p>
      </div>
      <div class="flex gap-3">
        <button
          type="button"
          aria-label="Diminuisci marcia"
          :disabled="!connected || busy"
          class="flex-1 rounded border border-slate-600 px-4 py-3 text-xl disabled:opacity-50"
          @click="drive(-1)"
        >
          −
        </button>
        <button
          type="button"
          :disabled="!connected || busy"
          class="flex-1 rounded border border-slate-600 px-4 py-3 disabled:opacity-50"
          @click="drive(0)"
        >
          Stop
        </button>
        <button
          type="button"
          aria-label="Aumenta marcia"
          :disabled="!connected || busy"
          class="flex-1 rounded border border-slate-600 px-4 py-3 text-xl disabled:opacity-50"
          @click="drive(1)"
        >
          +
        </button>
      </div>
    </section>
    <section aria-labelledby="settings" class="space-y-4">
      <h2 id="settings" class="text-xl font-semibold">Impostazioni</h2>
      <fieldset :disabled="step !== 0 || power !== 0" class="space-y-4 disabled:opacity-50">
        <fieldset>
          <legend class="font-semibold">Channel</legend>
          <div class="flex gap-4">
            <label v-for="channel in channels" :key="channel" class="flex items-center gap-2"
              ><input v-model="settings.channel" type="radio" name="channel" :value="channel" />
              {{ channel }}</label
            >
          </div>
        </fieldset>
        <label class="flex items-center gap-2"
          ><input v-model="settings.inverted" type="checkbox" /> Inversione senso di marcia</label
        >
        <div class="flex gap-3">
          <label for="min-power" class="min-w-0 flex-1"
            >Power minima<input
              id="min-power"
              type="number"
              min="0"
              max="255"
              step="1"
              :value="settings.minPower"
              :aria-invalid="!!error"
              aria-describedby="power-error"
              class="block w-full rounded border border-slate-600 px-2 py-1"
              @change="setPower('minPower', $event)"
          /></label>
          <label for="max-power" class="min-w-0 flex-1"
            >Power massima<input
              id="max-power"
              type="number"
              min="0"
              max="255"
              step="1"
              :value="settings.maxPower"
              :aria-invalid="!!error"
              aria-describedby="power-error"
              class="block w-full rounded border border-slate-600 px-2 py-1"
              @change="setPower('maxPower', $event)"
          /></label>
        </div>
        <p v-if="error" id="power-error" role="alert" class="text-red-700">{{ error }}</p>
        <fieldset>
          <legend class="font-semibold">Lato del Remote</legend>
          <div class="flex gap-4">
            <label class="flex items-center gap-2"
              ><input v-model="settings.remoteSide" type="radio" name="remote-side" value="left" />
              Sinistro</label
            >
            <label class="flex items-center gap-2"
              ><input v-model="settings.remoteSide" type="radio" name="remote-side" value="right" />
              Destro</label
            >
          </div>
        </fieldset>
      </fieldset>
    </section>
  </main>
</template>
