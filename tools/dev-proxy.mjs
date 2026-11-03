import { config } from 'dotenv';
config({ quiet: true });

export default function devProxy(localPort, frontendOriginName, localOriginName) {
  const target = process.env.API_ORIGIN || 'http://localhost:3333';
  const api = new URL(target);
  if (api.origin !== target || !['http:', 'https:'].includes(api.protocol)) {
    throw new Error('API_ORIGIN must be an HTTP(S) origin without a path.');
  }
  const defaultFrontendOrigin =
    frontendOriginName === 'VERCEL_WEB_ORIGIN'
      ? 'https://mirhal-web.vercel.app'
      : frontendOriginName === 'VERCEL_ADMIN_ORIGIN'
        ? 'https://mirhal-admin.vercel.app'
        : undefined;
  const frontendOrigin =
    api.protocol === 'https:'
      ? process.env[frontendOriginName] || defaultFrontendOrigin
      : (process.env[localOriginName] ?? `http://localhost:${localPort}`);
  return {
    '/api': {
      target,
      changeOrigin: true,
      configure(proxy) {
        proxy.on('proxyReq', (request, original) => {
          // The browser can reach the dev server by localhost or a LAN IP. The
          // API still validates the configured local origin (or deployed web
          // origin when proxying to HTTPS), so normalize only this dev port.
          const origin = original.headers.origin;
          if (frontendOrigin && origin && api.protocol === 'https:') {
            try {
              const parsedOrigin = new URL(origin);
              if (
                parsedOrigin.protocol === 'http:' &&
                Number(parsedOrigin.port || 80) === localPort
              )
                request.setHeader('Origin', frontendOrigin);
            } catch {
              // Invalid Origin headers are left for the API to reject.
            }
          }
        });
      },
    },
  };
}
