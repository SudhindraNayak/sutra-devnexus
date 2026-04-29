export function interpolate(text, variables = {}) {
  if (!text) return text;
  return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmed = key.trim();
    return trimmed in variables ? variables[trimmed] : match;
  });
}

export function interpolateHeaders(headers = [], variables = {}) {
  return headers.map((h) => ({
    ...h,
    key: interpolate(h.key, variables),
    value: interpolate(h.value, variables),
  }));
}

export function interpolateBody(body, variables = {}) {
  if (!body) return body;
  if (body.type === 'json' || body.type === 'raw') {
    return { ...body, content: interpolate(body.content, variables) };
  }
  if (body.type === 'form') {
    return {
      ...body,
      fields: body.fields.map((f) => ({
        ...f,
        key: interpolate(f.key, variables),
        value: interpolate(f.value, variables),
      })),
    };
  }
  return body;
}
