import { useRef, useEffect, useCallback, useState } from 'react'
import Editor, { DiffEditor } from '@monaco-editor/react'
import {
  Copy, Check, Trash2, Wand2, AlertCircle, ChevronDown,
  FileJson, Layers, FileText, Code2, Table2,
  ArrowUpDown, Minimize2, GitCompare, Filter, X,
} from 'lucide-react'
import { useJsonFormatter, formatForDiff } from './hooks/useJsonFormatter'

// ─── Constants ───────────────────────────────────────────────────────────────

const MONACO_OPTIONS_BASE = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  fontSize: 13,
  lineHeight: 20,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  wordWrap: 'on',
  renderLineHighlight: 'gutter',
  smoothScrolling: true,
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on',
  padding: { top: 12, bottom: 12, left: 8, right: 8 },
  scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6, useShadows: false },
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  renderWhitespace: 'none',
  guides: { indentation: true },
  bracketPairColorization: { enabled: true },
  lineNumbersMinChars: 3,
}

const INDENT_OPTIONS = [
  { value: '2',  label: '2 Spaces' },
  { value: '4',  label: '4 Spaces' },
  { value: 'tab', label: 'Tabs' },
]

const FORMAT_OPTIONS = [
  { value: 'json', label: 'JSON', Icon: FileJson, iconClass: 'text-yellow-400' },
  { value: 'yaml', label: 'YAML', Icon: FileText, iconClass: 'text-sky-400'    },
  { value: 'xml',  label: 'XML',  Icon: Code2,    iconClass: 'text-orange-400' },
  { value: 'csv',  label: 'CSV',  Icon: Table2,   iconClass: 'text-emerald-400'},
]

const MONACO_LANGUAGE = { json: 'json', yaml: 'yaml', xml: 'xml', csv: 'plaintext' }

const SAMPLE_JSON = `{
  "tool": "JSON Formatter",
  "version": "1.0.0",
  "features": [
    "Syntax highlighting",
    "Error detection with line number",
    "Auto format on type",
    "Copy to clipboard",
    "Tab / 2 / 4 space indentation"
  ],
  "author": {
    "name": "DevNexus",
    "privacy": "Client-side only — zero backend calls"
  },
  "stats": {
    "stars": 1024,
    "forks": 256,
    "active": true
  }
}`

// ─── Shared button class helper ───────────────────────────────────────────────

