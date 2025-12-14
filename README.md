# jsdoc-deco

Inline JSDoc decorations for property accesses on `as const` object literals in TypeScript/TSX files. Keeps docs visible next to the code without opening hovers.

## What it does
- Shows JSDoc from `const obj = { /**doc*/ key: ... } as const` when you access `obj.key`.
- Filters out TypeScript lib/interface members so only your `as const` object literals decorate.
- Decorations are cached and kept when scrolled; only visible regions trigger new tsserver requests.
- Bundled tsserver plugin is always loaded by enforcing the semantic TypeScript server.

## Install
1. Install from VSIX or Marketplace (once published).
2. Open a TS/TSX file; the extension activates on TypeScript languages only.

## Usage
Write or reference `as const` object literals:
```ts
const Platform = {
  /** 支付宝 */
  Alipay: 0,
  /** 微信 */
  Wechat: 1,
  /** 京东 */
  JD: 2,
  /** 淘宝 */
  Taobao: 3,
  /** 美团 */
  Meituan: 4
} as const

Platform.Taobao // shows inline doc
```

## Requirements / Notes
- Uses the bundled tsserver plugin; VS Code’s built-in TypeScript extension must be enabled.
- The extension sets `typescript.tsserver.useSyntaxServer` to `never` in the workspace to ensure the semantic server (and plugin) run.
- Only TypeScript/TSX files are supported.

## Troubleshooting
- No decorations or missing `[jsdoc-deco-ts]` logs in tsserver log:
  - Restart TS Server (`TypeScript: Restart TS Server`) after install.
  - Ensure the VSIX includes `node_modules/vscode-jsdoc-inline-deco-tsserver-plugin` (required for tsserver to resolve the plugin).
  - Set `"typescript.tsserver.log": "verbose"` and check for `[jsdoc-deco-ts] tsserver plugin initialized`.

## Development
- Build once: `node esbuild.js`
- Watch: `node esbuild.js --watch`
- Run extension: F5 with “Run Extension” launch config.

## Release
- Tag pushes trigger GitHub Actions to build the VSIX with `vsce` and attach it to the GitHub release automatically.

## Known limitations
- Only `const` object literal properties are decorated; other symbol kinds are untouched.
