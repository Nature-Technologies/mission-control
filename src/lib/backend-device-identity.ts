import { createHash, generateKeyPairSync, createPrivateKey, sign } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { config } from './config'

const IDENTITY_FILE = path.join(config.dataDir, 'gateway-device-identity.json')

interface StoredIdentity {
  deviceId: string
  publicKeyBase64: string
  privateKeyBase64: string
}

let cached: StoredIdentity | null = null

function toBase64Url(buf: Buffer): string {
  return buf.toString('base64url')
}

export function getOrCreateBackendDeviceIdentity(): StoredIdentity {
  if (cached) return cached

  if (existsSync(IDENTITY_FILE)) {
    try {
      const stored = JSON.parse(readFileSync(IDENTITY_FILE, 'utf-8')) as StoredIdentity
      if (stored.deviceId && stored.publicKeyBase64 && stored.privateKeyBase64) {
        cached = stored
        return cached
      }
    } catch { /* fall through to generate */ }
  }

  // Ed25519 SPKI DER = 12-byte header + 32-byte raw public key
  const { publicKey: pubDer, privateKey: privDer } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  })

  const pubRaw = (pubDer as Buffer).slice(-32)
  const deviceId = createHash('sha256').update(pubRaw).digest('hex')
  const identity: StoredIdentity = {
    deviceId,
    publicKeyBase64: toBase64Url(pubRaw),
    privateKeyBase64: toBase64Url(privDer as Buffer),
  }

  mkdirSync(path.dirname(IDENTITY_FILE), { recursive: true })
  writeFileSync(IDENTITY_FILE, JSON.stringify(identity, null, 2), 'utf-8')
  cached = identity
  return cached
}

export function signBackendPayload(privateKeyBase64: string, payload: string): string {
  const privDer = Buffer.from(privateKeyBase64, 'base64url')
  const privateKey = createPrivateKey({ key: privDer, format: 'der', type: 'pkcs8' })
  return sign(null, Buffer.from(payload), privateKey).toString('base64url')
}
