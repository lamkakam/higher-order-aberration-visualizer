# Development

Common commands are defined in [`package.json`](../package.json).

## Frontend Commands

Install dependencies:

```sh
npm install
```

Run the Vite dev server:

```sh
npm run dev
```

Build the production bundle:

```sh
npm run build
```

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

Run Vitest in watch mode:

```sh
npm run test:watch
```

Run Playwright tests:

```sh
npm run e2e
```

Playwright configuration is in [`playwright.config.ts`](../playwright.config.ts), and end-to-end tests live in [`e2e/`](../e2e).

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
