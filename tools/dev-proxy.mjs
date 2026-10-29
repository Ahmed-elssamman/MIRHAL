import { config } from 'dotenv';
config({ quiet: true });

export default function devProxy(localPort, frontendOriginName) {
  const target = process.env.API_ORIGIN || 'http://localhost:3333';
  const api = new URL(target);
  if (api.origin !== target || !['http:', 'https:'].includes(api.protocol)) {
    throw new Error('API_ORIGIN must be an HTTP(S) origin without a path.');
  }
  const frontendOrigin = process.env[frontendOriginName];
  return {
    '/api': {
      target,
      changeOrigin: true,
      configure(proxy) {
        proxy.on('proxyReq', (request, original) => {
          // Production validates Origin; only translate the expected local dev origin.
          if (
            api.protocol === 'https:' &&
            frontendOrigin &&
            original.headers.origin === `http://localhost:${localPort}`
          ) {
            request.setHeader('Origin', frontendOrigin);
          }
        });
      },
    },
  };
};
