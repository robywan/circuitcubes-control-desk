import { expect, it } from 'vitest'
import { loadSettings } from '../domain/settings'

it('carica valori validi e ripristina quelli mancanti o non validi', () => {
  expect(
    loadSettings(
      '{"channel":"B","inverted":true,"minPower":100,"maxPower":200,"remoteSide":"right"}',
    ),
  ).toEqual({
    channel: 'B',
    inverted: true,
    minPower: 100,
    maxPower: 200,
    inertia: 2,
    brake: 1,
    remoteSide: 'right',
  })
  expect(
    loadSettings('{"channel":"D","inverted":1,"minPower":-1,"maxPower":256,"remoteSide":"x"}'),
  ).toEqual({
    channel: 'A',
    inverted: false,
    minPower: 80,
    maxPower: 255,
    inertia: 2,
    brake: 1,
    remoteSide: 'left',
  })
  expect(loadSettings('{')).toEqual(loadSettings(null))
  expect(loadSettings('{"minPower":200,"maxPower":100}')).toEqual({
    channel: 'A',
    inverted: false,
    minPower: 80,
    maxPower: 255,
    inertia: 2,
    brake: 1,
    remoteSide: 'left',
  })
})

it.each([
  ['{"inertia":0}', 0],
  ['{"inertia":5.5}', 5.5],
  ['{"inertia":10}', 10],
  ['{"inertia":-0.5}', 2],
  ['{"inertia":10.5}', 2],
  ['{"inertia":1.1}', 2],
  ['{"inertia":"5"}', 2],
  ['{}', 2],
])('carica Inerzia valida o usa il default: %s', (raw, inertia) => {
  expect(loadSettings(raw).inertia).toBe(inertia)
})

it.each([
  ['{"brake":0.5}', 0.5],
  ['{"brake":1}', 1],
  ['{"brake":10}', 10],
  ['{"brake":0}', 1],
  ['{"brake":10.5}', 1],
  ['{"brake":0.3}', 1],
  ['{"brake":"5"}', 1],
  ['{}', 1],
])('carica Brake valida o usa il default: %s', (raw, brake) => {
  expect(loadSettings(raw)).toHaveProperty('brake', brake)
})

it('ripristina la Power minima salvata sotto la Stall power', () => {
  expect(loadSettings('{"minPower":54,"maxPower":200}')).toMatchObject({
    minPower: 80,
    maxPower: 200,
  })
})

it.each([
  ['{"minPower":55,"maxPower":55}', 55, 55],
  ['{"minPower":30,"maxPower":200}', 80, 200],
  ['{"minPower":30,"maxPower":60}', 80, 255],
  ['{"minPower":80,"maxPower":54}', 80, 255],
  ['{"minPower":55,"maxPower":54}', 55, 255],
  ['{"minPower":"x","maxPower":50}', 80, 255],
  ['{"minPower":"x","maxPower":100}', 80, 100],
  ['{"minPower":50,"maxPower":"x"}', 80, 255],
  ['{"minPower":0,"maxPower":0}', 80, 255],
])('risolve i fallback rispettando minima ≤ massima: %s', (raw, minPower, maxPower) => {
  expect(loadSettings(raw)).toMatchObject({ minPower, maxPower })
})
