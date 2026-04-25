import { useState, useCallback, useRef, useEffect } from 'react'
import JSON5 from 'json5'
import yaml from 'js-yaml'
import { flatten } from 'flat'
import { XMLBuilder } from 'fast-xml-parser'
import Papa from 'papaparse'
import { JSONPath } from 'jsonpath-plus'

const INDENT_MAP = { '2': 2, '4': 4, tab: '\t' }

function extractErrorLine(message) {
  const lineMatch = message.match(/at line (\d+)/i)
  if (lineMatch) return parseInt(lineMatch[1], 10)
  return null
}

function positionToLine(json, position) {
  return json.slice(0, position).split('\n').length
}

function deepSortKeys(value) {
  if (Array.isArray(value)) return value.map(deepSortKeys)
  if (value !== null && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => { acc[key] = deepSortKeys(value[key]); return acc }, {})
  }
  return value
}

/**
 * Core transform pipeline:
 *   parse (JSON5) → JSONPath filter → flatten → sort keys → serialize
 */
function transform(raw, indent, doFlatten, exportFormat, sortKeys, minify, query) {
  if (!raw.trim()) return { output: '', error: null }

  try {
    let parsed = JSON5.parse(raw)

    // 1. JSONPath filter
    if (query.trim()) {
      const results = JSONPath({ path: query.trim(), json: parsed })
      if (!results.length) throw new Error(`JSONPath: no matches for "${query.trim()}"`)
      parsed = results.length === 1 ? results[0] : results
    }

    // 2. Flatten
    if (doFlatten) {
      parsed = flatten(parsed, { delimiter: '.', safe: true })
    }

    // 3. Sort keys
    if (sortKeys) {
      parsed = deepSortKeys(parsed)
    }

    // 4. Serialize
    const indentNum = indent === 'tab' ? 2 : parseInt(indent, 10)
    const indentStr = indent === 'tab' ? '\t' : ' '.repeat(indentNum)
    let output

    switch (exportFormat) {
      case 'yaml':
        output = minify
          ? yaml.dump(parsed, { flowLevel: 0, lineWidth: -1, noRefs: true })
          : yaml.dump(parsed, { indent: indentNum, lineWidth: -1, noRefs: true })
        break

      case 'xml': {
        const builder = new XMLBuilder({
          format: !minify,
          indentBy: minify ? '' : indentStr,
          ignoreAttributes: false,
          suppressEmptyNode: true,
        })
        const xmlData = Array.isArray(parsed)
          ? { root: { item: parsed } }
          : { root: parsed }
        output = `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(xmlData)}`
        break
      }

      case 'csv': {
        let rows
        if (Array.isArray(parsed)) {
          rows = parsed.map((item) =>
            typeof item === 'object' && item !== null
              ? flatten(item, { delimiter: '.', safe: true })
              : { value: item }
          )
        } else if (typeof parsed === 'object' && parsed !== null) {
          rows = [flatten(parsed, { delimiter: '.', safe: true })]
        } else {
          rows = [{ value: parsed }]
        }
        output = Papa.unparse(rows)
        break
      }

      default: // json
        output = minify
          ? JSON.stringify(parsed)
          : JSON.stringify(parsed, null, INDENT_MAP[indent])
    }

    return { output, error: null }
  } catch (e) {
    let line = extractErrorLine(e.message)
    if (!line) {
      const posMatch = e.message.match(/at position (\d+)/i)
      if (posMatch) line = positionToLine(raw, parseInt(posMatch[1], 10))
    }
    return { output: '', error: { message: e.message, line: line || null } }
  }
}

/** Format a raw string to pretty JSON for the diff editor. Falls back to raw on parse error. */
export function formatForDiff(raw) {
  if (!raw.trim()) return ''
  try { return JSON.stringify(JSON5.parse(raw), null, 2) }
  catch { return raw }
}

export function useJsonFormatter() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [indent, setIndent] = useState('2')
  const [doFlatten, setDoFlatten] = useState(false)
  const [exportFormat, setExportFormat] = useState('json') // 'json' | 'yaml' | 'xml' | 'csv'
  const [sortKeys, setSortKeys] = useState(false)
  const [minify, setMinify] = useState(false)
  const [query, setQuery] = useState('')      // JSONPath expression
  const [diffMode, setDiffMode] = useState(false)
  const [diffInput, setDiffInput] = useState('')
  const [error, setError] = useState(null)
  const [autoFormat, setAutoFormat] = useState(true)
  const [copied, setCopied] = useState(false)
  const debounceRef = useRef(null)

  const applyTransform = useCallback((raw, ind, flat, fmt, sort, mini, q) => {
    const { output: out, error: err } = transform(raw, ind, flat, fmt, sort, mini, q)
    setOutput(out)
    setError(err)
  }, [])

  // Re-run when any option other than input changes
  useEffect(() => {
    if (input.trim()) applyTransform(input, indent, doFlatten, exportFormat, sortKeys, minify, query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indent, doFlatten, exportFormat, sortKeys, minify, query])

  const handleInputChange = useCallback(
    (value) => {
      const raw = value ?? ''
      setInput(raw)
      if (!autoFormat) return
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        applyTransform(raw, indent, doFlatten, exportFormat, sortKeys, minify, query)
      }, 300)
    },
    [autoFormat, applyTransform, indent, doFlatten, exportFormat, sortKeys, minify, query]
  )

  const handleManualFormat = useCallback(() => {
    applyTransform(input, indent, doFlatten, exportFormat, sortKeys, minify, query)
  }, [applyTransform, input, indent, doFlatten, exportFormat, sortKeys, minify, query])

  const handleClear = useCallback(() => {
    clearTimeout(debounceRef.current)
    setInput('')
    setOutput('')
    setError(null)
    setQuery('')
    setDiffInput('')
  }, [])

  const handleCopy = useCallback(async () => {
    if (!output) return
    try {
      await navigator.clipboard.writeText(output)
    } catch {
      const el = Object.assign(document.createElement('textarea'), { value: output })
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [output])

  return {
    input, output, indent, doFlatten, exportFormat,
    sortKeys, minify, query, diffMode, diffInput,
    error, autoFormat, copied,
    setIndent, setDoFlatten, setExportFormat,
    setSortKeys, setMinify, setQuery,
    setDiffMode, setDiffInput, setAutoFormat,
    handleInputChange, handleManualFormat, handleClear, handleCopy,
  }
}
