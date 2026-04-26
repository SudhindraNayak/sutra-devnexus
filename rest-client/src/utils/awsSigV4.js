import CryptoJS from 'crypto-js';

function sha256Hex(str) {
  return CryptoJS.SHA256(str).toString(CryptoJS.enc.Hex);
}

function hmacSHA256(key, data) {
  return CryptoJS.HmacSHA256(data, key);
}

function toHex(wordArray) {
  return wordArray.toString(CryptoJS.enc.Hex);
}

function getAmzDateTime(date) {
  // YYYYMMDDTHHMMSSZ
  return date.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
}

function getDateStamp(date) {
  // YYYYMMDD
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function encodeURIComponentStrict(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function buildCanonicalUri(pathname) {
  if (!pathname || pathname === '') return '/';
  return pathname.split('/').map((seg) => encodeURIComponentStrict(decodeURIComponent(seg))).join('/');
}

function buildCanonicalQueryString(searchParams) {
  const params = [...searchParams.entries()];
  if (!params.length) return '';
  return params
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponentStrict(k)}=${encodeURIComponentStrict(v)}`)
    .join('&');
}

function buildSigningKey(secretKey, dateStamp, region, service) {
  const kDate    = hmacSHA256(`AWS4${secretKey}`, dateStamp);
  const kRegion  = hmacSHA256(kDate, region);
  const kService = hmacSHA256(kRegion, service);
  return hmacSHA256(kService, 'aws4_request');
}

export function signRequest({ method, url, headers = {}, body = '', accessKey, secretKey, region, service, sessionToken }) {
  const parsedUrl = new URL(url);
  const now = new Date();
  const amzDate  = getAmzDateTime(now);
  const dateStamp = getDateStamp(now);

  // Build canonical headers — always include host and x-amz-date
  const rawHeaders = {
    host: parsedUrl.host,
    'x-amz-date': amzDate,
  };
  if (sessionToken) rawHeaders['x-amz-security-token'] = sessionToken;

  // Merge caller-supplied headers (lowercase keys)
  Object.entries(headers).forEach(([k, v]) => {
    const lk = k.toLowerCase();
    if (lk !== 'host' && lk !== 'x-amz-date' && lk !== 'x-amz-security-token') {
      rawHeaders[lk] = v;
    }
  });

  const sortedHeaderNames = Object.keys(rawHeaders).sort();
  const canonicalHeaders  = sortedHeaderNames.map((k) => `${k}:${rawHeaders[k]}\n`).join('');
  const signedHeaders     = sortedHeaderNames.join(';');

  const canonicalUri     = buildCanonicalUri(parsedUrl.pathname);
  const canonicalQuery   = buildCanonicalQueryString(parsedUrl.searchParams);
  const payloadHash      = sha256Hex(body || '');

  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey  = buildSigningKey(secretKey, dateStamp, region, service);
  const signature   = toHex(hmacSHA256(signingKey, stringToSign));

  const authorizationHeader =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const result = {
    Authorization:  authorizationHeader,
    'x-amz-date':   amzDate,
  };
  if (sessionToken) result['x-amz-security-token'] = sessionToken;
  return result;
}
