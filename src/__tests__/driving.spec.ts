import { expect, it } from 'vitest'
import { command, nextPower, nextStep } from '../driving'
import { defaultSettings } from '../settings'

it('parte dalla Power minima e raggiunge la massima in due secondi', () => {
  expect(nextPower(0, 5, 0, defaultSettings)).toBe(80)
  expect(nextPower(80, 5, 1000, defaultSettings)).toBe(167.5)
  expect(nextPower(80, 5, 2000, defaultSettings)).toBe(255)
})

it('frena, inverte senza pausa e segue un nuovo Speed step', () => {
  expect(nextPower(255, 0, 1000, defaultSettings)).toBe(167.5)
  expect(nextPower(255, 0, 2000, defaultSettings)).toBe(0)
  expect(nextPower(167.5, -5, 1000, defaultSettings)).toBe(-80)
  expect(nextPower(167.5, -5, 1500, defaultSettings)).toBe(-123.75)
  expect(nextPower(200, 2, 500, defaultSettings)).toBe(156.25)
  expect(nextPower(80, 2, 10000, defaultSettings)).toBe(124)
})

it('gestisce Power uguali e inerzia disattivata', () => {
  expect(nextPower(0, -5, 0, { ...defaultSettings, minPower: 100, maxPower: 100 })).toBe(-100)
  expect(nextPower(255, 0, 0, { ...defaultSettings, inertia: 0 })).toBe(0)
})

it('calcola la Power per ogni Speed step', () => {
  expect([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].map((step) => command(step))).toEqual([
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
  expect(command(-1)).toBe('-080a')
  expect(command(0)).toBe('+000a')
  expect(command(5)).toBe('+255a')
})

it('sposta lo Speed step passando per zero e rispettando i limiti', () => {
  expect(nextStep(1, -1)).toBe(0)
  expect(nextStep(0, -1)).toBe(-1)
  expect(nextStep(-5, -1)).toBe(-5)
  expect(nextStep(5, 1)).toBe(5)
  expect(nextStep(-3, 0)).toBe(0)
})
