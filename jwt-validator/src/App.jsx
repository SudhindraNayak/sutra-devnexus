import { useState, useCallback, useEffect, useMemo } from 'react'
import Editor from '@monaco-editor/react'
import {
  ShieldCheck, ShieldAlert, ShieldX, Info, CheckCircle,
  Key, Loader, Copy, Trash2, AlertCircle,
} from 'lucide-react'
import { decodeJwt, computeAudit } from './hooks/useJwtDecoder'
import { verifyWithOIDC, verifyWithManualKey, mapVerifyError } from './hooks/useJwtVerifier'

const SAMPLE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ' +
  '.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'

const MONACO_OPTIONS = {
  readOnly: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  wordWrap: 'on',
  lineNumbers: 'off',
  folding: false,
  glyphMargin: false,
  lineDecorationsWidth: 0,
  lineNumbersMinChars: 0,
  renderLineHighlight: 'none',
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  scrollbar: { vertical: 'hidden', horizontal: 'hidden', alwaysConsumeMouseWheel: false },
  padding: { top: 12, bottom: 12, left: 8, right: 8 },
  fontSize: 13,
  fontFamily: '"JetBrains Mono", monospace',
  automaticLayout: true,
}

const SEVERITY = {
  critical: { icon: ShieldX,     color: 'text-red-400',     bg: 'bg-red-500/[0.08] border-red-500/20',       label: 'CRITICAL' },
  error:    { icon: ShieldAlert,  color: 'text-rose-400',    bg: 'bg-rose-500/[0.08] border-rose-500/20',      label: 'ERROR'    },
  warning:  { icon: AlertCircle,  color: 'text-amber-400',   bg: 'bg-amber-500/[0.08] border-amber-500/20',    label: 'WARN'     },
  info:     { icon: Info,         color: 'text-sky-400',     bg: 'bg-sky-500/[0.08] border-sky-500/20',        label: 'INFO'     },
  pass:     { icon: CheckCircle,  color: 'text-emerald-400', bg: 'bg-emerald-500/[0.08] border-emerald-500/20', label: 'PASS'    },
}

const VERIFY_CONFIG = {
  idle:        { label: 'Not verified',          color: 'text-slate-400',   bg: 'bg-slate-800/50 border-slate-700/60',         spin: false },
  discovering: { label: 'Discovering OIDC…',     color: 'text-blue-400',    bg: 'bg-blue-500/[0.08] border-blue-500/30',       spin: true  },
  verifying:   { label: 'Verifying signature…',  color: 'text-blue-400',    bg: 'bg-blue-500/[0.08] border-blue-500/30',       spin: true  },
  verified:    { label: 'Signature verified',    color: 'text-emerald-400', bg: 'bg-emerald-500/[0.08] border-emerald-500/30', spin: false },
  failed:      { label: 'Verification failed',   color: 'text-red-400',     bg: 'bg-red-500/[0.08] border-red-500/30',         spin: false },
}

function JsonPanel({ title, data }) {
  const json = data ? JSON.stringify(data, null, 2) : ''
  const lines = json ? json.split('\n').length : 0
  const height = Math.max(60, lines * 20 + 24)

  return (
    <div className="border border-slate-700/60 rounded-xl overflow-hidden">
      <div className="h-9 px-4 flex items-center bg-slate-800/70 border-b border-slate-700/60">
        <span className="text-[11px] font-semibold text-slate-400 font-mono uppercase tracking-widest">{title}</span>
      </div>
      {data ? (
        <Editor
          height={height}
          defaultLanguage="json"
          value={json}
          options={MONACO_OPTIONS}
          theme="vs-dark"
        />
      ) : (
        <div className="h-14 flex items-center justify-center text-slate-700 text-sm font-mono">—</div>
      )}
    </div>
  )
}