function toolBtn(active, activeClass = 'bg-violet-600/15 border-violet-500/35 text-violet-300 hover:bg-violet-600/25') {
  return `flex items-center gap-2 px-3.5 py-2 rounded-md text-sm font-medium border
    transition-all cursor-pointer select-none ${
      active
        ? activeClass
        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
    }`
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const inputEditorRef  = useRef(null)
  const monacoRef       = useRef(null)
  const decorationsRef  = useRef([])
  const queryInputRef   = useRef(null)

  // UI-only state
  const [showQueryBar, setShowQueryBar] = useState(false)

  const {
    input, output, indent, doFlatten, exportFormat,
    sortKeys, minify, query, diffMode, diffInput,
    error, autoFormat, copied,
    setIndent, setDoFlatten, setExportFormat,
    setSortKeys, setMinify, setQuery,
    setDiffMode, setDiffInput, setAutoFormat,
    handleInputChange, handleManualFormat, handleClear, handleCopy,
  } = useJsonFormatter()

  // Auto-focus query bar input when it opens
  useEffect(() => {
    if (showQueryBar) queryInputRef.current?.focus()
  }, [showQueryBar])

  // Error line decoration on input editor
  useEffect(() => {
    const editor = inputEditorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco) return
    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      error?.line
        ? [{
            range: new monaco.Range(error.line, 1, error.line, 9999),
            options: {
              isWholeLine: true,
              className: 'error-line-highlight',
              linesDecorationsClassName: 'error-line-decoration',
              overviewRuler: { color: '#ef4444', position: monaco.editor.OverviewRulerLane.Full },
            },
          }]
        : []
    )
  }, [error])

  const handleEditorMount = useCallback((editor, monaco) => {
    inputEditorRef.current = editor
    monacoRef.current = monaco
    if (!document.getElementById('monaco-error-styles')) {
      const style = document.createElement('style')
      style.id = 'monaco-error-styles'
      style.textContent = `
        .error-line-highlight { background: rgba(239,68,68,0.10) !important; }
        .error-line-decoration { background: #ef4444; width: 3px !important; margin-left: 4px; border-radius: 2px; }
      `
      document.head.appendChild(style)
    }
  }, [])

  // Sync edits from DiffEditor's modified pane back to state
  const handleDiffEditorMount = useCallback((editor) => {
    editor.getModifiedEditor().onDidChangeModelContent(() => {
      setDiffInput(editor.getModifiedEditor().getValue())
    })
  }, [setDiffInput])

  const loadSample = useCallback(() => handleInputChange(SAMPLE_JSON), [handleInputChange])

  const toggleQueryBar = useCallback(() => {
    setShowQueryBar((p) => {
      if (p) setQuery('')   // clear query when closing
      return !p
    })
  }, [setQuery])

  // Build output badge text
  const outputBadge = output
    ? [
        exportFormat.toUpperCase(),
        doFlatten  && 'flat',
        sortKeys   && 'sorted',
        minify     && 'minified',
        query.trim() && 'filtered',
      ].filter(Boolean).join(' · ')
    : null

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden select-none">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="flex-none border-b border-slate-800/80 bg-slate-900">
        <div className="flex items-center justify-between px-6 h-[72px] gap-4">

          {/* Brand */}
          <div className="flex items-center gap-3 flex-none">
            {/* Logo — show the central emblem portion of the image */}
            <div className="w-10 h-10 rounded-xl overflow-hidden flex-none border border-cyan-500/20 shadow-lg shadow-cyan-500/10">
              <img
                src="/logo.png"
                alt="DevNexus"
                className="w-full h-full object-cover"
                style={{ objectPosition: '50% 38%' }}
              />
            </div>
            <div className="leading-tight">
              <p className="font-bold text-sm tracking-tight">
                <span className="text-cyan-400">DevNexus</span>
                <span className="text-slate-500 font-normal mx-1.5">&nbsp;—&nbsp;</span>
                <span className="text-slate-200">JSON Formatter</span>
              </p>
              <p className="text-[10px] text-slate-500 hidden sm:block mt-0.5">
                Client-side · No data leaves your browser
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2.5 flex-wrap justify-end">

            {/* Indent */}
            <div className={`relative hidden sm:block transition-opacity ${minify && exportFormat === 'json' ? 'opacity-40 pointer-events-none' : ''}`}>
              <select
                value={indent}
                onChange={(e) => setIndent(e.target.value)}
                className="appearance-none pl-3.5 pr-8 py-2 text-sm font-medium rounded-md
                  bg-slate-800 border border-slate-700 text-slate-300
                  hover:border-slate-600 focus:outline-none focus:border-violet-500/70
                  cursor-pointer transition-colors"
              >
                {INDENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            <span className="hidden sm:block w-px h-7 bg-slate-700/60" />

            {/* ── Transform group: Flatten · Sort · Minify ── */}
            <button
              onClick={() => setDoFlatten((p) => !p)}
              title="Flatten nested keys with dot notation"
              className={toolBtn(doFlatten, 'bg-amber-600/15 border-amber-500/35 text-amber-300 hover:bg-amber-600/25')}
            >
              <Layers size={14} />
              <span className="hidden sm:inline">Flatten</span>
            </button>

            <button
              onClick={() => setSortKeys((p) => !p)}
              title="Sort all object keys alphabetically (recursive)"
              className={toolBtn(sortKeys, 'bg-sky-600/15 border-sky-500/35 text-sky-300 hover:bg-sky-600/25')}
            >
              <ArrowUpDown size={14} />
              <span className="hidden sm:inline">Sort</span>
            </button>

            <button
              onClick={() => setMinify((p) => !p)}
              title="Minify output — strip all whitespace"
              className={toolBtn(minify, 'bg-pink-600/15 border-pink-500/35 text-pink-300 hover:bg-pink-600/25')}
            >
              <Minimize2 size={14} />
              <span className="hidden sm:inline">Minify</span>
            </button>

            <span className="hidden sm:block w-px h-7 bg-slate-700/60" />

            {/* Format picker */}
            <FormatPicker value={exportFormat} onChange={setExportFormat} />

            <span className="hidden sm:block w-px h-7 bg-slate-700/60" />

            {/* ── Mode group: Filter · Diff ── */}
            <button
              onClick={toggleQueryBar}
              title="JSONPath filter — query the parsed output"
              className={toolBtn(showQueryBar, 'bg-violet-600/15 border-violet-500/35 text-violet-300 hover:bg-violet-600/25')}
            >
              <Filter size={14} />
              <span className="hidden sm:inline">Filter</span>
            </button>

            <button
              onClick={() => setDiffMode((p) => !p)}
              title="Diff mode — compare two JSON documents"
              className={toolBtn(diffMode, 'bg-teal-600/15 border-teal-500/35 text-teal-300 hover:bg-teal-600/25')}
            >
              <GitCompare size={14} />
              <span className="hidden sm:inline">Diff</span>
            </button>

            <span className="hidden sm:block w-px h-7 bg-slate-700/60" />

            {/* Auto-format */}
            <button
              onClick={() => setAutoFormat((p) => !p)}
              title={autoFormat ? 'Auto-format ON' : 'Auto-format OFF'}
              className={toolBtn(autoFormat)}
            >
              <Wand2 size={14} />
              <span className="hidden sm:inline">Auto</span>
            </button>

            {!autoFormat && (
              <button
                onClick={handleManualFormat}
                className="flex items-center gap-2 px-3.5 py-2 rounded-md text-sm font-medium
                  bg-violet-600 hover:bg-violet-500 text-white border border-violet-500/70
                  transition-colors cursor-pointer"
              >
                Format
              </button>
            )}

            {/* Sample */}
            <button
              onClick={loadSample}
              className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-md text-sm font-medium
                bg-slate-800 border border-slate-700 text-slate-400
                hover:border-slate-600 hover:text-slate-300 transition-colors cursor-pointer"
            >
              <FileJson size={14} />
              Sample
            </button>

            {/* Clear */}
            <button
              onClick={handleClear}
              title="Clear both panes"
              className="flex items-center gap-2 px-3.5 py-2 rounded-md text-sm font-medium
                bg-slate-800 border border-slate-700 text-slate-400
                hover:border-red-500/40 hover:text-red-400 transition-colors cursor-pointer"
            >
              <Trash2 size={14} />
              <span className="hidden sm:inline">Clear</span>
            </button>

            {/* Copy */}
            <button
              onClick={handleCopy}
              disabled={!output}
              title={`Copy ${exportFormat.toUpperCase()} output`}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-sm font-medium border
                transition-all cursor-pointer ${
                  copied
                    ? 'bg-emerald-600/15 border-emerald-500/35 text-emerald-300'
                    : output
                    ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                    : 'bg-slate-800/40 border-slate-800 text-slate-600 cursor-not-allowed'
                }`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Mobile sub-row */}
        <div className="sm:hidden flex items-center gap-2 px-6 pb-4 flex-wrap">
          <div className="relative">
            <select
              value={indent}
              onChange={(e) => setIndent(e.target.value)}
              className="appearance-none pl-2.5 pr-6 py-1 text-xs rounded-md
                bg-slate-800 border border-slate-700 text-slate-300 focus:outline-none cursor-pointer"
            >
              {INDENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value)}
            className="appearance-none px-2 py-1 text-xs rounded-md
              bg-slate-800 border border-slate-700 text-slate-300 focus:outline-none cursor-pointer"
          >
            {FORMAT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>

          {[
            { label: 'Flat',   active: doFlatten, onClick: () => setDoFlatten(p => !p),   color: 'amber'  },
            { label: 'Sort',   active: sortKeys,  onClick: () => setSortKeys(p => !p),    color: 'sky'    },
            { label: 'Min',    active: minify,    onClick: () => setMinify(p => !p),      color: 'pink'   },
            { label: 'Filter', active: showQueryBar, onClick: toggleQueryBar,             color: 'violet' },
            { label: 'Diff',   active: diffMode,  onClick: () => setDiffMode(p => !p),   color: 'teal'   },
          ].map(({ label, active, onClick, color }) => (
            <button
              key={label}
              onClick={onClick}
              className={`px-3 py-1 rounded-md text-xs border cursor-pointer transition-colors ${
                active
                  ? `bg-${color}-600/15 border-${color}-500/35 text-${color}-300`
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}

          <button
            onClick={loadSample}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs
              bg-slate-800 border border-slate-700 text-slate-400 cursor-pointer"
          >
            <FileJson size={11} />
            Sample
          </button>
        </div>
      </header>

      {/* ── JSONPath Query Bar ────────────────────────────────────────────── */}
      {showQueryBar && (
        <div className="flex-none flex items-center gap-3 px-6 py-3 bg-slate-900/70 border-b border-violet-800/30">
          <span className="font-mono text-xs font-bold text-violet-400 flex-none select-none">$</span>
          <input
            ref={queryInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='$.features[0]   or   $..name   or   $.stats.*'
            spellCheck={false}
            className="flex-1 bg-transparent text-sm font-mono text-slate-200
              placeholder-slate-600 focus:outline-none min-w-0 select-text"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="flex-none text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* ── Editor Area ───────────────────────────────────────────────────── */}
      {diffMode ? (
        /* ── Diff Mode ── */
        <main className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-none flex items-center gap-3 px-6 h-10 border-b border-slate-800/80 bg-slate-900/40">
            <span className="text-[9px] font-bold tracking-[0.15em] text-teal-500 uppercase">Diff</span>
            <span className="text-[11px] text-slate-600 italic">
              Left pane: current input (read-only) — Right pane: paste JSON B to compare
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <DiffEditor
              original={formatForDiff(input)}
              modified={diffInput}
              language="json"
              theme="vs-dark"
              height="100%"
              options={{
                ...MONACO_OPTIONS_BASE,
                renderSideBySide: true,
                readOnly: false,
                renderLineHighlight: 'gutter',
              }}
              onMount={handleDiffEditorMount}
            />
          </div>
        </main>
      ) : (
        /* ── Normal Mode ── */
        <main className="flex flex-1 overflow-hidden flex-col lg:flex-row">
          <EditorPane
            label="INPUT"
            badge={input ? `${input.split('\n').length} lines` : null}
            hint="Paste or type JSON…"
          >
            <Editor
              height="100%"
              defaultLanguage="json"
              value={input}
              onChange={handleInputChange}
              onMount={handleEditorMount}
              theme="vs-dark"
              options={{ ...MONACO_OPTIONS_BASE, readOnly: false }}
            />
          </EditorPane>

          <div className="hidden lg:block w-px bg-slate-800 flex-none" />
          <div className="lg:hidden h-px bg-slate-800 flex-none" />

          <EditorPane
            label="OUTPUT"
            badge={outputBadge}
            badgeVariant="emerald"
            hint="Formatted result appears here…"
          >
            <Editor
              height="100%"
              language={MONACO_LANGUAGE[exportFormat]}
              value={output}
              theme="vs-dark"
              options={{
                ...MONACO_OPTIONS_BASE,
                readOnly: true,
                domReadOnly: true,
                renderLineHighlight: 'none',
                cursorStyle: 'block-outline',
              }}
            />
          </EditorPane>
        </main>
      )}

      {/* ── Error Banner ──────────────────────────────────────────────────── */}
      {error && (
        <div className="flex-none flex items-start gap-3 px-6 py-4 bg-red-950/50 border-t border-red-800/50">
          <AlertCircle size={14} className="mt-0.5 flex-none text-red-400" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-red-400">
              Parse error{error.line ? ` · Line ${error.line}` : ''}
            </p>
            <p className="text-[11px] text-red-300/70 mt-0.5 font-mono leading-relaxed break-all">
              {error.message}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── FormatPicker ─────────────────────────────────────────────────────────────

function FormatPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = FORMAT_OPTIONS.find((f) => f.value === value)

  useEffect(() => {
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [])

  return (
    <div ref={ref} className="relative hidden sm:block">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-md text-sm font-medium
          bg-slate-800 border border-slate-700 text-slate-300
          hover:border-slate-600 hover:text-slate-100 transition-colors cursor-pointer select-none"
      >
        <current.Icon size={14} className={current.iconClass} />
        <span>{current.label}</span>
        <ChevronDown size={13} className={`text-slate-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-44 bg-slate-800 border border-slate-700
          rounded-lg shadow-2xl shadow-black/40 z-50 overflow-hidden py-1">
          {FORMAT_OPTIONS.map(({ value: v, label, Icon, iconClass }) => (
            <button
              key={v}
              onClick={() => { onChange(v); setOpen(false) }}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                v === value
                  ? 'bg-slate-700/80 text-slate-100'
                  : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
              }`}
            >
              <Icon size={14} className={iconClass} />
              <span className="flex-1 text-left">{label}</span>
              {v === value && <Check size={12} className="text-violet-400 flex-none" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── EditorPane ───────────────────────────────────────────────────────────────

function EditorPane({ label, badge, badgeVariant = 'violet', hint, children }) {
  const variants = {
    violet: 'bg-violet-600/15 text-violet-400 border border-violet-500/25',
    emerald: 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/25',
  }
  return (
    <section className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex-none flex items-center gap-2.5 px-6 h-10 border-b border-slate-800/80 bg-slate-900/40">
        <span className="text-[9px] font-bold tracking-[0.15em] text-slate-500 uppercase">{label}</span>
        {badge
          ? <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${variants[badgeVariant]}`}>{badge}</span>
          : <span className="text-[11px] text-slate-600/80 italic font-normal">{hint}</span>
        }
      </div>
      <div className="flex-1 overflow-hidden select-text">{children}</div>
    </section>
  )
}
