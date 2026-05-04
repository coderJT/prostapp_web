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
  const configured = normalizeConfiguredApiBase(import.meta.env.VITE_API_BASE_URL || '');
  if (configured) {
    return configured;
  }

  if (typeof window !== 'undefined' && isLocalHost(window.location.hostname)) {
    return '';
  }

  return null;
}

export function buildApiUrl(path: string) {
  const base = getApiBaseUrl();
  if (base === null) {
    return null;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
