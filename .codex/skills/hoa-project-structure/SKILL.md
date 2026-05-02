---
name: hoa-project-structure
description: Use when adding, moving, or reorganizing files in this repo.
---

# HOA Project Structure

- Place reusable React UI in `src/components`.
- Place worker entry points, worker clients, and worker API types in `src/workers`.
- Place framework-neutral optics/domain code in `src/domain`.
- Place Vitest setup and shared test helpers in `src/test`.
- Place future chart or visualization adapters near the UI that consumes them unless they are framework-neutral.
- UI components must not import Pyodide directly.
- Worker code must not import React.
- Shared types must remain framework-neutral and serializable across the worker boundary.
- Keep new files scoped to the requested feature; do not add docs or directories speculatively.
