export function normalizeGamePayload(data: unknown): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  const payload = { ...data } as Record<string, unknown>;
  for (const field of ['releaseDate', 'versionUpdateDate']) {
    if (typeof payload[field] === 'string' && !payload[field].trim()) payload[field] = null;
  }
  if (payload.coverHueOverride === '') payload.coverHueOverride = null;
  return payload;
}
