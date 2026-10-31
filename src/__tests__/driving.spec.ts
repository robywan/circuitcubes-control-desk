import { expect, it } from 'vitest'
import { command, nextStep, power } from '../driving'

it('calcola la Power per ogni Speed step', () => {
  expect([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].map(power)).toEqual([255, 211, 168, 124, 80, 0, 80, 124, 168, 211, 255])
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
