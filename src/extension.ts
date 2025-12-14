import * as vscode from 'vscode'
import { applyDecorations, clearDecorations, disposeDecorations } from './decoration'
import { scanPropertyAccesses } from './astScanner'
import { extractDocumentation, extractQuickInfoBody, isSupportedDocument } from './utils'
import { QuickInfoResponse } from './tsserver/types'

let pendingTimeout: NodeJS.Timeout | null = null
let refreshDecorationId = 0

const PREFIX = '[jsdoc-deco]'
const MAX_CONCURRENCY = 4
const DEFAULT_DELAY = 150
const quickInfoCache = new Map<string, { version: number; map: Map<number, string> }>()

export function activate(context: vscode.ExtensionContext) {
	// 确保使用语义服务器，才能加载 tsserver 插件
	void ensureSemanticServer()
	// 激活时立即对当前编辑器进行一次扫描
	if (vscode.window.activeTextEditor) {
		scheduleRefresh(vscode.window.activeTextEditor, 0)
	}

	installHooks(context)
}

export function deactivate() {
	const editor = vscode.window.activeTextEditor
	if (editor) {
		clearDecorations(editor)
	}
	disposeDecorations()
	if (pendingTimeout) {
		clearTimeout(pendingTimeout)
		pendingTimeout = null
	}
	quickInfoCache.clear()
}

function installHooks(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		// 文档内容变化时扫描
		vscode.workspace.onDidChangeTextDocument(event => {
			const editor = vscode.window.activeTextEditor
			if (editor && event.document === editor.document) {
				scheduleRefresh(editor)
			}
		}),
		// 打开文档的时候重新扫描
		vscode.workspace.onDidOpenTextDocument(document => {
			const editor = vscode.window.activeTextEditor
			if (editor && document === editor.document) {
				scheduleRefresh(editor)
			}
		}),
		// 切换活动编辑器时重新扫描
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        scheduleRefresh(editor, 0)
      }
    }),
		// 滚动可见区域时刷新可见范围内的装饰
		vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
			if (event.textEditor === vscode.window.activeTextEditor) {
				scheduleRefresh(event.textEditor)
			}
		}),
		{ dispose: disposeDecorations }
	)
}

async function ensureSemanticServer() {
	try {
		const config = vscode.workspace.getConfiguration('typescript')
		const current = config.get<string>('tsserver.useSyntaxServer')
		if (current !== 'never') {
			await config.update('tsserver.useSyntaxServer', 'never', vscode.ConfigurationTarget.Workspace)
			// 让设置立即生效
			await vscode.commands.executeCommand('typescript.restartTsServer')
		}
	} catch (err) {
		void vscode.window.showWarningMessage(`${PREFIX} Semantic server enforcement failed. Please set "typescript.tsserver.useSyntaxServer": "never" manually.`)
	}
}

function scheduleRefresh(editor: vscode.TextEditor, delay = DEFAULT_DELAY) {
	if (!isSupportedDocument(editor.document)) {
		clearDecorations(editor)
		return
	}

	if (pendingTimeout) {
		clearTimeout(pendingTimeout)
	}

	pendingTimeout = setTimeout(() => {
		refreshDecorations(editor)
	}, delay)
}

async function refreshDecorations(editor: vscode.TextEditor) {
	const document = editor.document
	if (!isSupportedDocument(document)) {
		clearDecorations(editor)
		return
	}

	const currentId = ++refreshDecorationId
	const version = document.version
	const cache = ensureDocumentCache(document)
	const allAccesses = scanPropertyAccesses(document)
	if (!allAccesses || allAccesses.length === 0) {
		clearDecorations(editor)
		return
	}
	const visibleAccesses = filterVisiblePropertyAccesses(editor, allAccesses)

	await buildDecorationsWithConcurrency(
		document,
		visibleAccesses,
		currentId,
		version,
		cache
	)

	pruneCache(cache, allAccesses)

	if (currentId !== refreshDecorationId || document.version !== version) return

	const decorationOptions = buildDecorationOptionsFromCache(allAccesses, cache)
	if (decorationOptions.length === 0) {
		clearDecorations(editor)
		return
	}

	applyDecorations(editor, decorationOptions)
}

