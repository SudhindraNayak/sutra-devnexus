export function validateJson(text) {
  if (!text || !text.trim()) return { valid: true, error: null };
  try {
    JSON.parse(text);
    return { valid: true, error: null };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

export function isValidUrl(url) {
  if (!url || !url.trim()) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return url.startsWith('http://') || url.startsWith('https://') || url.includes('localhost');
  }
}
