import { networkInterfaces } from 'node:os';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const API_PROXY = { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true } };

function lanAddresses(): string[] {
  const addresses = Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter((entry) => entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address);
  const isPrivate = (ip: string) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
  const privateAddresses = addresses.filter(isPrivate);
  return privateAddresses.length > 0 ? privateAddresses : addresses;
}

function printPhoneUrl(): Plugin {
  return {
    name: 'print-phone-url',
    apply: 'serve',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const address = server.httpServer?.address();
        const port = typeof address === 'object' && address ? address.port : 5173;
        // Wait so this lands after Vite's own startup banner.
        setTimeout(() => {
          const urls = lanAddresses().map((ip) => `    https://${ip}:${port}/`);
          console.log(
            ['', '  🎸 Open this on your phone (same Wi-Fi):', ...urls, ''].join('\n'),
          );
        }, 200);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), basicSsl(), printPhoneUrl()],
  server: { host: true, port: 5173, strictPort: true, proxy: API_PROXY },
  preview: { host: true, port: 5173, strictPort: true, proxy: API_PROXY },
});
