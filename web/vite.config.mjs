import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
function productRoutes(server) {
  server.middlewares.use((req, _res, next) => {
    if (
      /^\/(demo|shop|start|docs(?:\/[^/?]+)?|merchant|checkout\/[^/?]+)(?:\?.*)?$/.test(
        req.url ?? '',
      )
    )
      req.url = '/product.html';
    next();
  });
}
export default defineConfig({
  plugins: [
    {
      name: 'product-route-entry',
      configureServer: productRoutes,
      configurePreviewServer: productRoutes,
    },
  ],
  root: fileURLToPath(new URL('.', import.meta.url)),
  server: {
    host: '127.0.0.1',
    port: 4210,
    strictPort: true,
    fs: { deny: ['**/.local/**', '**/.git/**', '**/.env*', '**/*.{pem,crt}'] },
    proxy: {
      '/v1': 'http://127.0.0.1:4200',
      '/shop-api': {
        target: 'http://127.0.0.1:4301',
        rewrite: (path) => path.replace(/^\/shop-api/, ''),
      },
    },
  },
  preview: { host: '127.0.0.1', port: 4210, strictPort: true },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rolldownOptions: {
      input: {
        landing: fileURLToPath(new URL('./index.html', import.meta.url)),
        product: fileURLToPath(new URL('./product.html', import.meta.url)),
      },
    },
  },
});
