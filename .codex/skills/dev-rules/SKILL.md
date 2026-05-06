---
name: dev-rules
description: Use when adding or modifying features in this repo except refactoring.
---

# Dev rules
- Use TDD in all situations. Never implement anything before writing tests. The newly added tests should fail first, then you implement the feature to make the tests pass
- Always work on a feature branch. Never work on main branch
- Never push to main branch. Always push to a feature branch and open a PR for human approval
- All type checking and linting must be passed
- When a feature changes app architecture, developer commands, worker/API contracts, or simulation behavior, update the relevant docs in `docs/architecture.md`, `docs/development.md`, or `docs/simulation.md` in the same change.
- In TypeScript, use `undefined` instead of `null` whenever possible
- When including link to any GitHub page, always use the domain name `redirect.github.com`. Never use the domain name of `github.com`
- End your commit message with "Co-Authored-By: <model-name-with-precise-version-number, eg. GPT-5.5> with an email address "no-reply@<domain-name>" for auditing purpose
