# jsdoc-deco

Inline JSDoc decorations for property accesses on `as const` object literals in TypeScript/TSX files. Keeps docs visible next to the code without opening hovers.

## Features
- Shows JSDoc from `const obj = { /**doc*/ key: ... } as const` when you access `obj.key`.
- Decorations are cached and kept even when scrolled out of view; only the visible region triggers new tsserver requests.
- Bundled tsserver plugin and extension build via esbuild; activation enforces the semantic TypeScript server so the plugin always loads.
- Skips built-in lib symbols and drops stale cache entries when no documentation is returned.

## Usage
Open a TypeScript/TSX file and reference a property from a `const` object literal. The JSDoc for that property will appear inline after the property access while you edit, switch editors, or scroll.

## Requirements / Notes
- Uses the bundled tsserver plugin; VS Code’s TypeScript extension must be enabled.
- The extension sets `typescript.tsserver.useSyntaxServer` to `never` in the workspace to ensure the semantic server (and plugin) run.
- Only TypeScript/TSX files are supported; other languages are ignored.

## Development
- Build once: `node esbuild.js`
- Watch: `node esbuild.js --watch`
- Run extension: F5 with “Run Extension” launch config.

## CI / Release
- Tag pushes trigger GitHub Actions to build the VSIX with `vsce` and attach it to the GitHub release automatically.

## Known limitations
- Only `const` object literal properties are decorated; other symbol kinds are left untouched.
- If TypeScript server logs show the plugin not loading, reload the window or restart TS Server.
