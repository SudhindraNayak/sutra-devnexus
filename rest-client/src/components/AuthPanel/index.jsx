import { useState, useCallback, useEffect } from 'react';
import { previewAuthHeader } from '../../utils/authHelpers';
import { requestOAuthToken, persistOAuthToken, getTokenExpiryInfo } from '../../utils/oauthHandler';
import { getOAuthTokens, deleteOAuthToken } from '../../db/oauthTokens';
import { log } from '../../utils/logger';
import styles from './styles.module.css';

// ─── Auth type metadata ───────────────────────────────────────────────────────

const AUTH_TYPES = [
  { value: 'none',      label: 'No Auth',          desc: 'No authentication will be sent.' },
  { value: 'bearer',    label: 'Bearer Token',      desc: 'Sends an Authorization: Bearer <token> header.' },
  { value: 'basic',     label: 'Basic Auth',        desc: 'Encodes username:password as Base64 and sends an Authorization: Basic header.' },
  { value: 'apikey',    label: 'API Key',            desc: 'Sends a custom key-value pair as a header or query parameter.' },
  { value: 'oauth2',    label: 'OAuth 2.0',          desc: 'Fetches an access token via an OAuth 2.0 flow and sends it as a Bearer token.' },
  { value: 'digest',    label: 'Digest Auth',        desc: 'Computes an MD5/SHA-256 challenge-response for each request. Requires realm and nonce from a prior 401 response.' },
  { value: 'ntlm',      label: 'NTLM Auth',          desc: 'Windows NTLM authentication. Only the initial Negotiate message is sent; a proxy is required for the full handshake in browsers.' },
  { value: 'awssigv4',  label: 'AWS Signature v4',  desc: 'Signs requests with AWS SigV4 — required for most AWS service endpoints.' },
  { value: 'hawk',      label: 'Hawk Auth',          desc: 'HMAC-based HTTP authentication scheme. Computes a MAC from the request details.' },
  { value: 'edgegrid',  label: 'Akamai EdgeGrid',   desc: "Akamai's EG1-HMAC-SHA256 signing scheme for their APIs." },
];

const OAUTH_GRANT_TYPES = [
  { value: 'client_credentials', label: 'Client Credentials' },
  { value: 'password',           label: 'Password Credentials' },
  { value: 'authorization_code', label: 'Authorization Code' },
  { value: 'implicit',           label: 'Implicit' },
];

// ─── Small reusable field ─────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text', mono = true }) {
  return (
    <input
      className={`${styles.input} ${mono ? styles.mono : ''}`}
      type={type}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      spellCheck={false}
      autoComplete="off"
    />
  );
}

function SelectInput({ value, onChange, children }) {
  return (
    <select className={styles.select} value={value || ''} onChange={(e) => onChange(e.target.value)}>
      {children}
    </select>
  );
}

// ─── OAuth 2.0 sub-panel ──────────────────────────────────────────────────────

