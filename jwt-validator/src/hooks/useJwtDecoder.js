function safeBase64urlDecode(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '==='.slice((base64.length + 3) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder('utf-8').decode(bytes)
}

function formatDelta(seconds) {
  const abs = Math.abs(seconds)
  if (abs < 60) return `${Math.round(abs)}s`
  if (abs < 3600) return `${Math.round(abs / 60)}m`
  if (abs < 86400) return `${Math.round(abs / 3600)}h`
  return `${Math.round(abs / 86400)}d`
}

export function decodeJwt(raw) {
  const token = raw.trim()
  if (!token) return { header: null, payload: null, parts: null, error: null }

  const parts = token.split('.')
  if (parts.length !== 3) {
    return { header: null, payload: null, parts: null, error: 'Invalid JWT — expected 3 dot-separated parts.' }
  }

  try {
    const header = JSON.parse(safeBase64urlDecode(parts[0]))
    const payload = JSON.parse(safeBase64urlDecode(parts[1]))
    return { header, payload, parts, error: null }
  } catch (e) {
    return { header: null, payload: null, parts, error: `Decode error: ${e.message}` }
  }
}

export function computeAudit(header, payload) {
  const now = Math.floor(Date.now() / 1000)
  const findings = []
  const alg = header?.alg || ''

  if (alg.toLowerCase() === 'none') {
    findings.push({
      level: 'critical',
      title: "Algorithm 'none'",
      detail: 'Signature verification is bypassed — any payload is accepted without validation.',
    })
  }

  if (payload?.exp != null) {
    if (now > payload.exp) {
      findings.push({
        level: 'error',
        title: 'Token expired',
        detail: `Expired ${formatDelta(now - payload.exp)} ago.`,
      })
    }
  } else {
    findings.push({
      level: 'warning',
      title: 'No expiration',
      detail: 'The exp claim is missing — this token never expires.',
    })
  }

  if (payload?.nbf != null && now < payload.nbf) {
    findings.push({
      level: 'warning',
      title: 'Not yet valid',
      detail: `Token becomes valid in ${formatDelta(payload.nbf - now)}.`,
    })
  }

  if (payload?.exp != null && payload?.iat != null) {
    const lifetime = payload.exp - payload.iat
    if (lifetime > 86400) {
      findings.push({
        level: 'warning',
        title: 'Long token lifetime',
        detail: `Lifetime is ${formatDelta(lifetime)} — consider using shorter-lived tokens.`,
      })
    }
  }

  if (!payload?.iss) {
    findings.push({
      level: 'info',
      title: 'No issuer',
      detail: 'The iss claim is absent.',
    })
  }

  if (!payload?.aud) {
    findings.push({
      level: 'info',
      title: 'No audience',
      detail: 'The aud claim is absent — any recipient can use this token.',
    })
  }

  if (['HS256', 'HS384', 'HS512'].includes(alg)) {
    findings.push({
      level: 'info',
      title: 'Symmetric algorithm',
      detail: `${alg} uses a shared secret. Both issuer and verifier must keep it confidential.`,
    })
  }

  if (findings.length === 0) {
    findings.push({
      level: 'pass',
      title: 'No issues found',
      detail: 'Token structure and standard claims look healthy.',
    })
  }

  const ORDER = { critical: 0, error: 1, warning: 2, info: 3, pass: 4 }
  return findings.sort((a, b) => ORDER[a.level] - ORDER[b.level])
}
