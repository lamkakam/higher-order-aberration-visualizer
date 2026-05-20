import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin, type ResolvedConfig } from 'vite';

const pyodideReadmePath = '/pyodide/README.md';

export function excludePyodideReadmePlugin(): Plugin {
  let resolvedConfig: ResolvedConfig | undefined;

  return {
    name: 'exclude-pyodide-readme',
    configResolved(config) {
      resolvedConfig = config;
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;

        if (pathname !== pyodideReadmePath) {
          next();
          return;
        }

        response.statusCode = 404;
        response.end();
      });
    },
    async closeBundle() {
      if (resolvedConfig === undefined) {
        return;
      }

      await rm(resolve(resolvedConfig.root, resolvedConfig.build.outDir, 'pyodide/README.md'), {
        force: true
      });
    }
  };
}

export default defineConfig({
  plugins: [excludePyodideReadmePlugin(), react(), tailwindcss()],
  worker: {
    format: 'es'
  },
  test: {
    environment: 'jsdom',
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    globals: true,
    setupFiles: './src/test/setup.ts'
  }
});
