# Change Log

All notable changes to the "jsdoc-deco" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- Add TypeScript server plugin to surface JSDoc for `as const` object property accesses in Quick Info and inline decorations.
- Bundle both extension host and tsserver plugin with esbuild; copy plugin package metadata and mirror into `node_modules` for resolution.
- Auto-force VS Code to use the semantic TS server and restart it on activation so the plugin always loads without user settings.
- Add logging and fallback JSDoc extraction to improve diagnostics and coverage of object literal properties.
