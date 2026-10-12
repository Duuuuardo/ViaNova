# Contributing

## Branch flow

- Create `feature/<description>` or `fix/<description>` from `develop`.
- Open PRs against `develop`; squash merge after CI passes.
- Promote `develop` to `main` via PR without squash. `main` tracks production.
- Create `hotfix/<description>` from `main`. After releasing to `main`, port the fix back to `develop`.
- Never force push `main` or `develop`.

## Before opening a PR

Run `bun install --frozen-lockfile`, `bun run typecheck`, `bun test`, and
`bun run build`. Document migrations, new environment variables, and the
rollback plan when they apply.