function OAuthPanel({ cfg, onChange, request }) {
  const [fetching, setFetching]     = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [savedTokens, setSavedTokens] = useState([]);

  const set = (field, val) => onChange({ ...cfg, [field]: val });

  useEffect(() => {
    getOAuthTokens().then(setSavedTokens).catch(() => {});
  }, [cfg.currentToken]);

  const handleGetToken = useCallback(async () => {
    setFetching(true);
    setFetchError(null);
    try {
      const tokenData = await requestOAuthToken({
        grantType:    cfg.grantType,
        authUrl:      cfg.authUrl,
        tokenUrl:     cfg.tokenUrl,
        clientId:     cfg.clientId,
        clientSecret: cfg.clientSecret,
        scope:        cfg.scope,
        state:        cfg.state,
        redirectUri:  cfg.redirectUri || window.location.origin,
        username:     cfg.username,
        password:     cfg.password,
      });
      const record = await persistOAuthToken({ tokenName: cfg.tokenName || 'My Token', tokenData });
      onChange({ ...cfg, currentToken: { accessToken: record.accessToken, expiresIn: record.expiresIn, obtainedAt: record.obtainedAt, tokenType: record.tokenType } });
      setSavedTokens((prev) => [...prev, record]);
    } catch (err) {
      setFetchError(err.message);
      log('error', 'OAuth2 token request failed', err.message);
    } finally {
      setFetching(false);
    }
  }, [cfg, onChange]);

  const handleUseToken = useCallback((token) => {
    onChange({ ...cfg, currentToken: { accessToken: token.accessToken, expiresIn: token.expiresIn, obtainedAt: token.obtainedAt, tokenType: token.tokenType } });
  }, [cfg, onChange]);

  const handleDeleteToken = useCallback(async (id) => {
    await deleteOAuthToken(id);
    setSavedTokens((prev) => prev.filter((t) => t.id !== id));
    if (savedTokens.find((t) => t.id === id)?.accessToken === cfg.currentToken?.accessToken) {
      onChange({ ...cfg, currentToken: null });
    }
  }, [savedTokens, cfg, onChange]);

  const showAuthUrl   = cfg.grantType === 'authorization_code' || cfg.grantType === 'implicit';
  const showRedirect  = cfg.grantType === 'authorization_code' || cfg.grantType === 'implicit';
  const showPassword  = cfg.grantType === 'password';

  const expiry = cfg.currentToken ? getTokenExpiryInfo(cfg.currentToken) : null;

  return (
    <div className={styles.oauthPanel}>
      <Field label="Grant Type">
        <SelectInput value={cfg.grantType} onChange={(v) => set('grantType', v)}>
          {OAUTH_GRANT_TYPES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
        </SelectInput>
      </Field>

      {showAuthUrl && (
        <Field label="Auth URL">
          <TextInput value={cfg.authUrl} onChange={(v) => set('authUrl', v)} placeholder="https://auth.example.com/oauth/authorize" />
        </Field>
      )}

      <Field label="Token URL">
        <TextInput value={cfg.tokenUrl} onChange={(v) => set('tokenUrl', v)} placeholder="https://auth.example.com/oauth/token" />
      </Field>

      <div className={styles.twoCol}>
        <Field label="Client ID">
          <TextInput value={cfg.clientId} onChange={(v) => set('clientId', v)} placeholder="client_id" />
        </Field>
        <Field label="Client Secret">
          <TextInput value={cfg.clientSecret} onChange={(v) => set('clientSecret', v)} placeholder="client_secret" type="password" />
        </Field>
      </div>

      <Field label="Scope">
        <TextInput value={cfg.scope} onChange={(v) => set('scope', v)} placeholder="read write openid" />
      </Field>

      {showRedirect && (
        <Field label="Redirect URI">
          <TextInput value={cfg.redirectUri} onChange={(v) => set('redirectUri', v)} placeholder={window.location.origin} />
        </Field>
      )}

      {cfg.grantType === 'authorization_code' && (
        <Field label="State (CSRF)">
          <TextInput value={cfg.state} onChange={(v) => set('state', v)} placeholder="optional random state" />
        </Field>
      )}

      {showPassword && (
        <div className={styles.twoCol}>
          <Field label="Username">
            <TextInput value={cfg.username} onChange={(v) => set('username', v)} placeholder="username" />
          </Field>
          <Field label="Password">
            <TextInput value={cfg.password} onChange={(v) => set('password', v)} placeholder="password" type="password" />
          </Field>
        </div>
      )}

      <Field label="Token Name (for saving)">
        <TextInput value={cfg.tokenName} onChange={(v) => set('tokenName', v)} placeholder="My Token" mono={false} />
      </Field>

      <button className={styles.getTokenBtn} onClick={handleGetToken} disabled={fetching}>
        {fetching ? <><span className={styles.spin} /> Requesting Token...</> : 'Get New Access Token'}
      </button>

      {fetchError && <div className={styles.oauthError}>{fetchError}</div>}

      {cfg.currentToken && (
        <div className={styles.tokenBox}>
          <div className={styles.tokenBoxHeader}>
            <span className={styles.tokenBoxTitle}>Current Token</span>
            {expiry && (
              <span className={`${styles.expiryBadge} ${expiry.expired ? styles.expired : styles.valid}`}>
                {expiry.expired ? 'Expired' : `Expires in ${expiry.remaining}s`}
              </span>
            )}
          </div>
          <div className={styles.tokenPreview}>
            {cfg.currentToken.accessToken.slice(0, 40)}…
          </div>
        </div>
      )}

      {savedTokens.length > 0 && (
        <div className={styles.savedTokens}>
          <div className={styles.savedTokensTitle}>Saved Tokens</div>
          {savedTokens.map((t) => {
            const info = getTokenExpiryInfo(t);
            return (
              <div key={t.id} className={styles.savedTokenRow}>
                <div className={styles.savedTokenInfo}>
                  <span className={styles.savedTokenName}>{t.name}</span>
                  <span className={`${styles.tokenStatusDot} ${info.expired ? styles.dotExpired : styles.dotValid}`} title={info.expired ? 'Expired' : 'Valid'} />
                </div>
                <div className={styles.savedTokenActions}>
                  <button className={styles.useTokenBtn} onClick={() => handleUseToken(t)}>Use</button>
                  <button className={styles.delTokenBtn} onClick={() => handleDeleteToken(t.id)}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main AuthPanel ───────────────────────────────────────────────────────────

export function AuthPanel({ auth, onChange, request }) {
  const [showPreview, setShowPreview] = useState(false);

  const setType = (type) => onChange({ ...auth, type });
  const setSubField = (ns, field, val) =>
    onChange({ ...auth, [ns]: { ...(auth[ns] || {}), [field]: val } });

  const meta    = AUTH_TYPES.find((t) => t.value === auth.type) || AUTH_TYPES[0];
  const preview = showPreview ? previewAuthHeader(auth, request?.method, request?.url) : null;

  return (
    <div className={styles.panel}>
      {/* Type selector */}
      <div className={styles.typeRow}>
        <label className={styles.typeLabel}>Auth Type</label>
        <select className={styles.typeSelect} value={auth.type} onChange={(e) => setType(e.target.value)}>
          {AUTH_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <p className={styles.desc}>{meta.desc}</p>

      {/* ── Per-type forms ── */}

      {auth.type === 'bearer' && (
        <Field label="Token">
          <TextInput value={auth.bearer?.token} onChange={(v) => setSubField('bearer', 'token', v)} placeholder="Enter bearer token…" />
        </Field>
      )}

      {auth.type === 'basic' && (
        <div className={styles.twoCol}>
          <Field label="Username">
            <TextInput value={auth.basic?.username} onChange={(v) => setSubField('basic', 'username', v)} placeholder="username" />
          </Field>
          <Field label="Password">
            <TextInput value={auth.basic?.password} onChange={(v) => setSubField('basic', 'password', v)} placeholder="password" type="password" />
          </Field>
        </div>
      )}

      {auth.type === 'apikey' && (
        <>
          <div className={styles.twoCol}>
            <Field label="Key Name">
              <TextInput value={auth.apikey?.key} onChange={(v) => setSubField('apikey', 'key', v)} placeholder="X-API-Key" />
            </Field>
            <Field label="Key Value">
              <TextInput value={auth.apikey?.value} onChange={(v) => setSubField('apikey', 'value', v)} placeholder="api-key-value" />
            </Field>
          </div>
          <Field label="Add To">
            <SelectInput value={auth.apikey?.in || 'header'} onChange={(v) => setSubField('apikey', 'in', v)}>
              <option value="header">Header</option>
              <option value="query">Query Parameter</option>
            </SelectInput>
          </Field>
        </>
      )}

      {auth.type === 'oauth2' && (
        <OAuthPanel
          cfg={auth.oauth2 || {}}
          onChange={(updated) => onChange({ ...auth, oauth2: updated })}
          request={request}
        />
      )}

      {auth.type === 'digest' && (
        <>
          <div className={styles.twoCol}>
            <Field label="Username">
              <TextInput value={auth.digest?.username} onChange={(v) => setSubField('digest', 'username', v)} placeholder="username" />
            </Field>
            <Field label="Password">
              <TextInput value={auth.digest?.password} onChange={(v) => setSubField('digest', 'password', v)} placeholder="password" type="password" />
            </Field>
          </div>
          <div className={styles.twoCol}>
            <Field label="Realm">
              <TextInput value={auth.digest?.realm} onChange={(v) => setSubField('digest', 'realm', v)} placeholder="From WWW-Authenticate header" />
            </Field>
            <Field label="Nonce">
              <TextInput value={auth.digest?.nonce} onChange={(v) => setSubField('digest', 'nonce', v)} placeholder="From WWW-Authenticate header" />
            </Field>
          </div>
          <Field label="Algorithm">
            <SelectInput value={auth.digest?.algorithm || 'MD5'} onChange={(v) => setSubField('digest', 'algorithm', v)}>
              <option value="MD5">MD5</option>
              <option value="SHA-256">SHA-256</option>
            </SelectInput>
          </Field>
          <p className={styles.hint}>Make an initial request without auth to receive the 401 with realm and nonce.</p>
        </>
      )}

      {auth.type === 'ntlm' && (
        <>
          <div className={styles.twoCol}>
            <Field label="Username">
              <TextInput value={auth.ntlm?.username} onChange={(v) => setSubField('ntlm', 'username', v)} placeholder="DOMAIN\\username" />
            </Field>
            <Field label="Password">
              <TextInput value={auth.ntlm?.password} onChange={(v) => setSubField('ntlm', 'password', v)} placeholder="password" type="password" />
            </Field>
          </div>
          <div className={styles.twoCol}>
            <Field label="Domain">
              <TextInput value={auth.ntlm?.domain} onChange={(v) => setSubField('ntlm', 'domain', v)} placeholder="CORP" />
            </Field>
            <Field label="Workstation">
              <TextInput value={auth.ntlm?.workstation} onChange={(v) => setSubField('ntlm', 'workstation', v)} placeholder="MYPC" />
            </Field>
          </div>
          <p className={styles.hint}>Browser limitation: only the NTLM Type-1 Negotiate message is sent. Full NTLM requires a local proxy.</p>
        </>
      )}

      {auth.type === 'awssigv4' && (
        <>
          <div className={styles.twoCol}>
            <Field label="Access Key ID">
              <TextInput value={auth.awssigv4?.accessKey} onChange={(v) => setSubField('awssigv4', 'accessKey', v)} placeholder="AKIAIOSFODNN7EXAMPLE" />
            </Field>
            <Field label="Secret Access Key">
              <TextInput value={auth.awssigv4?.secretKey} onChange={(v) => setSubField('awssigv4', 'secretKey', v)} placeholder="wJalrXUtnFEMI/K7MDENG" type="password" />
            </Field>
          </div>
          <div className={styles.twoCol}>
            <Field label="Region">
              <TextInput value={auth.awssigv4?.region} onChange={(v) => setSubField('awssigv4', 'region', v)} placeholder="us-east-1" />
            </Field>
            <Field label="Service Name">
              <TextInput value={auth.awssigv4?.service} onChange={(v) => setSubField('awssigv4', 'service', v)} placeholder="s3, execute-api, …" />
            </Field>
          </div>
          <Field label="Session Token (optional)">
            <TextInput value={auth.awssigv4?.sessionToken} onChange={(v) => setSubField('awssigv4', 'sessionToken', v)} placeholder="Temporary session token from STS" />
          </Field>
        </>
      )}

      {auth.type === 'hawk' && (
        <>
          <div className={styles.twoCol}>
            <Field label="Hawk Auth ID">
              <TextInput value={auth.hawk?.hawkId} onChange={(v) => setSubField('hawk', 'hawkId', v)} placeholder="hawk-auth-id" />
            </Field>
            <Field label="Hawk Auth Key">
              <TextInput value={auth.hawk?.hawkKey} onChange={(v) => setSubField('hawk', 'hawkKey', v)} placeholder="hawk-secret-key" type="password" />
            </Field>
          </div>
          <Field label="Algorithm">
            <SelectInput value={auth.hawk?.algorithm || 'sha256'} onChange={(v) => setSubField('hawk', 'algorithm', v)}>
              <option value="sha256">SHA-256</option>
              <option value="sha1">SHA-1</option>
            </SelectInput>
          </Field>
        </>
      )}

      {auth.type === 'edgegrid' && (
        <>
          <Field label="Client Token">
            <TextInput value={auth.edgegrid?.clientToken} onChange={(v) => setSubField('edgegrid', 'clientToken', v)} placeholder="akab-..." />
          </Field>
          <Field label="Client Secret">
            <TextInput value={auth.edgegrid?.clientSecret} onChange={(v) => setSubField('edgegrid', 'clientSecret', v)} placeholder="client secret" type="password" />
          </Field>
          <Field label="Access Token">
            <TextInput value={auth.edgegrid?.accessToken} onChange={(v) => setSubField('edgegrid', 'accessToken', v)} placeholder="akab-..." />
          </Field>
          <Field label="Base URI">
            <TextInput value={auth.edgegrid?.baseUri} onChange={(v) => setSubField('edgegrid', 'baseUri', v)} placeholder="https://{host}.luna.akamaiapis.net" />
          </Field>
        </>
      )}

      {/* Auth Preview */}
      {auth.type !== 'none' && (
        <div className={styles.previewSection}>
          <button className={styles.previewToggle} onClick={() => setShowPreview((s) => !s)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {showPreview ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
            </svg>
            {showPreview ? 'Hide Preview' : 'Auth Preview'}
          </button>
          {showPreview && (
            <div className={styles.preview}>
              {preview ? (
                <pre className={styles.previewCode}>{preview}</pre>
              ) : (
                <span className={styles.previewEmpty}>Fill in all required fields to see the computed header.</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
