import { expect, it } from 'vitest'
import { loadSettings } from '../settings'

it('carica valori validi e ripristina quelli mancanti o non validi', () => {
  expect(loadSettings('{"channel":"B","inverted":true,"minPower":100,"maxPower":200,"remoteSide":"right"}')).toEqual({ channel: 'B', inverted: true, minPower: 100, maxPower: 200, remoteSide: 'right' })
  expect(loadSettings('{"channel":"D","inverted":1,"minPower":-1,"maxPower":256,"remoteSide":"x"}')).toEqual({ channel: 'A', inverted: false, minPower: 80, maxPower: 255, remoteSide: 'left' })
  expect(loadSettings('{')).toEqual(loadSettings(null))
  expect(loadSettings('{"minPower":200,"maxPower":100}')).toEqual({ channel: 'A', inverted: false, minPower: 80, maxPower: 255, remoteSide: 'left' })
})

it.each([
  ['{"minPower":"x","maxPower":50}', 80, 255],
  ['{"minPower":"x","maxPower":100}', 80, 100],
  ['{"minPower":50,"maxPower":"x"}', 50, 255],
  ['{"minPower":0,"maxPower":0}', 0, 0],
])('risolve i fallback rispettando minima ≤ massima: %s', (raw, minPower, maxPower) => {
  expect(loadSettings(raw)).toMatchObject({ minPower, maxPower })
})
