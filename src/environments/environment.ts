declare global {
  // Supplied by assets/runtime-config.js so deployments can change the API
  // origin without rebuilding the Angular application.
  var __FLOCKWISE_CONFIG__: { apiUrl?: string } | undefined;
}

const runtimeApiUrl = globalThis.__FLOCKWISE_CONFIG__?.apiUrl;

export const environment = {
  apiUrl: runtimeApiUrl?.trim() || '/api'
};
