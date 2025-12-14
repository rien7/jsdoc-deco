# Change Log

All notable changes to the "jsdoc-deco" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- Add TypeScript server plugin to surface JSDoc for `as const` object property accesses in Quick Info and inline decorations.
- Bundle both extension host and tsserver plugin with esbuild; copy plugin package metadata and mirror into `node_modules` for resolution (skip on build errors).
- Auto-force VS Code to use the semantic TS server and restart it on activation so the plugin always loads without user settings.
- Add caching, visible-range-only scanning, and concurrent tsserver requests with a bounded pool to reduce latency and load.
- Refresh visible-range decorations on scroll while retaining existing decorations off-screen.
- Clear stale cache entries when requests return no documentation (e.g., lib symbols) to avoid reusing old tooltips.
- Remove debug logging and rely on the tsserver plugin for const-object docs only (no extra JSDoc fallback).
