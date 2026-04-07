export function normalizeVsphereLookupValue(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }
  return normalized;
}

export function buildVsphereCacheKey({
  hostname,
  ip,
}: {
  hostname?: string | null;
  ip?: string | null;
}): string | null {
  const normalizedHostname = normalizeVsphereLookupValue(hostname);
  const normalizedIp = normalizeVsphereLookupValue(ip);

  if (normalizedHostname && normalizedIp) {
    return `${normalizedHostname}:${normalizedIp}`;
  }

  return normalizedHostname ?? normalizedIp;
}

export function matchesVsphereCacheKey(
  cacheKey: string | null | undefined,
  {
    hostname,
    ip,
  }: {
    hostname?: string | null;
    ip?: string | null;
  },
): boolean {
  if (!cacheKey) {
    return false;
  }

  const normalizedHostname = normalizeVsphereLookupValue(hostname);
  const normalizedIp = normalizeVsphereLookupValue(ip);
  const canonicalKey = buildVsphereCacheKey({
    hostname: normalizedHostname,
    ip: normalizedIp,
  });

  if (!canonicalKey) {
    return false;
  }

  if (cacheKey === canonicalKey) {
    return true;
  }

  const legacyKeys = new Set<string>();

  if (normalizedHostname && normalizedIp) {
    legacyKeys.add(`${normalizedHostname}-${normalizedIp}`);
  }

  if (normalizedHostname) {
    legacyKeys.add(`${normalizedHostname}-null`);
    legacyKeys.add(`${normalizedHostname}-undefined`);
  }

  if (normalizedIp) {
    legacyKeys.add(`${normalizedIp}-null`);
    legacyKeys.add(`${normalizedIp}-undefined`);
  }

  return legacyKeys.has(cacheKey);
}
