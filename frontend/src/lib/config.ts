// Runtime configuration for environment variables
// This allows changing API URLs without rebuilding the Docker image

// Declare global window type extension
declare global {
  interface Window {
    __ENV__?: {
      API_URL?: string;
      SOCKET_URL?: string;
    };
  }
}

const LOCAL_HOST_HINTS = ['localhost', '127.0.0.1', '::1'];

const looksInternalHost = (hostname: string) => {
  const lowered = hostname.toLowerCase();
  return (
    LOCAL_HOST_HINTS.includes(lowered) ||
    lowered.includes('backend') ||
    lowered.endsWith('.internal')
  );
};

const resolveClientUrl = (candidate: string | undefined, fallback: string) => {
  const value = candidate || fallback;

  try {
    const url = new URL(value);

    if (!looksInternalHost(url.hostname)) {
      return url.toString();
    }

    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const path = url.pathname === '/' ? '' : url.pathname;
    const search = url.search ?? '';
    const hash = url.hash ?? '';

    if (protocol === 'https:') {
      return `${window.location.origin}${path}${search}${hash}`;
    }

    const portSuffix = url.port ? `:${url.port}` : '';
    return `${url.protocol}//${hostname}${portSuffix}${path}${search}${hash}`;
  } catch (error) {
    console.error('Failed to resolve client URL, returning fallback', error);
    return value;
  }
};

export const getApiUrl = () => {
  const fallback = 'http://localhost:5000';

  if (typeof window === 'undefined') {
    return (
      process.env.INTERNAL_API_URL ||
      process.env.API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      fallback
    );
  }

  const runtimeValue = window.__ENV__?.API_URL || process.env.NEXT_PUBLIC_API_URL;
  return resolveClientUrl(runtimeValue, fallback);
};

export const getSocketUrl = () => {
  const fallback = 'http://localhost:5000';

  if (typeof window === 'undefined') {
    return process.env.SOCKET_URL || process.env.NEXT_PUBLIC_SOCKET_URL || fallback;
  }

  const runtimeValue = window.__ENV__?.SOCKET_URL || process.env.NEXT_PUBLIC_SOCKET_URL;
  return resolveClientUrl(runtimeValue, fallback);
};

// For debugging
export const getConfig = () => {
  if (typeof window === 'undefined') {
    return {
      apiUrl: process.env.API_URL || process.env.NEXT_PUBLIC_API_URL,
      socketUrl: process.env.SOCKET_URL || process.env.NEXT_PUBLIC_SOCKET_URL,
      env: process.env.NODE_ENV,
      source: 'server',
    };
  }
  return {
    apiUrl: window.__ENV__?.API_URL || process.env.NEXT_PUBLIC_API_URL,
    socketUrl: window.__ENV__?.SOCKET_URL || process.env.NEXT_PUBLIC_SOCKET_URL,
    env: process.env.NODE_ENV,
    source: 'client',
    runtimeConfig: window.__ENV__,
  };
};
