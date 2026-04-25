# DevNexus — JSON Formatter

A high-performance, privacy-first JSON Formatter built for developers. Every transformation runs entirely in the browser — no data ever leaves your machine.

---

## Features

### Parsing
- **JSON5 support** — accepts relaxed JSON: unquoted keys, single-quoted strings, trailing commas, comments
- **Auto-format on type** — 300 ms debounce keeps the output in sync as you write
- **Manual format mode** — toggle Auto off and format on demand

### Output Formats
Switch the output format instantly from the toolbar dropdown. Each format has its own syntax-highlighted Monaco editor.

| Format | Notes |
|--------|-------|
| **JSON** | Standard pretty-printed JSON |
| **YAML** | Human-friendly YAML via `js-yaml` |
| **XML** | Wrapped in `<root>` / `<item>` structure via `fast-xml-parser` |
| **CSV** | Objects and arrays of objects via `papaparse`; nested keys flattened automatically |

### Transform Pipeline
Transforms are applied in order: **parse → filter → flatten → sort → serialize**.

| Control | What it does |
|---------|-------------|
| **Indentation** | 2 spaces, 4 spaces, or Tabs |
| **Flatten** | Collapses nested keys to dot-notation (`a.b.c`) using `flat` |
| **Sort Keys** | Recursively sorts all object keys alphabetically |
| **Minify** | Strips all whitespace; YAML switches to inline flow style |

The output pane badge reflects every active transform (e.g. `JSON · flat · sorted · minified`).

### JSONPath Filter
Click **Filter** in the toolbar to open a query bar. Type any [JSONPath](https://goessner.net/articles/JsonPath/) expression powered by `jsonpath-plus`:

```
$.features[0]        → first item in the features array
$..name              → all "name" values anywhere in the tree
$.stats.*            → every value under the stats key
$.items[?(@.active)] → all items where active is truthy
```

Results replace the full output. A single match is unwrapped; multiple matches produce an array. Closing the bar clears the query.

### JSON Diff
Click **Diff** to enter diff mode. The editor area becomes a full Monaco `DiffEditor`:

- **Left pane** (read-only) — auto-formatted version of your current input
- **Right pane** (editable) — paste or type the JSON you want to compare against

Monaco renders inline red/green diff decorations automatically. Switch back to normal mode at any time; both inputs are preserved.

### Error Handling
- Errors caught with a `try/catch` around `JSON5.parse()`
- A red banner at the bottom shows the exact error message
- The offending line in the input editor is highlighted with a red left-border stripe and background tint
- Line number extracted from both V8 (`at line N`) and positional (`at position N`) error formats

### Utility Actions

| Button | Behaviour |
|--------|-----------|
| **Copy** | Copies the full output to clipboard; shows "Copied!" for 2 s |
| **Clear** | Resets both panes, clears the JSONPath query and diff input |
| **Sample** | Loads a demo JSON payload instantly |

---

## Tech Stack

| Layer | Library |
|-------|---------|
| Framework | React 19 + Vite 8 |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| Editors | `@monaco-editor/react` (Monaco Editor) |
| Parsing | `json5` |
| YAML | `js-yaml` |
| XML | `fast-xml-parser` |
| CSV | `papaparse` |
| Flatten | `flat` |
| JSONPath | `jsonpath-plus` |

---

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Production build
npm run build
```

---

## Project Structure

```
src/
├── App.jsx                  # Main UI — header, editor panes, diff mode, error banner
├── hooks/
│   └── useJsonFormatter.js  # All transform logic: parse, filter, flatten, sort, serialize
└── index.css                # Tailwind base + JetBrains Mono font
public/
├── logo.png                 # DevNexus emblem (header logo)
└── favicon.svg              # SVG favicon derived from the emblem
```

---

## Privacy

This tool has **no backend**. All JSON parsing, transformation, and conversion happens locally in your browser using standard Web APIs and bundled libraries. Nothing is sent to any server.
