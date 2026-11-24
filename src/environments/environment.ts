declare global {
  // Supplied by assets/runtime-config.js in the browser. SSR uses API_URL.
  var __FLOCKWISE_CONFIG__: { apiUrl?: string } | undefined;
}

declare const process: { env?: Record<string, string | undefined> } | undefined;

const browserApiUrl = globalThis.__FLOCKWISE_CONFIG__?.apiUrl;
const serverApiUrl = typeof process !== 'undefined' ? process.env?.['API_URL'] : undefined;
const defaultApiUrl = typeof window === 'undefined'
  ? 'http://127.0.0.1:1111/api'
  : '/api';

export const environment = {
  apiUrl: browserApiUrl?.trim() || serverApiUrl?.trim() || defaultApiUrl
};
