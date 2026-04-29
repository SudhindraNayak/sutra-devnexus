import CryptoJS from 'crypto-js';
import { log } from './logger';
import { signRequest as awsSign } from './awsSigV4';

// ─── Helpers ────────────────────────────────────────────────────────────────

function randomHex(bytes) {
  return CryptoJS.lib.WordArray.random(bytes).toString(CryptoJS.enc.Hex);
}

function md5Hex(str) {
  return CryptoJS.MD5(str).toString(CryptoJS.enc.Hex);
}

function sha256Hex(str) {
  return CryptoJS.SHA256(str).toString(CryptoJS.enc.Hex);
}

function hashFn(algorithm, str) {
  return algorithm === 'SHA-256' ? sha256Hex(str) : md5Hex(str);
}

// ─── Digest Auth ─────────────────────────────────────────────────────────────

export function computeDigestAuth({ method, url, username, password, realm, nonce, algorithm = 'MD5', qop = 'auth' }) {
  try {
    let uri;
    try {
      const p = new URL(url);
      uri = p.pathname + p.search;
    } catch {
      uri = url;
    }

    const nc     = '00000001';
    const cnonce = randomHex(8);
    const ha1    = hashFn(algorithm, `${username}:${realm}:${password}`);
    const ha2    = hashFn(algorithm, `${method.toUpperCase()}:${uri}`);
    const resp   = hashFn(algorithm, `${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);

    return {
      Authorization:
        `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", ` +
        `algorithm=${algorithm}, qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${resp}"`,
    };
  } catch (err) {
    log('error', 'Digest Auth failed', err.message);
    throw err;
  }
}

// ─── NTLM Auth (Negotiate/Type-1 only) ────────────────────────────────────

export function computeNtlmNegotiate({ domain = '', workstation = '' }) {
  try {
    // NTLM Type-1 (Negotiate) message — browser can only send the initial frame.
    // Full three-way handshake requires TCP-level control; use a local proxy for production NTLM.
    const flags = 0x0000b207; // NTLMSSP_NEGOTIATE_UNICODE | NTLMSSP_REQUEST_TARGET | NTLMSSP_NEGOTIATE_NTLM | NTLMSSP_NEGOTIATE_OEM_DOMAIN_SUPPLIED | NTLMSSP_NEGOTIATE_OEM_WORKSTATION_SUPPLIED
    const domainBytes  = new TextEncoder().encode(domain);
    const wsBytes      = new TextEncoder().encode(workstation);

    // Build a minimal Type-1 message buffer
    const buf = new Uint8Array(32 + domainBytes.length + wsBytes.length);
    const sig  = 'NTLMSSP\0';
    for (let i = 0; i < sig.length; i++) buf[i] = sig.charCodeAt(i);
    const dv = new DataView(buf.buffer);
    dv.setUint32(8, 1, true);  // MessageType = 1
    dv.setUint32(12, flags, true);
    dv.setUint16(16, domainBytes.length, true);
    dv.setUint16(18, domainBytes.length, true);
    dv.setUint32(20, 32, true);
    dv.setUint16(24, wsBytes.length, true);
    dv.setUint16(26, wsBytes.length, true);
    dv.setUint32(28, 32 + domainBytes.length, true);
    buf.set(domainBytes, 32);
    buf.set(wsBytes, 32 + domainBytes.length);

    const b64 = btoa(String.fromCharCode(...buf));

    log('warn', 'NTLM Auth', 'Only the Type-1 Negotiate message is set. Full NTLM requires a proxy for the challenge/response handshake.');

    return { Authorization: `NTLM ${b64}` };
  } catch (err) {
    log('error', 'NTLM Auth failed', err.message);
    throw err;
  }
}

// ─── Hawk Auth ───────────────────────────────────────────────────────────────

export function computeHawkAuth({ method, url, hawkId, hawkKey, algorithm = 'sha256', ext = '' }) {
  try {
    const parsed   = new URL(url);
    const ts       = String(Math.floor(Date.now() / 1000));
    const nonce    = randomHex(6);
    const port     = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
    const resource = parsed.pathname + (parsed.search || '');

    const normalized = [
      'hawk.1.header',
      ts,
      nonce,
      method.toUpperCase(),
      resource,
      parsed.hostname.toLowerCase(),
      port,
      '',  // hash
      ext,
      '',
    ].join('\n');

    const mac = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA256(normalized, hawkKey));

    return {
      Authorization: `Hawk id="${hawkId}", ts="${ts}", nonce="${nonce}", mac="${mac}"${ext ? `, ext="${ext}"` : ''}`,
    };
  } catch (err) {
    log('error', 'Hawk Auth failed', err.message);
    throw err;
  }
}

