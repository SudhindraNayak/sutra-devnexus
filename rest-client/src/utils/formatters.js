export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatTime(ms) {
  if (!ms && ms !== 0) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function formatJson(text) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export function detectLanguage(headers = {}) {
  const ctEntry = Object.entries(headers).find(
    ([k]) => k.toLowerCase() === 'content-type'
  );
  if (!ctEntry) return 'text';
  const val = ctEntry[1].toLowerCase();
  if (val.includes('json')) return 'json';
  if (val.includes('xml')) return 'xml';
  if (val.includes('html')) return 'html';
  if (val.includes('javascript')) return 'javascript';
  return 'text';
}

export function getStatusClass(status) {
  if (!status) return 'unknown';
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'redirect';
  if (status >= 400 && status < 500) return 'client-error';
  if (status >= 500) return 'server-error';
  return 'unknown';
}

export function formatTimestamp(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
