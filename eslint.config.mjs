import { defineConfig } from 'eslint/config';
import { configs, plugins } from 'eslint-config-airbnb-extended';
import globals from 'globals';

export default defineConfig([
  {
    ignores: [
      'build/**',
      'dist/**',
      'node_modules/**',
      '.venv/**',
      'public/pyodide/**',
      'src/hoa_visualizer_utils/**',
      'test-results/**'
    ]
  },
  plugins.stylistic,
  plugins.importX,
  plugins.react,
  plugins.reactA11y,
  plugins.reactHooks,
  plugins.typescriptEslint,
  ...configs.react.all,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['e2e/*.ts']
        },
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser
      }
    }
  },
  {
    files: ['src/workers/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.worker
      }
    }
  },
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.vitest
      }
    }
  },
  {
    files: ['*.config.ts', 'eslint.config.mjs', 'e2e/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react/jsx-curly-newline': 'off',
      'react/jsx-no-bind': 'off',
      'react/jsx-one-expression-per-line': 'off',
      'react/jsx-wrap-multilines': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/require-default-props': 'off',
      'react/prop-types': 'off'
    }
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      'jsx-a11y/label-has-associated-control': 'off'
    }
  }
]);
