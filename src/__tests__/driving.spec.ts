import { expect, it } from 'vitest'
import {
  powerCommand,
  targetPower,
  nextPower,
  nextStep,
  brakePower,
  brakeStep,
} from '../domain/driving'
import { defaultSettings } from '../domain/settings'

it('riduce la Power al ritmo del Freno', () => {
  expect(brakePower(255, 100, defaultSettings)).toBe(235)
  expect(brakePower(255, 1000, defaultSettings)).toBe(0)
  expect(brakePower(75, 100, defaultSettings)).toBe(0)
  expect(brakePower(-255, 100, defaultSettings)).toBe(-235)
  expect(brakePower(255, 0, defaultSettings)).toBe(255)
  expect(brakePower(255, 100, { ...defaultSettings, brake: 0.5 })).toBe(215)
  expect(brakePower(55, 0, { ...defaultSettings, maxPower: 55 })).toBe(0)
})

it.each([0, 55, -55, 80, -80, 255, -255])('tempo zero mantiene la Power %s con Freno', (power) => {
  expect(brakePower(power, 0, defaultSettings)).toBe(power)
})

it('abbassa lo Speed step alla Power raggiunta senza superare lo step attuale', () => {
  expect(brakeStep(5, 254, defaultSettings)).toBe(4)
  expect(brakeStep(5, 211, defaultSettings)).toBe(4)
  expect(brakeStep(5, 210, defaultSettings)).toBe(3)
  expect(brakeStep(2, 255, defaultSettings)).toBe(2)
  expect(brakeStep(1, 80, defaultSettings)).toBe(1)
  expect(brakeStep(1, 79, defaultSettings)).toBe(0)
  expect(brakeStep(-5, -235, defaultSettings)).toBe(-4)
  expect(brakeStep(0, 150, defaultSettings)).toBe(0)
  const equal = { ...defaultSettings, minPower: 100, maxPower: 100 }
  expect(brakeStep(5, 100, equal)).toBe(5)
  expect(brakeStep(5, 99, equal)).toBe(0)
})

it('avvia lo Speed step 1 dalla Stall power e sale fino alla Power minima', () => {
  expect(nextPower(0, 1, 0, defaultSettings)).toBe(55)
  expect(nextPower(55, 1, 100, defaultSettings)).toBe(65)
  expect(nextPower(55, 1, 10000, defaultSettings)).toBe(80)
})

it('parte dalla Stall power e raggiunge la massima in due secondi', () => {
  expect(nextPower(0, 5, 0, defaultSettings)).toBe(55)
  expect(nextPower(55, 5, 1000, defaultSettings)).toBe(155)
  expect(nextPower(55, 5, 2000, defaultSettings)).toBe(255)
})

it('frena, inverte senza pausa e segue un nuovo Speed step', () => {
  expect(nextPower(80, 0, 100, defaultSettings)).toBe(70)
  expect(nextPower(80, 0, 250, defaultSettings)).toBe(0)
  expect(nextPower(255, 0, 1000, defaultSettings)).toBe(155)
  expect(nextPower(255, 0, 2000, defaultSettings)).toBe(0)
  expect(nextPower(155, -5, 1000, defaultSettings)).toBe(-55)
  expect(nextPower(155, -5, 1500, defaultSettings)).toBe(-105)
  expect(nextPower(200, 2, 500, defaultSettings)).toBe(150)
  expect(nextPower(80, 2, 10000, defaultSettings)).toBe(124)
})

it('gestisce Power uguali e inerzia disattivata', () => {
  expect(nextPower(0, -5, 0, { ...defaultSettings, minPower: 55, maxPower: 55 })).toBe(-55)
  expect(nextPower(0, -5, 0, { ...defaultSettings, minPower: 100, maxPower: 100 })).toBe(-55)
  expect(nextPower(-55, -5, 2000, { ...defaultSettings, minPower: 100, maxPower: 100 })).toBe(-100)
  expect(nextPower(0, 1, 0, { ...defaultSettings, inertia: 0 })).toBe(80)
  expect(nextPower(255, 0, 0, { ...defaultSettings, inertia: 0 })).toBe(0)
})

it('calcola la Power per ogni Speed step', () => {
  expect(
    [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].map((step) =>
      powerCommand(targetPower(step, defaultSettings)),
    ),
  ).toEqual([
    '-255a',
    '-211a',
    '-168a',
    '-124a',
    '-080a',
    '+000a',
    '+080a',
    '+124a',
    '+168a',
    '+211a',
    '+255a',
  ])
})

it('codifica la Power con tre cifre e il segno', () => {
  expect(powerCommand(-80)).toBe('-080a')
  expect(powerCommand(0)).toBe('+000a')
  expect(powerCommand(255)).toBe('+255a')
})

it('ignora la Direction opposta durante la frenata a Speed step zero', () => {
  expect(nextStep(0, -1, 100)).toBe(0)
  expect(nextStep(0, 1, -100)).toBe(0)
})

it('sposta lo Speed step passando per zero e rispettando i limiti', () => {
  expect(nextStep(1, -1, 100)).toBe(0)
  expect(nextStep(0, -1, 0)).toBe(-1)
  expect(nextStep(0, 1, 0)).toBe(1)
  expect(nextStep(0, 1, 100)).toBe(1)
  expect(nextStep(0, -1, -100)).toBe(-1)
  expect(nextStep(-5, -1, -255)).toBe(-5)
  expect(nextStep(5, 1, 255)).toBe(5)
  expect(nextStep(-3, 0, -100)).toBe(0)
  expect(nextStep(0, 0, 100)).toBe(0)
  expect(nextStep(0, 0, -100)).toBe(0)
})
