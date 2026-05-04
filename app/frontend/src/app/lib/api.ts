function isLocalHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '::1';
}

function normalizeConfiguredApiBase(rawValue: string) {
  const trimmed = rawValue.trim().replace(/\/+$/, '');
  if (!trimmed) {
    return null;
  }

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      return new URL(trimmed).toString().replace(/\/$/, '');
    }

    const withProtocol = isLocalHost(trimmed.split(':')[0]) ? `http://${trimmed}` : `https://${trimmed}`;
    return new URL(withProtocol).toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function getApiBaseUrl() {
  // Always use relative paths so requests are handled by the same origin (Vite proxy locally, Vercel Serverless in production)
  return '';
}

export function buildApiUrl(path: string) {
  const base = getApiBaseUrl();
  if (base === null) {
    return null;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
