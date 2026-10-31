<script setup lang="ts">
import { useBatteryCube } from '../useBatteryCube'
import { useRemote } from '../useRemote'
import { useWakeLock } from '../useWakeLock'

const { available, connected, busy, status, step, drive, toggleConnection } = useBatteryCube()
const remote = useRemote(drive)
useWakeLock(connected, remote.connected)
</script>

<template>
  <main class="mx-auto max-w-xl space-y-8 p-4 sm:p-8">
    <p v-if="!available" role="alert" class="rounded border border-amber-700 bg-amber-50 p-4 text-amber-950">
      Web Bluetooth non è disponibile. Usa Chrome o Edge su desktop o Android.
    </p>
    <h1 class="text-2xl font-bold">CircuitCubes Control Desk</h1>
    <section aria-labelledby="connections" class="space-y-4">
      <h2 id="connections" class="text-xl font-semibold">Connessioni</h2>
      <div class="flex items-center gap-3">
        <strong>Battery Cube</strong>
        <span role="status" class="min-w-0 flex-1 text-sm">{{ status }}</span>
        <button type="button" :disabled="!available || busy" class="rounded border border-slate-600 px-3 py-2 disabled:opacity-50" @click="toggleConnection">
          {{ connected ? 'Disconnetti' : 'Connetti' }}
        </button>
      </div>
      <div class="flex items-center gap-3">
        <strong>Remote</strong>
        <span role="status" class="min-w-0 flex-1 text-sm">{{ remote.status.value }}</span>
        <button type="button" :disabled="!available || remote.busy.value" class="rounded border border-slate-600 px-3 py-2 disabled:opacity-50" @click="remote.toggleConnection">
          {{ remote.connected.value ? 'Disconnetti' : 'Connetti' }}
        </button>
      </div>
    </section>
    <section aria-labelledby="driving" class="space-y-4">
      <h2 id="driving" class="text-xl font-semibold">Guida</h2>
      <div class="text-center">
        <p>Marcia</p>
        <output data-testid="step" class="text-5xl font-bold">{{ step > 0 ? `+${step}` : step < 0 ? `−${-step}` : '0' }}</output>
      </div>
      <div class="flex gap-3">
        <button type="button" aria-label="Diminuisci marcia" :disabled="!connected || busy" class="flex-1 rounded border border-slate-600 px-4 py-3 text-xl disabled:opacity-50" @click="drive(-1)">−</button>
        <button type="button" :disabled="!connected || busy" class="flex-1 rounded border border-slate-600 px-4 py-3 disabled:opacity-50" @click="drive(0)">Stop</button>
        <button type="button" aria-label="Aumenta marcia" :disabled="!connected || busy" class="flex-1 rounded border border-slate-600 px-4 py-3 text-xl disabled:opacity-50" @click="drive(1)">+</button>
      </div>
    </section>
  </main>
</template>
