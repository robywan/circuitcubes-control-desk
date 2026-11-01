<script setup lang="ts">
import { computed, ref } from 'vue'
import { Settings as SettingsIcon } from 'lucide-vue-next'
import { channels, STALL_POWER, validInertia, validPower, type Settings } from '@/domain/settings'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
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
        <RadioGroup v-model="channel" :disabled="!stopped" aria-labelledby="channel-label">
          <div id="channel-label" class="font-semibold">Channel</div>
          <div class="flex gap-4">
            <div v-for="option in channels" :key="option" class="flex items-center gap-2">
              <RadioGroupItem :id="`channel-${option}`" :value="option" />
              <Label :for="`channel-${option}`">{{ option }}</Label>
            </div>
          </div>
        </RadioGroup>
        <div class="flex items-center gap-2">
          <Switch id="inverted" v-model="inverted" :disabled="!stopped" />
          <Label for="inverted">Inversione senso di marcia</Label>
        </div>
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
        <RadioGroup v-model="remoteSide" :disabled="!stopped" aria-labelledby="remote-side-label">
          <div id="remote-side-label" class="font-semibold">Lato del Remote</div>
          <div class="flex gap-4">
            <div class="flex items-center gap-2">
              <RadioGroupItem id="remote-left" value="left" />
              <Label for="remote-left">Sinistro</Label>
            </div>
            <div class="flex items-center gap-2">
              <RadioGroupItem id="remote-right" value="right" />
              <Label for="remote-right">Destro</Label>
            </div>
          </div>
        </RadioGroup>
      </fieldset>
      </div>
    </SheetContent>
  </Sheet>
</template>
