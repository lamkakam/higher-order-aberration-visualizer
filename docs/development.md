# Development

Common commands are defined in [`package.json`](../package.json).

## Frontend Commands

Install dependencies:

```sh
npm ci
```

Run the Vite dev server:

```sh
npm run dev
```

`npm run dev` first builds the internal Python wheel into `public/pyodide` through the `predev` npm lifecycle hook.

Build the production bundle:

```sh
npm run build
```

`npm run build` first builds the internal Python wheel into `public/pyodide` through the `prebuild` npm lifecycle hook.

Preview the production bundle locally:

```sh
npm run preview
```

Run TypeScript type checking:

```sh
npm run typecheck
```

Run Vitest once:

```sh
npm test
```

`npm test` runs Vitest first, then runs the Python test suite.

Run Vitest in watch mode:

```sh
npm run test:watch
```

Run Playwright tests:

```sh
npm run e2e
```

Playwright configuration is in [`playwright.config.ts`](../playwright.config.ts), and end-to-end tests live in [`e2e/`](../e2e).

## CI/CD

GitHub Actions runs the repository quality gates for pull requests to `main`, pushes to `main`, and manual `workflow_dispatch` runs. The workflow runs `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run e2e` with Node.js 22, Python 3.11, npm caching, and Playwright Chromium installed.

Pushes to `main` also deploy the static Vite build in `dist` to GitHub Pages after the checks pass. Pull requests and manual runs run checks only. Markdown-only changes, meaning changes where every file matches `**/*.md`, are ignored by the push and pull request triggers.

Repository Settings → Pages must use `GitHub Actions` as the Pages source. The GitHub Pages build uses `/higher-order-aberration-visualizer/` as the Vite base path and writes `dist/404.html` from `dist/index.html` so direct visits to client routes such as `/higher-order-aberration-visualizer/en/basic` load the app shell.

## Translations

The app uses [`src/i18n.ts`](../src/i18n.ts) for client-side i18next setup. Locale files live under `public/locales/<language>/translation.json`, including [`public/locales/en/translation.json`](../public/locales/en/translation.json), [`public/locales/zh-Hant/translation.json`](../public/locales/zh-Hant/translation.json), and [`public/locales/zh-Hans/translation.json`](../public/locales/zh-Hans/translation.json), and are loaded lazily in the browser from the current Vite base path plus `/locales/{{lng}}/{{ns}}.json`. The header language selector shows concrete supported languages only; first-load browser locale matching is handled in code rather than by a visible browser-default option.

[`public/sw.js`](../public/sw.js) registers in both local development and production, and cache-first serves the supported translation JSON files from a versioned service worker cache. When translation files change for a release, bump the service worker `CACHE_VERSION`. During local development, edited translation JSON can remain cached until the service worker cache version changes, Cache Storage is cleared, or the service worker is unregistered.

Supported languages are English (`en`), Traditional Chinese (`zh-Hant`, labelled `繁體中文`), and Simplified Chinese (`zh-Hans`, labelled `简体中文`). The resolver maps `en-*` locales to English; maps `zh-Hant`, `zh-TW`, `zh-HK`, and `zh-MO` to Traditional Chinese; and maps `zh-Hans`, `zh-CN`, `zh-SG`, and generic `zh` to Simplified Chinese.

Language and display mode are also represented in the client URL as `/:lang/:mode`, for example `/en/basic` or `/zh-Hans/advanced` in local development. Production client routes include the GitHub Pages base path, for example `/higher-order-aberration-visualizer/en/basic`. Tests that depend on a specific language or display mode should render the app at the matching route instead of changing i18next directly.

To add a future language, add a matching `public/locales/<language>/translation.json`, add the language code to `supportedLngs` in `src/i18n.ts`, and expose it through `language.options.<language>` in each locale file. Keep translation keys stable and update React/Vitest and Playwright coverage when user-visible labels or accessible names change.

## Python Commands

Run the Python test suite:

```sh
scripts/test-python.sh
```

The script creates `.venv` if needed, installs the package in editable mode, and runs `pytest` against [`src/hoa_visualizer_utils/tests/python`](../src/hoa_visualizer_utils/tests/python). Python package metadata is in [`pyproject.toml`](../pyproject.toml).

Build the internal Python wheel into `public/pyodide`:

```sh
scripts/build-pyodide-wheel.sh
```

This is for the app's own `hoa_visualizer_utils` wheel. The committed `prysm` wheel is documented separately in [`public/pyodide/README.md`](../public/pyodide/README.md).

## Test Layout

- React unit tests: [`src/components/ApplicationShell/test/ApplicationShell.test.tsx`](../src/components/ApplicationShell/test/ApplicationShell.test.tsx) and colocated `*.test.ts` files
- Worker unit tests: [`src/workers/test/optics.worker.test.ts`](../src/workers/test/optics.worker.test.ts)
- Shared test setup and mocks: [`src/test`](../src/test)
- Browser tests: [`e2e`](../e2e)
- Python tests: [`src/hoa_visualizer_utils/tests/python`](../src/hoa_visualizer_utils/tests/python)
