import { expect, it } from 'vitest'
import { decodeRemote } from '../domain/remote'

it('decodifica le pressioni dei due lati e ignora gli altri messaggi', () => {
  const decode = (bytes: number[]) => decodeRemote(new DataView(Uint8Array.from(bytes).buffer))
  expect(decode([5, 0, 0x45, 0, 1])).toEqual({ port: 0, action: 1 })
  expect(decode([5, 0, 0x45, 1, 0xff])).toEqual({ port: 1, action: -1 })
  expect(decode([5, 0, 0x45, 0, 0x7f])).toEqual({ port: 0, action: 0 })
  expect(decode([5, 0, 0x45, 0, 0])).toEqual({ port: 0, action: 'release' })
  expect(decode([5, 0, 0x45, 1, 0])).toEqual({ port: 1, action: 'release' })
  expect(decode([5, 0, 0x45, 2, 1])).toBeUndefined()
  expect(decode([5, 0, 0x08, 0, 1])).toBeUndefined()
  expect(decode([5, 0, 0x99, 0, 1])).toBeUndefined()
  expect(decode([3, 0, 0x45])).toBeUndefined()
})
