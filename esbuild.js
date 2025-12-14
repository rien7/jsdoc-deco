const esbuild = require("esbuild");
const fs = require("fs/promises");
const path = require("path");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const pluginName = 'vscode-jsdoc-inline-deco-tsserver-plugin';
const tsserverDistDir = path.join(__dirname, 'dist/tsserver');
const tsserverNodeModulesDir = path.join(__dirname, 'node_modules', pluginName);

const commonOptions = {
	bundle: true,
	format: 'cjs',
	minify: production,
	sourcemap: !production,
	sourcesContent: false,
	platform: 'node',
	logLevel: 'silent',
};

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

/**
 * Copy tsserver/package.json into dist so VS Code can load the plugin.
 * @type {import('esbuild').Plugin}
 */
const copyTsserverPackagePlugin = {
	name: 'copy-tsserver-package',
	setup(build) {
		build.onStart(async () => {
			const src = path.join(__dirname, 'src/tsserver/package.json');
			const dest = path.join(tsserverDistDir, 'package.json');
			await fs.mkdir(path.dirname(dest), { recursive: true });
			await fs.copyFile(src, dest);
		});
	},
};

/**
 * Mirror dist/tsserver into node_modules so tsserver can resolve the plugin by name.
 * @type {import('esbuild').Plugin}
 */
const mirrorTsserverToNodeModules = {
	name: 'mirror-tsserver-to-node_modules',
	setup(build) {
		build.onEnd(async (result) => {
			if (result.errors.length) return;

			await fs.mkdir(tsserverNodeModulesDir, { recursive: true });
			await fs.cp(tsserverDistDir, tsserverNodeModulesDir, { recursive: true });
		});
	},
};

async function main() {
	const extensionCtx = await esbuild.context({
		entryPoints: [
			'src/extension.ts',
		],
		...commonOptions,
		outfile: 'dist/extension.js',
		external: ['vscode'],
		plugins: [
			/* add to the end of plugins array */
			esbuildProblemMatcherPlugin,
		],
	});

	const tsserverCtx = await esbuild.context({
		entryPoints: [
			'src/tsserver/index.ts'
		],
		...commonOptions,
		outbase: 'src',
		outdir: 'dist',
		// tsserver will provide its own typescript module
		external: ['typescript'],
		plugins: [
			esbuildProblemMatcherPlugin,
			copyTsserverPackagePlugin,
			mirrorTsserverToNodeModules,
		],
	});

	if (watch) {
		await Promise.all([
			extensionCtx.watch(),
			tsserverCtx.watch(),
		]);
	} else {
		await extensionCtx.rebuild();
		await tsserverCtx.rebuild();
		await extensionCtx.dispose();
		await tsserverCtx.dispose();
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
