# Vendored anti-slop rules

This directory contains the production dependency closure for the selected
rules from [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop), pinned
to upstream commit
[`e8c4880`](https://github.com/dmmulroy/anti-slop/commit/e8c4880471b23ab7f216fba7b27d173a6ef07d4c).
The upstream project is MIT-licensed; see `LICENSE`.

`index.ts` registers only the rules enabled by this repository. The
`blank-line-before-return`, `import-order`, and `no-inline-exports` rules are
repository-local. The Effect rule has one local customization: package aliases
under `@deno-effect/*` count as project-local imports alongside relative paths.
