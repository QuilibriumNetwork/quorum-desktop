# AGENTS.md

> A project manifest for AI coding agents.  
> This file provides the essential context, architecture rules, and development guidelines required for contributing to this repository.  
> Agents should use this as the single source of truth for how to operate on the project.

---

## Project Overview

Quorum is a **fully private and decentralized group messenger**, powered by Quilibrium and the libp2p stack.  
It supports **Web, Desktop (Electron), and Mobile (React Native)** platforms from a shared cross-platform codebase.

- **Website**: [quorummessenger.com](https://www.quorummessenger.com/)  
- **Web app (beta)**: [app.quorummessenger.com](https://app.quorummessenger.com/)  
- **Docs**: See [`.agents/INDEX.md`](.agents/INDEX.md)  

---

## Cross-Platform Architecture (Critical)

All development must be **mobile-first** and **cross-platform**:

- Shared primitives live in: `src/components/primitives/`  
- Platform detection utilities: `src/utils/platform.ts`  
- Directory layout:  
  - `src/` → Shared code (90% of app: components, hooks, api, services, utils)  
  - `web/` → Web-specific files (Vite, Electron wrapper)  
  - `mobile/` → React Native app (Expo configuration, test screens)  

**Golden Question**: _“Will this work on mobile?”_  

---

## Development Guidelines

### Package Management
- Use **Yarn only**.  
- Never use `npm`. If `package-lock.json` appears, delete it immediately.  

### Scripts
- `yarn dev` → Start dev server (user runs this manually)  
- `yarn build` → Production build  
- `yarn electron:dev` / `yarn electron:build` → Desktop build tools  
- `yarn lint`, `yarn format` → Maintain coding standards  
- `yarn lingui:*` → i18n workflows  

### Code Style
- Follow React best practices and never violate **Rules of Hooks**.  
- Use Lingui for localization in all user-facing text.  
- Follow Tailwind + semantic class system for styling (`src/index.css`, `tailwind.config.js`).  

### Mobile + Web Testing
- Web playground: `src/dev/primitives-playground`  
- Mobile playground: `mobile/test/`  

---

## Contribution Process

- When committing via AI agent, **do not reference the LLM (e.g. Claude or Anthropic)**.  
- Run `yarn lint` and `yarn format` on modified files before committing.  
- Check production build with `yarn build`.  
- For new docs in `.agents/`, add disclaimer and footer:  

```markdown
> **⚠️ AI-Generated**: May contain errors. Verify before use.

_Created: YYYY-MM-DD by AI Agent_
````

---

## Permissions & Automation

Agent operations are restricted via `settings.local.json`:

* **Allowed**: build, lint, format, TypeScript checks, Git read commands, local scripts.
* **Denied**: `npm`, `rm -rf`, `sudo`.
* **Ask first**: `yarn install`, dependency changes, `git push/pull`.

---

## Styling Principles

* Tailwind utilities for one-off components.
* Extract shared styles via semantic classes (`src/index.css`).
* Themes: light/dark, with RGB-based utility system (`--danger`, `--success`, etc.).
* Use `clsx` for conditional classes.

---

## Translation Workflow

* Translations live in `src/i18n/`.
* Run `yarn lingui:extract` and `yarn lingui:compile` to update messages.
* Proofreading completed for English and Italian.

---

## Agent Best Practices

* Always consider cross-platform impact.
* Minimize destructive changes; preserve shared functionality.
* Keep project maintainable, DRY, and user-friendly.

---

*Last updated: 2025-10-07*
