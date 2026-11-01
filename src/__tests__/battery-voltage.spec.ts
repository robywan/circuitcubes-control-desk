import { expect, it } from 'vitest'
import { parseBatteryVoltage } from '../domain/battery-voltage'

it.each([
  ['3.92', 3.92],
  ['3.92\0', 3.92],
  [' 3.9 ', 3.9],
  ['+124a', null],
  ['', null],
])('interpreta la risposta %j come %s', (text, expected) => {
  expect(parseBatteryVoltage(text)).toBe(expected)
})
