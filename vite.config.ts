import { copyFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin, type ResolvedConfig } from 'vite';

const pyodideReadmePath = '/pyodide/README.md';
const githubPagesBasePath = '/higher-order-aberration-visualizer/';

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

export function pagesSpaFallbackPlugin(): Plugin {
  let resolvedConfig: ResolvedConfig | undefined;

  return {
    name: 'pages-spa-fallback',
    configResolved(config) {
      resolvedConfig = config;
    },
    async closeBundle() {
      if (resolvedConfig === undefined || resolvedConfig.base === '/') {
        return;
      }

      const outputDirectory = resolve(resolvedConfig.root, resolvedConfig.build.outDir);
      await copyFile(resolve(outputDirectory, 'index.html'), resolve(outputDirectory, '404.html'));
    }
  };
}

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? githubPagesBasePath : '/',
  plugins: [excludePyodideReadmePlugin(), pagesSpaFallbackPlugin(), react(), tailwindcss()],
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
