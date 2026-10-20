# AGENTS.md

> **Operational contract for coding agents working in this repository**

---

## Before You Start

1. Understand the user's request precisely.
2. Identify which systems or files are affected.
3. Read only the relevant documentation under `docs/`.
4. Inspect existing implementations before introducing new patterns.
5. Keep changes as small as possible.

---

## How to Decide

### Design Priorities

When multiple valid solutions exist, prefer:

1. Correctness
2. Small changes
3. Existing patterns
4. Readability
5. Type safety
6. Performance

### Hard Rules

- **MUST** delegate record visibility to Directus for every collection and relation depth. Do not add
  status filters, publication-status validators or local release-date gates. When changing source
  queries, relations or search adapters, follow [data access responsibilities](docs/data-access.md).

- **MUST NOT** introduce breaking UX or API-shape changes without explicit request
- **MUST NOT** edit files under `.husky/**` unless explicitly requested in the current task
- **MUST NOT** edit anything under `.agents/skills/**` unless explicitly requested
- **MUST NOT** add dependencies unless explicitly requested and demonstrated to improve codebase
  health and quality
- **MUST NOT** change Vitest coverage include paths unless explicitly requested
- **MUST NOT** add tests solely to meet coverage thresholds - tests should only be added for known
  risks or regression prevention
- **MUST NOT** create, configure, or use a repository-local PNPM store such as `.pnpm-store/`
- **MUST NOT** set `store-dir` to a path inside the repository, whether via config, environment
  variable, or CLI flag
- **MUST NOT** run `pnpm install` or any command that mutates `node_modules` or the lockfile unless
  the current task explicitly requires dependency or package-manager work
- **MUST** use the project-pinned package manager via Corepack when running PNPM-related commands
- **MUST** prefer inspection commands that do not modify dependency state when dependency changes
  are not part of the task
- **MUST** use Zod for boundary validation where applicable
- **MUST** preserve Node server and Cloudflare Workers runtime compatibility

### Package Manager Contract

- This repository is pinned to the package manager declared in `package.json`
- Agents must invoke PNPM as `corepack pnpm ...` instead of plain `pnpm ...`
- Agents must treat any untracked or modified `.pnpm-store/**` content as a problem to avoid, not as
  a normal byproduct of their work
- Agents must not add `.npmrc` settings, shell exports, or command flags that redirect the PNPM
  store into the repository
- If dependency work is explicitly required, agents must keep the existing lockfile and
  `node_modules` topology stable unless the requested change genuinely requires updates
- If PNPM store behavior is unexpected, agents must stop and report the cause instead of continuing
  with more package-manager mutations

### Working Principles

- Treat existing uncommitted worktree changes as owned by the human collaborator or another agent.
  Assume multiple agents may be active in the worktree; inspect and preserve changes you did not
  make yourself, and modify only files required for the current task. Never revert, reset, stash,
  or overwrite unrelated changes. If a tool changes an unrelated file, stop and report it rather
  than restoring that file automatically.
- Prefer extending existing implementations over introducing new abstractions
- Keep presentational concerns in components and reusable logic in composables
- When repository conventions are unclear, inspect nearby code before inventing a new pattern
- Verify real runtime behavior from code before changing documentation or implementation
- Read only the documentation relevant to the files or systems you are modifying
- Keep scope tight — avoid opportunistic refactors
- Preserve existing route and file naming contracts unless explicitly asked to change them

### Server Route Organization

- Organize `server/api/` routes by URL namespace.
- When a URL path has multiple method handlers, place them in a directory and name the handlers
  `index.<method>.ts` (for example, `server/api/user/[id]/index.get.ts`).
- Place child routes below their parent namespace (for example,
  `server/api/user/[id]/referral-count.get.ts` and `server/api/user/session/refresh.post.ts`).
- Keep a single, action-specific route as `<action>.<method>.ts`; do not overload an unrelated
  resource index route merely to avoid a file (for example, `server/api/user/signup.post.ts`).

---

## When to Ask

Ask for clarification instead of guessing when:

- Requirements are ambiguous
- Multiple architectural directions are equally valid
- The requested change could break compatibility

---

## Definition of Done

A task is **ONLY** complete when **ALL** applicable items are satisfied:

1. Formatting applied with `pnpm fmt`
2. Lint autofixes applied and lint passes with `pnpm lint:fix`
3. TypeScript checks pass with `pnpm typecheck`
4. If server or module runtime server code changed, API surface has been reviewed
5. Documentation updated in `docs/` (single source of truth)
6. All code written or touched has proper JSDoc where applicable
7. If API surface changed, the relevant API documentation has been updated
8. Route and runtime contracts remain backward-compatible unless explicitly requested

**Important:** After completing the above, the agent **MUST NOT** commit the changes, unless explicitly requested. Instead, the
agent **MUST** provide a summary of the work done, including:

- What changed
- Impact on contracts and behavior
- Open risks or follow-up work

It is the responsibility of the human collaborator to review, approve, and commit the changes.

---

## Git

- **Agents MUST NOT commit changes directly.** All changes must be reviewed and committed by a human
  collaborator.
- Use Conventional Commit messages: `<type>(<scope>): <subject>` for summarizing changes
- Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`,
  `revert`
