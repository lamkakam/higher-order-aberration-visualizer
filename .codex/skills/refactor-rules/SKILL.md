---
name: refactor-rules
description: Use when refactoring code in this repo.
---

# Refactor Rules
- Refactor with a safety net of tests. If the refactor is not fully covered by existing tests, add new tests before refactoring.
- Always work on a refactor branch. Never work on main branch
- Do not change existing behavior or add new features in a refactor PR
- All type checking and linting must be passed
- When a refactor changes app flow, file ownership, worker boundaries, Python package layout, or documented paths, update the relevant docs in `docs/architecture.md`, `docs/development.md`, or `docs/simulation.md` in the same change.
- In TypeScript, use `undefined` instead of `null` whenever possible
- When including link to any GitHub page, always use the domain name `redirect.github.com`. Never use the domain name of `github.com`
- End your commit message with "Co-Authored-By: <model-name-with-precise-version-number, eg. GPT-5.5> with an email address "no-reply@<domain-name>" for auditing purpose
