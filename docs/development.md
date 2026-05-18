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

## Translations

The app uses [`src/i18n.ts`](../src/i18n.ts) for client-side i18next setup. Locale files live under [`public/locales/<language>/translation.json`](../public/locales/en/translation.json) and are loaded lazily in the browser from `/locales/{{lng}}/{{ns}}.json`. The header language selector shows concrete supported languages only; first-load browser locale matching is handled in code rather than by a visible browser-default option.

To add a future language, add a matching `public/locales/<language>/translation.json`, add the language code to `supportedLngs` in `src/i18n.ts`, and expose it in the header language selector. Keep translation keys stable and update React/Vitest and Playwright coverage when user-visible labels or accessible names change.

## Python Commands

Run the Python test suite:

```sh
scripts/test-python.sh
```

The script creates `.venv` if needed, installs the package in editable mode, and runs `pytest` against [`tests/python`](../tests/python). Python package metadata is in [`pyproject.toml`](../pyproject.toml).

Build the internal Python wheel into `public/pyodide`:

```sh
scripts/build-pyodide-wheel.sh
```

This is for the app's own `hoa_visualizer_utils` wheel. The committed `prysm` wheel is documented separately in [`public/pyodide/README.md`](../public/pyodide/README.md).

## Test Layout

- React unit tests: [`src/App.test.tsx`](../src/App.test.tsx) and colocated `*.test.ts` files
- Worker unit tests: [`src/workers/optics.worker.test.ts`](../src/workers/optics.worker.test.ts)
- Shared test setup and mocks: [`src/test`](../src/test)
- Browser tests: [`e2e`](../e2e)
- Python tests: [`tests/python`](../tests/python)