// ─── Akamai EdgeGrid Auth ────────────────────────────────────────────────────

export function computeEdgeGridAuth({ method, url, clientToken, clientSecret, accessToken, body = '' }) {
  try {
    const parsed    = new URL(url);
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, '+0000');
    const nonce     = randomHex(8);
    const authHeader =
      `EG1-HMAC-SHA256 client_token=${clientToken};access_token=${accessToken};` +
      `timestamp=${timestamp};nonce=${nonce};`;

    const contentHash = body
      ? CryptoJS.enc.Base64.stringify(CryptoJS.SHA256(body))
      : '';

    const pathQuery    = parsed.pathname + (parsed.search || '');
    const scheme       = parsed.protocol.replace(':', '');
    const signingData  = [
      method.toUpperCase(),
      scheme,
      parsed.host,
      pathQuery,
      '',          // canonicalized request headers (empty for basic)
      contentHash,
      authHeader,
    ].join('\t');

    const signingKey = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA256(timestamp, clientSecret));
    const signature  = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA256(signingData, signingKey));

    return { Authorization: `${authHeader}signature=${signature}` };
  } catch (err) {
    log('error', 'EdgeGrid Auth failed', err.message);
    throw err;
  }
}

// ─── AWS SigV4 (wrapper) ─────────────────────────────────────────────────────

export function computeAwsSigV4({ method, url, headers, body, accessKey, secretKey, region, service, sessionToken }) {
  try {
    return awsSign({ method, url, headers, body, accessKey, secretKey, region, service, sessionToken });
  } catch (err) {
    log('error', 'AWS SigV4 failed', err.message);
    throw err;
  }
}

// ─── Auth preview helper ──────────────────────────────────────────────────────

export function previewAuthHeader(auth, method = 'GET', url = 'https://example.com') {
  try {
    switch (auth.type) {
      case 'bearer':
        return auth.bearer?.token ? `Authorization: Bearer ${auth.bearer.token}` : null;
      case 'basic': {
        const { username = '', password = '' } = auth.basic || {};
        if (!username) return null;
        return `Authorization: Basic ${btoa(`${username}:${password}`)}`;
      }
      case 'apikey':
        if (!auth.apikey?.key) return null;
        return auth.apikey.in === 'header'
          ? `${auth.apikey.key}: ${auth.apikey.value}`
          : `Query param: ${auth.apikey.key}=${auth.apikey.value}`;
      case 'oauth2':
        return auth.oauth2?.currentToken?.accessToken
          ? `Authorization: Bearer ${auth.oauth2.currentToken.accessToken}`
          : null;
      case 'digest': {
        const d = auth.digest || {};
        if (!d.username || !d.realm || !d.nonce) return null;
        const h = computeDigestAuth({ method, url, ...d });
        return h.Authorization;
      }
      case 'ntlm': {
        const h = computeNtlmNegotiate(auth.ntlm || {});
        return h.Authorization;
      }
      case 'hawk': {
        const h = auth.hawk || {};
        if (!h.hawkId || !h.hawkKey) return null;
        const computed = computeHawkAuth({ method, url, ...h });
        return computed.Authorization;
      }
      case 'edgegrid': {
        const e = auth.edgegrid || {};
        if (!e.clientToken || !e.clientSecret || !e.accessToken) return null;
        const computed = computeEdgeGridAuth({ method, url, ...e });
        return computed.Authorization;
      }
      case 'awssigv4': {
        const a = auth.awssigv4 || {};
        if (!a.accessKey || !a.secretKey) return null;
        const computed = computeAwsSigV4({ method, url, headers: {}, body: '', ...a });
        return Object.entries(computed).map(([k, v]) => `${k}: ${v}`).join('\n');
      }
      default:
        return null;
    }
  } catch {
    return '(preview unavailable — check required fields)';
  }
}
