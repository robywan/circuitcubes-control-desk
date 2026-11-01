<script setup lang="ts">
import { ref, watch } from 'vue'
import { useBatteryCube } from '../composables/useBatteryCube'
import { useRemote } from '../composables/useRemote'
import { loadSettings } from '../domain/settings'
import SettingsSheet from '../components/SettingsSheet.vue'
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
const { available, connected, busy, status, step, signedPower, voltage, drive, toggleConnection } =
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
    <header class="flex items-center justify-between gap-4">
      <h1 class="text-2xl font-bold">CircuitCubes Control Desk</h1>
      <SettingsSheet v-model="settings" :stopped="step === 0 && signedPower === 0" />
    </header>
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
        <p data-testid="power">Power {{ Math.round(Math.abs(signedPower)) }}</p>
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
  </main>
</template>
