export function decodeRemote(value: DataView): { port: number; action: -1 | 0 | 1 } | undefined {
  if (value.byteLength < 5 || value.getUint8(2) !== 0x45) return
  const port = value.getUint8(3)
  if (port !== 0 && port !== 1) return
  const button = value.getUint8(4)
  if (button === 1) return { port, action: 1 }
  if (button === 0xff) return { port, action: -1 }
  if (button === 0x7f) return { port, action: 0 }
}
