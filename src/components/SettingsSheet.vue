<script setup lang="ts">
import { computed, ref } from 'vue'
import { Settings as SettingsIcon } from 'lucide-vue-next'
import { channels, STALL_POWER, validInertia, validPower, type Settings } from '@/domain/settings'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

defineProps<{ stopped: boolean }>()
const settings = defineModel<Settings>({ required: true })
const channel = computed({
  get: () => settings.value.channel,
  set: (channel) => { settings.value = { ...settings.value, channel } },
})
const inverted = computed({
  get: () => settings.value.inverted,
  set: (inverted) => { settings.value = { ...settings.value, inverted } },
})
const remoteSide = computed({
  get: () => settings.value.remoteSide,
  set: (remoteSide) => { settings.value = { ...settings.value, remoteSide } },
})

const error = ref('')
function setPower(field: 'minPower' | 'maxPower', event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.value === '' ? NaN : input.valueAsNumber
  if (
    !validPower(value) ||
    (field === 'minPower' ? value > settings.value.maxPower : value < settings.value.minPower)
  ) {
    error.value = `Inserisci un valore intero tra ${STALL_POWER} e 255; la Power minima non può superare la massima.`
    input.value = String(settings.value[field])
    return
  }
  error.value = ''
  settings.value = { ...settings.value, [field]: value }
}

const inertiaError = ref('')
function setInertia(event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.valueAsNumber
  if (!validInertia(value)) {
    inertiaError.value = 'Inserisci un valore tra 0 e 10 a passi di 0,5.'
    input.value = String(settings.value.inertia)
    return
  }
  inertiaError.value = ''
  settings.value = { ...settings.value, inertia: value }
}

</script>

<template>
  <Sheet>
    <SheetTrigger as-child>
      <Button type="button" variant="outline" size="icon" aria-label="Impostazioni">
        <SettingsIcon aria-hidden="true" />
      </Button>
    </SheetTrigger>
    <SheetContent class="overflow-y-auto data-[side=right]:w-full sm:max-w-sm" :aria-describedby="undefined">
      <SheetHeader class="pb-0">
        <SheetTitle>Impostazioni</SheetTitle>
      </SheetHeader>
      <div class="space-y-4 px-4 pb-4">
        <Alert v-if="!stopped">
          <AlertDescription>Ferma la Locomotive per modificare le Impostazioni</AlertDescription>
        </Alert>
      <fieldset :disabled="!stopped" class="space-y-4 disabled:opacity-50">
        <fieldset>
          <legend class="font-semibold">Channel</legend>
          <div class="flex gap-4">
            <label v-for="option in channels" :key="option" class="flex items-center gap-2"
              ><input v-model="channel" type="radio" name="channel" :value="option" />
              {{ option }}</label
            >
          </div>
        </fieldset>
        <Label class="flex items-center gap-2"
          ><input v-model="inverted" type="checkbox" /> Inversione senso di marcia</Label
        >
        <div class="flex gap-3">
          <label for="min-power" class="min-w-0 flex-1"
            >Power minima<input
              id="min-power"
              type="number"
              :min="STALL_POWER"
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
              :min="STALL_POWER"
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
        <div class="flex gap-3">
          <label for="inertia" class="min-w-0 flex-1"
            >Inerzia (s)<input
              id="inertia"
              type="number"
              min="0"
              max="10"
              step="0.5"
              :value="settings.inertia"
              :aria-invalid="!!inertiaError"
              aria-describedby="inertia-error"
              class="block w-full rounded border border-slate-600 px-2 py-1"
              @change="setInertia"
          /></label>
        </div>
        <p v-if="inertiaError" id="inertia-error" role="alert" class="text-red-700">
          {{ inertiaError }}
        </p>
        <fieldset>
          <legend class="font-semibold">Lato del Remote</legend>
          <div class="flex gap-4">
            <label class="flex items-center gap-2"
              ><input v-model="remoteSide" type="radio" name="remote-side" value="left" />
              Sinistro</label
            >
            <label class="flex items-center gap-2"
              ><input v-model="remoteSide" type="radio" name="remote-side" value="right" />
              Destro</label
            >
          </div>
        </fieldset>
      </fieldset>
      </div>
    </SheetContent>
  </Sheet>
</template>
