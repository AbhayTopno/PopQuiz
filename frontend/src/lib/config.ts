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

export const getApiUrl = () => {
  // Server-side: use internal API URL for container-to-container communication
  if (typeof window === 'undefined') {
    return (
      process.env.INTERNAL_API_URL ||
      process.env.API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:5000'
    );
  }
  // Client-side: fetch from runtime config
  return window.__ENV__?.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
};

export const getSocketUrl = () => {
  // Server-side: use env var
  if (typeof window === 'undefined') {
    return process.env.SOCKET_URL || process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';
  }
  // Client-side: fetch from runtime config
  return (
    window.__ENV__?.SOCKET_URL || process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000'
  );
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