export default function App() {
  const [token, setToken] = useState('')
  const [manualKey, setManualKey] = useState('')
  const [useManual, setUseManual] = useState(false)
  const [verifyState, setVerifyState] = useState('idle')
  const [verifyMsg, setVerifyMsg] = useState('')
  const [copied, setCopied] = useState(false)

  const decoded = useMemo(
    () => (token.trim() ? decodeJwt(token) : { header: null, payload: null, parts: null, error: null }),
    [token],
  )
  const audit = useMemo(
    () => (decoded.header && decoded.payload ? computeAudit(decoded.header, decoded.payload) : []),
    [decoded.header, decoded.payload],
  )

  const issuer = decoded.payload?.iss || ''
  const headerAlg = decoded.header?.alg || ''

  useEffect(() => {
    if (useManual || !token.trim() || !issuer) {
      if (!useManual) setVerifyState('idle')
      return
    }
    if (headerAlg.toLowerCase() === 'none') {
      setVerifyState('failed')
      setVerifyMsg("alg:none — signature verification not possible")
      return
    }

    let cancelled = false
    setVerifyState('discovering')
    setVerifyMsg(`${issuer}/.well-known/openid-configuration`)

    ;(async () => {
      try {
        const result = await verifyWithOIDC(token.trim(), issuer)
        if (cancelled) return
        setVerifyState('verified')
        setVerifyMsg(`JWKS: ${result.jwks_uri}`)
      } catch (e) {
        if (cancelled) return
        setVerifyState('failed')
        setVerifyMsg(mapVerifyError(e))
      }
    })()

    return () => { cancelled = true }
  }, [token, issuer, useManual, headerAlg])

  const handleManualVerify = useCallback(async () => {
    if (!token.trim() || !decoded.header) return
    if (headerAlg.toLowerCase() === 'none') {
      setVerifyState('failed')
      setVerifyMsg("alg:none — cannot verify")
      return
    }
    setVerifyState('verifying')
    setVerifyMsg('')
    try {
      await verifyWithManualKey(token.trim(), manualKey, decoded.header.alg)
      setVerifyState('verified')
      setVerifyMsg('Signature matches the provided key')
    } catch (e) {
      setVerifyState('failed')
      setVerifyMsg(mapVerifyError(e))
    }
  }, [token, decoded.header, manualKey, headerAlg])

  const handleClear = useCallback(() => {
    setToken('')
    setManualKey('')
    setVerifyState('idle')
    setVerifyMsg('')
  }, [])

  const handleCopy = useCallback(async () => {
    if (!decoded.payload) return
    const text = JSON.stringify(decoded.payload, null, 2)
    try { await navigator.clipboard.writeText(text) } catch { /* ignore */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [decoded.payload])

  const verifyCfg = VERIFY_CONFIG[verifyState]
  const hasToken = !!token.trim()

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-200 overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Header ── */}
      <header className="h-[72px] flex-shrink-0 flex items-center px-6 gap-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-cyan-500/40 shadow-[0_0_12px_rgba(34,211,238,0.2)] flex-shrink-0">
            <img
              src="/logo.png"
              alt="DevNexus"
              className="w-full h-full object-cover"
              style={{ objectPosition: '50% 38%' }}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight text-cyan-400">DevNexus</span>
            <span className="text-slate-500 text-lg">—</span>
            <span className="text-lg font-semibold tracking-tight text-slate-100">JWT Validator</span>
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setToken(SAMPLE_JWT); setVerifyState('idle'); setVerifyMsg('') }}
            className="px-3.5 py-2 text-sm rounded-lg text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white transition-colors"
          >
            Sample
          </button>
          <div className="h-7 w-px bg-slate-700/60 mx-0.5" />
          <button
            onClick={handleClear}
            className="px-3.5 py-2 text-sm rounded-lg text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <Trash2 size={14} />
            Clear
          </button>
          <button
            onClick={handleCopy}
            disabled={!decoded.payload}
            className="px-3.5 py-2 text-sm rounded-lg text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            <Copy size={14} />
            {copied ? 'Copied!' : 'Copy Payload'}
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 flex overflow-hidden">

        {/* Left pane */}
        <div className="w-1/2 flex flex-col border-r border-slate-800 overflow-hidden">

          <div className="h-10 flex-shrink-0 flex items-center px-6 gap-2.5 border-b border-slate-800 bg-slate-900/40">
            <Key size={14} className="text-slate-500" />
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">JWT Token</span>
          </div>

          {/* Token textarea */}
          <div className="flex-1 min-h-0">
            <textarea
              value={token}
              onChange={(e) => { setToken(e.target.value); setVerifyState('idle'); setVerifyMsg('') }}
              placeholder="Paste your JWT here…"
              spellCheck={false}
              className="w-full h-full resize-none bg-transparent text-slate-200 text-sm p-6 outline-none placeholder:text-slate-700 overflow-y-auto leading-relaxed"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            />
          </div>

          {/* JWT parts strip */}
          {decoded.parts && (
            <div className="flex-shrink-0 px-6 py-3 border-t border-slate-800 bg-slate-900/30">
              <div className="flex items-center gap-0.5 font-mono text-xs leading-relaxed overflow-hidden">
                <span className="text-cyan-400 truncate" style={{ maxWidth: '30%' }}>{decoded.parts[0]}</span>
                <span className="text-slate-600 flex-shrink-0 mx-0.5">.</span>
                <span className="text-violet-400 truncate" style={{ maxWidth: '42%' }}>{decoded.parts[1]}</span>
                <span className="text-slate-600 flex-shrink-0 mx-0.5">.</span>
                <span className="text-amber-400 truncate" style={{ maxWidth: '28%' }}>{decoded.parts[2]}</span>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-cyan-500/70 inline-block" />Header
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-violet-500/70 inline-block" />Payload
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-amber-500/70 inline-block" />Signature
                </span>
                {decoded.header?.alg && (
                  <span className="ml-auto text-[11px] font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                    {decoded.header.alg}{decoded.header.typ ? ` · ${decoded.header.typ}` : ''}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Decode error */}
          {decoded.error && (
            <div className="flex-shrink-0 mx-6 mb-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {decoded.error}
            </div>
          )}

          {/* Verification section */}
          <div className="flex-shrink-0 border-t border-slate-800 max-h-[48vh] overflow-y-auto">
            <div className="px-6 py-5 space-y-4">

              {/* Mode toggle */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  Signature Verification
                </span>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs text-slate-500">{useManual ? 'Manual Key' : 'Auto (OIDC)'}</span>
                  <button
                    onClick={() => { setUseManual(v => !v); setVerifyState('idle'); setVerifyMsg('') }}
                    className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${useManual ? 'bg-violet-500' : 'bg-cyan-600'}`}
                    title="Toggle auto/manual verification"
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${useManual ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              {/* Status banner */}
              <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${verifyCfg.bg}`}>
                {verifyCfg.spin
                  ? <Loader size={15} className={`${verifyCfg.color} flex-shrink-0 mt-0.5 animate-spin`} />
                  : <ShieldCheck size={15} className={`${verifyCfg.color} flex-shrink-0 mt-0.5`} />
                }
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${verifyCfg.color}`}>{verifyCfg.label}</div>
                  {verifyMsg && (
                    <div className="text-xs text-slate-500 mt-0.5 break-all">{verifyMsg}</div>
                  )}
                  {!useManual && !issuer && hasToken && !decoded.error && (
                    <div className="text-xs text-slate-600 mt-0.5">
                      Add an <span className="font-mono text-slate-500">iss</span> claim to enable auto-discovery
                    </div>
                  )}
                </div>
              </div>

              {/* Manual key input */}
              {useManual && (
                <div className="space-y-3">
                  <label className="text-xs text-slate-500 block">
                    Secret · PEM Public Key · JWK JSON
                  </label>
                  <textarea
                    value={manualKey}
                    onChange={(e) => setManualKey(e.target.value)}
                    placeholder={'your-hmac-secret\n\nor  -----BEGIN PUBLIC KEY-----\n\nor  {"kty":"RSA",...}'}
                    spellCheck={false}
                    rows={5}
                    className="w-full resize-none bg-slate-900 border border-slate-700 rounded-xl text-slate-200 font-mono text-xs p-3.5 outline-none focus:border-slate-600 placeholder:text-slate-700 transition-colors"
                    style={{ fontFamily: '"JetBrains Mono", monospace' }}
                  />
                  <button
                    onClick={handleManualVerify}
                    disabled={!hasToken || !manualKey.trim() || verifyState === 'verifying'}
                    className="w-full px-4 py-2.5 text-sm rounded-xl font-medium flex items-center justify-center gap-2 transition-colors bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 disabled:text-slate-600 text-white"
                  >
                    {verifyState === 'verifying'
                      ? <><Loader size={14} className="animate-spin" />Verifying…</>
                      : <><ShieldCheck size={14} />Verify Signature</>
                    }
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Right pane */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          <div className="h-10 flex-shrink-0 flex items-center px-6 gap-2.5 border-b border-slate-800 bg-slate-900/40">
            <ShieldCheck size={14} className="text-slate-500" />
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Decoded &amp; Audit</span>
          </div>

          {!hasToken ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-slate-700 space-y-3">
                <ShieldCheck size={44} className="mx-auto opacity-20" />
                <p className="text-sm">Paste a JWT on the left to decode and audit</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 space-y-4">

              <JsonPanel title="Header" data={decoded.header} />
              <JsonPanel title="Payload" data={decoded.payload} />

              {audit.length > 0 && (
                <div className="border border-slate-700/60 rounded-xl overflow-hidden">
                  <div className="h-9 px-4 flex items-center gap-3 bg-slate-800/70 border-b border-slate-700/60">
                    <span className="text-[11px] font-semibold text-slate-400 font-mono uppercase tracking-widest">Security Audit</span>
                    <span className="ml-auto text-xs text-slate-600">
                      {audit.length} finding{audit.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="divide-y divide-slate-800/40">
                    {audit.map((f, i) => {
                      const cfg = SEVERITY[f.level]
                      const Icon = cfg.icon
                      return (
                        <div key={i} className="px-4 py-3.5 flex items-start gap-3 hover:bg-slate-800/20 transition-colors">
                          <Icon size={15} className={`${cfg.color} mt-0.5 flex-shrink-0`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-slate-200">{f.title}</span>
                              <span
                                className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border ${cfg.color}`}
                                style={{ borderColor: 'currentColor' }}
                              >
                                {cfg.label}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{f.detail}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

      </main>
    </div>
  )
}
