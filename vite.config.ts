import { copyFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Plugin, ResolvedConfig } from 'vite';
import { defineConfig } from 'vitest/config';
import deploymentPaths from './scripts/deployment-paths.json' with { type: 'json' };

const pyodideReadmePath = '/pyodide/README.md';
const { staticDeploymentBasePath } = deploymentPaths;
const crossOriginPolicyHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Permissions-Policy': 'tools=(self)'
};

export function resolveViteBase(staticSubpathDeployment: string | undefined) {
  return staticSubpathDeployment === 'true' ? staticDeploymentBasePath : '/';
}

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
  base: resolveViteBase(process.env.STATIC_SUBPATH_DEPLOYMENT),
  plugins: [excludePyodideReadmePlugin(), pagesSpaFallbackPlugin(), react(), tailwindcss()],
  server: {
    headers: crossOriginPolicyHeaders
  },
  preview: {
    headers: crossOriginPolicyHeaders
  },
  worker: {
    format: 'es'
  },
  test: {
    environment: 'jsdom',
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    globals: true,
    setupFiles: './src/test/setup.ts',
    testTimeout: 30_000
  }
});
