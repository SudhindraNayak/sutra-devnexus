import { v4 as uuidv4 } from 'uuid';
import { log } from './logger';
import { saveOAuthToken } from '../db/oauthTokens';

const POPUP_W = 620;
const POPUP_H = 720;

function openPopup(url) {
  const left = Math.max(0, (screen.width  - POPUP_W) / 2);
  const top  = Math.max(0, (screen.height - POPUP_H) / 2);
  return window.open(
    url,
    'oauth2_popup',
    `width=${POPUP_W},height=${POPUP_H},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
  );
}

async function postTokenRequest(tokenUrl, params) {
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(params).toString(),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { error: text }; }
  if (!res.ok) throw new Error(`Token request failed (${res.status}): ${data.error_description || data.error || text}`);
  return data;
}

// ─── Client Credentials ──────────────────────────────────────────────────────

export async function getTokenClientCredentials({ tokenUrl, clientId, clientSecret, scope }) {
  log('info', 'OAuth2 Client Credentials', `Requesting token from ${tokenUrl}`);
  try {
    const params = { grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret };
    if (scope) params.scope = scope;
    const data = await postTokenRequest(tokenUrl, params);
    log('info', 'OAuth2 Client Credentials', `Token obtained. Expires in: ${data.expires_in ?? '?'}s`);
    return data;
  } catch (err) {
    log('error', 'OAuth2 Client Credentials', err.message);
    throw err;
  }
}

// ─── Password Credentials ────────────────────────────────────────────────────

export async function getTokenPasswordCredentials({ tokenUrl, clientId, clientSecret, username, password, scope }) {
  log('info', 'OAuth2 Password', `Requesting token from ${tokenUrl}`);
  try {
    const params = { grant_type: 'password', client_id: clientId, username, password };
    if (clientSecret) params.client_secret = clientSecret;
    if (scope) params.scope = scope;
    const data = await postTokenRequest(tokenUrl, params);
    log('info', 'OAuth2 Password', `Token obtained. Expires in: ${data.expires_in ?? '?'}s`);
    return data;
  } catch (err) {
    log('error', 'OAuth2 Password', err.message);
    throw err;
  }
}

// ─── Authorization Code ───────────────────────────────────────────────────────

export async function getTokenAuthorizationCode({ authUrl, tokenUrl, clientId, clientSecret, redirectUri, scope, state }) {
  log('info', 'OAuth2 Auth Code', 'Opening authorization popup...');
  const stateVal = state || Math.random().toString(36).slice(2);

  const qs = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: redirectUri, state: stateVal });
  if (scope) qs.set('scope', scope);

  const popup = openPopup(`${authUrl}?${qs.toString()}`);
  if (!popup) {
    const err = new Error('Popup was blocked. Allow popups for this site and try again.');
    log('error', 'OAuth2 Auth Code', err.message);
    throw err;
  }

  return new Promise((resolve, reject) => {
    const onMessage = async (evt) => {
      if (evt.data?.type !== 'oauth2_callback') return;
      cleanup();
      const { code, error, state: retState } = evt.data;
      if (error) { return reject(new Error(`Auth error: ${error}`)); }
      if (retState !== stateVal) { return reject(new Error('State mismatch — possible CSRF.')); }
      try {
        const params = { grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: clientId };
        if (clientSecret) params.client_secret = clientSecret;
        const data = await postTokenRequest(tokenUrl, params);
        log('info', 'OAuth2 Auth Code', `Token obtained. Expires in: ${data.expires_in ?? '?'}s`);
        resolve(data);
      } catch (e) { reject(e); }
    };

    const poll = setInterval(() => {
      if (!popup || popup.closed) { cleanup(); return reject(new Error('Popup closed before authorization completed.')); }
      try {
        const href = popup.location.href;
        if (href && href.startsWith(redirectUri)) {
          cleanup();
          popup.close();
          const u = new URL(href);
          const code  = u.searchParams.get('code');
          const error = u.searchParams.get('error');
          const retState = u.searchParams.get('state');
          if (error) return reject(new Error(`Auth error: ${error}`));
          if (retState !== stateVal) return reject(new Error('State mismatch.'));
          const params = { grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: clientId };
          if (clientSecret) params.client_secret = clientSecret;
          postTokenRequest(tokenUrl, params).then((data) => {
            log('info', 'OAuth2 Auth Code', `Token obtained. Expires in: ${data.expires_in ?? '?'}s`);
            resolve(data);
          }).catch(reject);
        }
      } catch { /* cross-origin while popup on auth server — normal */ }
    }, 400);

    const cleanup = () => { clearInterval(poll); window.removeEventListener('message', onMessage); };
    window.addEventListener('message', onMessage);
  });
}

// ─── Implicit ─────────────────────────────────────────────────────────────────

export async function getTokenImplicit({ authUrl, clientId, redirectUri, scope, state }) {
  log('info', 'OAuth2 Implicit', 'Opening authorization popup...');
  const stateVal = state || Math.random().toString(36).slice(2);
  const qs = new URLSearchParams({ response_type: 'token', client_id: clientId, redirect_uri: redirectUri, state: stateVal });
  if (scope) qs.set('scope', scope);

  const popup = openPopup(`${authUrl}?${qs.toString()}`);
  if (!popup) {
    const err = new Error('Popup was blocked. Allow popups for this site and try again.');
    log('error', 'OAuth2 Implicit', err.message);
    throw err;
  }

  return new Promise((resolve, reject) => {
    const poll = setInterval(() => {
      if (!popup || popup.closed) { clearInterval(poll); return reject(new Error('Popup closed before token received.')); }
      try {
        const href = popup.location.href;
        if (href && (href.startsWith(redirectUri) || href.includes('access_token'))) {
          clearInterval(poll);
          popup.close();
          const u = new URL(href);
          const hash  = new URLSearchParams(u.hash.replace('#', '?').slice(1));
          const token = hash.get('access_token') || u.searchParams.get('access_token');
          const error = hash.get('error') || u.searchParams.get('error');
          if (error) return reject(new Error(`Auth error: ${error}`));
          if (!token) return reject(new Error('No access_token found in redirect URI.'));
          log('info', 'OAuth2 Implicit', 'Token obtained.');
          resolve({
            access_token:  token,
            token_type:    hash.get('token_type') || 'Bearer',
            expires_in:    parseInt(hash.get('expires_in') || '3600', 10),
          });
        }
      } catch { /* cross-origin */ }
    }, 400);
  });
}

// ─── Dispatch by grant type ───────────────────────────────────────────────────

export async function requestOAuthToken(config) {
  switch (config.grantType) {
    case 'client_credentials':
      return getTokenClientCredentials(config);
    case 'password':
      return getTokenPasswordCredentials(config);
    case 'authorization_code':
      return getTokenAuthorizationCode(config);
    case 'implicit':
      return getTokenImplicit(config);
    default:
      throw new Error(`Unknown OAuth2 grant type: ${config.grantType}`);
  }
}

// ─── Persistence ─────────────────────────────────────────────────────────────

export async function persistOAuthToken({ tokenName, tokenData, environmentId = null }) {
  const record = {
    id:           uuidv4(),
    name:         tokenName || 'Unnamed Token',
    environmentId,
    accessToken:  tokenData.access_token,
    refreshToken: tokenData.refresh_token || null,
    tokenType:    tokenData.token_type    || 'Bearer',
    expiresIn:    tokenData.expires_in    || null,
    obtainedAt:   Date.now(),
    scope:        tokenData.scope         || null,
  };
  await saveOAuthToken(record);
  log('info', 'OAuth2', `Token "${record.name}" saved to storage.`);
  return record;
}

// ─── Token status helpers ─────────────────────────────────────────────────────

export function getTokenExpiryInfo(token) {
  if (!token || !token.expiresIn || !token.obtainedAt) return { expired: false, remaining: null };
  const expiresAt = token.obtainedAt + token.expiresIn * 1000;
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) return { expired: true, remaining: 0, expiresAt };
  return { expired: false, remaining: Math.round(remaining / 1000), expiresAt };
}

export function isTokenExpired(token) {
  return getTokenExpiryInfo(token).expired;
}