function ensureDocumentCache(document: vscode.TextDocument) {
	const key = document.uri.toString()
	const cached = quickInfoCache.get(key)
	if (!cached) {
		const fresh = { version: document.version, map: new Map<number, string>() }
		quickInfoCache.set(key, fresh)
		return fresh
	}
	if (cached.version !== document.version) {
		// keep map to reuse stale values if needed, but mark new version
		cached.version = document.version
	}
	return cached
}

function filterVisiblePropertyAccesses(
	editor: vscode.TextEditor,
	accesses: ReturnType<typeof scanPropertyAccesses>
) {
	if (!accesses || accesses.length === 0) return accesses
	const visibleRanges = editor.visibleRanges
	if (!visibleRanges || visibleRanges.length === 0) return accesses
	const spans = visibleRanges.map(range => ({
		start: editor.document.offsetAt(range.start),
		end: editor.document.offsetAt(range.end)
	}))
	return accesses.filter(access => {
		const start = editor.document.offsetAt(access.range.start)
		const end = editor.document.offsetAt(access.range.end)
		return spans.some(span => start <= span.end && end >= span.start)
	})
}

async function buildDecorationsWithConcurrency(
	document: vscode.TextDocument,
	accesses: ReturnType<typeof scanPropertyAccesses>,
	requestId: number,
	version: number,
	cache: { version: number; map: Map<number, string> }
): Promise<void> {
	const tasks = accesses.map(access => async () => {
		if (requestId !== refreshDecorationId || document.version !== version) return null
		const cachedText = cache.map.get(access.offset)
		if (cachedText) {
			return null
		}

		const text = await fetchDocumentation(document, access).catch(() => null)
		if (!text) {
			cache.map.delete(access.offset)
			return null
		}
		cache.map.set(access.offset, text)
		return null
	})

	const worker = async () => {
		while (tasks.length) {
			const task = tasks.shift()
			if (!task) break
			await task()
		}
	}

	const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, tasks.length) }, () => worker())
	await Promise.all(workers)
}

async function fetchDocumentation(
	document: vscode.TextDocument,
	access: ReturnType<typeof scanPropertyAccesses>[number]
): Promise<string | null> {
	const quickInfo: QuickInfoResponse | undefined = await vscode.commands.executeCommand(
		'typescript.tsserverRequest',
		'quickinfo',
		{
			file: document.uri.fsPath,
			position: document.offsetAt(access.nameRange.start),
		}
	)
	if (!quickInfo) return null
	const body = extractQuickInfoBody(quickInfo)
	if (!body) return null
	const text = extractDocumentation(body)
	return text || null
}

function pruneCache(
	cache: { version: number; map: Map<number, string> },
	accesses: ReturnType<typeof scanPropertyAccesses>
) {
	const offsets = new Set(accesses.map(a => a.offset))
	for (const key of cache.map.keys()) {
		if (!offsets.has(key)) {
			cache.map.delete(key)
		}
	}
}

function buildDecorationOptionsFromCache(
	accesses: ReturnType<typeof scanPropertyAccesses>,
	cache: { version: number; map: Map<number, string> }
): vscode.DecorationOptions[] {
	const options: vscode.DecorationOptions[] = []
	for (const access of accesses) {
		const text = cache.map.get(access.offset)
		if (!text) continue
		options.push(toDecoration(access, text))
	}
	return options
}

function toDecoration(access: ReturnType<typeof scanPropertyAccesses>[number], text: string) {
	return {
		range: access.range,
		renderOptions: {
			after: {
				contentText: text,
				color: '#8a8a8a',
				margin: '0 0 0 8px'
			}
		}
	} satisfies vscode.DecorationOptions
}
