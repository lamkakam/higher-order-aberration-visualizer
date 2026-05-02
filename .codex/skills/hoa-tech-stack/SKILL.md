---
name: hoa-tech-stack
description: Use when working on React, TypeScript, Vite, Tailwind, Pyodide, Comlink, ECharts, React Testing Library, Playwright, or prysm in this repo.
---

# HOA Tech Stack

- Keep the application client-only unless the user explicitly changes the architecture.
- Run heavy optics computation in `src/workers`; do not block React render paths with numeric work.
- Use Comlink for worker calls and keep shared worker payload types in framework-neutral modules.
- Prefer typed arrays for dense numeric worker payloads. Convert to plotting-friendly structures only at visualization boundaries.
- Do not use matplotlib for UI plots. Future browser plots should use ECharts or native web rendering.
- Treat Pyodide and prysm as worker-only dependencies.
- Preserve WCAG 2.2 AA expectations when adding UI: visible focus, semantic controls, contrast, and keyboard operation.
- Verify stack changes with `npm run typecheck`, relevant Vitest coverage, and Playwright smoke tests when UI behavior changes.
