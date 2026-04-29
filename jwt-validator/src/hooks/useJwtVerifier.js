import { jwtVerify, createRemoteJWKSet, importSPKI, importJWK } from 'jose'

export async function verifyWithOIDC(token, issuer) {
  const base = issuer.replace(/\/$/, '')
  const discoveryResp = await fetch(`${base}/.well-known/openid-configuration`)
  if (!discoveryResp.ok) {
    throw new Error(`OIDC discovery failed (${discoveryResp.status} ${discoveryResp.statusText})`)
  }
  const discovery = await discoveryResp.json()
  if (!discovery.jwks_uri) {
    throw new Error('OIDC discovery response is missing jwks_uri')
  }
  const JWKS = createRemoteJWKSet(new URL(discovery.jwks_uri))
  const result = await jwtVerify(token, JWKS)
  return { ...result, jwks_uri: discovery.jwks_uri }
}

export async function verifyWithManualKey(token, keyStr, alg) {
  const trimmed = keyStr.trim()
  let key

  if (trimmed.startsWith('-----')) {
    key = await importSPKI(trimmed, alg)
  } else if (trimmed.startsWith('{')) {
    const jwk = JSON.parse(trimmed)
    key = await importJWK(jwk, alg)
  } else {
    key = new TextEncoder().encode(trimmed)
  }

  return jwtVerify(token, key)
}

export function mapVerifyError(err) {
  const code = err?.code || ''
  const msg = err?.message || 'Verification failed'

  if (code === 'ERR_JWT_EXPIRED') return 'Token is expired'
  if (code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') return 'Signature mismatch — wrong key or tampered token'
  if (code === 'ERR_JWKS_NO_MATCHING_KEY') return 'No matching key found in JWKS'
  if (code === 'ERR_JWKS_MULTIPLE_MATCHING_KEYS') return 'Multiple JWKS keys matched — unable to determine correct key'
  if (code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') return msg
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS')) {
    return 'Network error — CORS or connectivity issue reaching the issuer endpoint'
  }
  return msg
}
