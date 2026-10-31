import { expect, it } from 'vitest'
import { loadSettings } from '../settings'

it('carica valori validi e ripristina quelli mancanti o non validi', () => {
  expect(loadSettings('{"channel":"B","inverted":true,"minPower":100,"maxPower":200,"remoteSide":"right"}')).toEqual({ channel: 'B', inverted: true, minPower: 100, maxPower: 200, remoteSide: 'right' })
  expect(loadSettings('{"channel":"D","inverted":1,"minPower":-1,"maxPower":256,"remoteSide":"x"}')).toEqual({ channel: 'A', inverted: false, minPower: 80, maxPower: 255, remoteSide: 'left' })
  expect(loadSettings('{')).toEqual(loadSettings(null))
  expect(loadSettings('{"minPower":200,"maxPower":100}')).toEqual({ channel: 'A', inverted: false, minPower: 80, maxPower: 255, remoteSide: 'left' })
})
