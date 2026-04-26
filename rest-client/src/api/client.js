import axios from 'axios';
import { interpolate, interpolateHeaders, interpolateBody } from '../utils/interpolate';
import {
  computeDigestAuth,
  computeNtlmNegotiate,
  computeHawkAuth,
  computeEdgeGridAuth,
  computeAwsSigV4,
} from '../utils/authHelpers';
import { log } from '../utils/logger';

export async function executeRequest(requestConfig, variables = {}) {
  const {
    method = 'GET',
    url: rawUrl = '',
    headers: rawHeaders = [],
    params: rawParams = [],
    body,
    auth,
  } = requestConfig;

  const url = interpolate(rawUrl, variables);
  if (!url.trim()) throw new Error('URL is required');

  const resolvedHeaders = interpolateHeaders(
    rawHeaders.filter((h) => h.enabled && h.key),
    variables
  );
  const resolvedBody = interpolateBody(body, variables);

  // ── Build headers object ──────────────────────────────────────────────────
  const headersObj = {};
  resolvedHeaders.forEach((h) => { headersObj[h.key] = h.value; });

  // ── Apply auth ────────────────────────────────────────────────────────────
  if (auth) {
    switch (auth.type) {
      case 'bearer': {
        const token = interpolate(auth.bearer?.token || auth.token || '', variables);
        if (token) headersObj['Authorization'] = `Bearer ${token}`;
        break;
      }
      case 'basic': {
        const username = interpolate(auth.basic?.username || auth.username || '', variables);
        const password = interpolate(auth.basic?.password || auth.password || '', variables);
        if (username) headersObj['Authorization'] = `Basic ${btoa(`${username}:${password}`)}`;
        break;
      }
      case 'apikey': {
        const cfg = auth.apikey || auth;
        const k = interpolate(cfg.key || '', variables);
        const v = interpolate(cfg.value || '', variables);
        if (k && (cfg.in || auth.in) === 'header') headersObj[k] = v;
        break;
      }
      case 'oauth2': {
        const token = auth.oauth2?.currentToken?.accessToken;
        if (token) headersObj['Authorization'] = `Bearer ${token}`;
        break;
      }
      case 'digest': {
        const d = auth.digest || {};
        if (d.username && d.realm && d.nonce) {
          const h = computeDigestAuth({ method, url, ...d });
          Object.assign(headersObj, h);
        }
        break;
      }
      case 'ntlm': {
        const h = computeNtlmNegotiate(auth.ntlm || {});
        Object.assign(headersObj, h);
        break;
      }
      case 'hawk': {
        const h = auth.hawk || {};
        if (h.hawkId && h.hawkKey) {
          const computed = computeHawkAuth({ method, url, ...h });
          Object.assign(headersObj, computed);
        }
        break;
      }
      case 'edgegrid': {
        const e = auth.edgegrid || {};
        if (e.clientToken && e.clientSecret && e.accessToken) {
          const computed = computeEdgeGridAuth({ method, url, ...e });
          Object.assign(headersObj, computed);
        }
        break;
      }
      default:
        break;
    }
  }

  // ── Build query params ────────────────────────────────────────────────────
  const searchParams = {};
  rawParams
    .filter((p) => p.enabled && p.key)
    .forEach((p) => {
      searchParams[interpolate(p.key, variables)] = interpolate(p.value, variables);
    });
  // API Key in query
  if (auth?.type === 'apikey') {
    const cfg = auth.apikey || auth;
    const loc = cfg.in || auth.in;
    if (loc === 'query' && cfg.key) {
      searchParams[interpolate(cfg.key, variables)] = interpolate(cfg.value || '', variables);
    }
  }

  // ── Build body ────────────────────────────────────────────────────────────
  let data;
  let bodyString = '';
  if (resolvedBody) {
    if (resolvedBody.type === 'json' && resolvedBody.content) {
      if (!headersObj['Content-Type'] && !headersObj['content-type']) {
        headersObj['Content-Type'] = 'application/json';
      }
      data = resolvedBody.content;
      bodyString = resolvedBody.content;
    } else if (resolvedBody.type === 'raw' && resolvedBody.content) {
      data = resolvedBody.content;
      bodyString = resolvedBody.content;
    } else if (resolvedBody.type === 'form' && resolvedBody.fields?.length) {
      const form = new URLSearchParams();
      resolvedBody.fields.filter((f) => f.enabled && f.key).forEach((f) => form.append(f.key, f.value));
      data = form;
      bodyString = form.toString();
    }
  }

  // ── AWS SigV4 is applied AFTER body is known (payload hash depends on body) ──
  if (auth?.type === 'awssigv4') {
    const a = auth.awssigv4 || {};
    if (a.accessKey && a.secretKey) {
      const sigHeaders = computeAwsSigV4({
        method, url, headers: headersObj, body: bodyString,
        accessKey: a.accessKey, secretKey: a.secretKey,
        region: a.region || 'us-east-1', service: a.service || '',
        sessionToken: a.sessionToken || undefined,
      });
      Object.assign(headersObj, sigHeaders);
    }
  }

  log('info', `${method} ${url}`, `Sending request...`);

  const start = performance.now();

  try {
    const response = await axios({
      method: method.toLowerCase(),
      url,
      headers: headersObj,
      params: Object.keys(searchParams).length ? searchParams : undefined,
      data,
      validateStatus: () => true,
      transformResponse: [(d) => d],
    });

    const responseTime = Math.round(performance.now() - start);
    const responseBody = response.data || '';
    const responseSize = new TextEncoder().encode(responseBody).length;

    const status = response.status;
    const level  = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    log(level, `${method} ${url} → ${status} ${response.statusText}`, `Time: ${responseTime}ms  Size: ${responseSize}B`);

    if (responseTime > 3000) {
      log('warn', 'Slow response', `${method} ${url} took ${responseTime}ms (>3s threshold)`);
    }

    return { status, statusText: response.statusText, headers: response.headers, body: responseBody, time: responseTime, size: responseSize };
  } catch (err) {
    const responseTime = Math.round(performance.now() - start);
    const isCors = err.message?.includes('Network Error') || err.code === 'ERR_NETWORK';
    log('error', `${method} ${url} → Network Error`, isCors
      ? `${err.message} — This may be a CORS issue. Ensure the server allows cross-origin requests.`
      : err.message);
    throw err;
  }
}
