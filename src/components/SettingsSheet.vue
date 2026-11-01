<script setup lang="ts">
import { computed } from 'vue'
import { Settings as SettingsIcon } from 'lucide-vue-next'
import { channels, STALL_POWER, type Settings } from '@/domain/settings'
import { NumberField, NumberFieldContent, NumberFieldDecrement, NumberFieldIncrement, NumberFieldInput } from '@/components/ui/number-field'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

const props = defineProps<{ stopped: boolean }>()
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

function numberSetting(field: 'minPower' | 'maxPower' | 'inertia') {
  return computed({
    get: () => settings.value[field],
    set: (value: number | undefined) => {
      if (props.stopped && value !== undefined) settings.value = { ...settings.value, [field]: value }
    },
  })
}
const minPower = numberSetting('minPower')
const maxPower = numberSetting('maxPower')
const inertia = numberSetting('inertia')

function restoreEmpty(event: FocusEvent, value: number) {
  const input = event.target as HTMLInputElement
  if (!input.value) input.value = new Intl.NumberFormat('it-IT').format(value)
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
        <div :key="String(stopped)" class="space-y-4">
          <div class="flex gap-3">
            <NumberField id="min-power" v-model="minPower" :min="STALL_POWER" :max="settings.maxPower" :step="1" locale="it-IT" :disabled="!stopped" class="min-w-0 flex-1">
              <Label for="min-power">Power minima</Label>
              <NumberFieldContent>
                <NumberFieldDecrement aria-label="Diminuisci Power minima" />
                <NumberFieldInput @blur="restoreEmpty($event, settings.minPower)" />
                <NumberFieldIncrement aria-label="Aumenta Power minima" />
              </NumberFieldContent>
            </NumberField>
            <NumberField id="max-power" v-model="maxPower" :min="settings.minPower" :max="255" :step="1" locale="it-IT" :disabled="!stopped" class="min-w-0 flex-1">
              <Label for="max-power">Power massima</Label>
              <NumberFieldContent>
                <NumberFieldDecrement aria-label="Diminuisci Power massima" />
                <NumberFieldInput @blur="restoreEmpty($event, settings.maxPower)" />
                <NumberFieldIncrement aria-label="Aumenta Power massima" />
              </NumberFieldContent>
            </NumberField>
          </div>
          <NumberField id="inertia" v-model="inertia" :min="0" :max="10" :step="0.5" locale="it-IT" :disabled="!stopped">
            <Label for="inertia">Inerzia (s)</Label>
            <NumberFieldContent>
              <NumberFieldDecrement aria-label="Diminuisci Inerzia" />
              <NumberFieldInput @blur="restoreEmpty($event, settings.inertia)" />
              <NumberFieldIncrement aria-label="Aumenta Inerzia" />
            </NumberFieldContent>
          </NumberField>
        </div>
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
