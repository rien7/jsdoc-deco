import * as vscode from 'vscode'
import { applyDecorations, clearDecorations, disposeDecorations } from './decoration'
import { scanPropertyAccesses } from './astScanner'
import { extractDocumentation, extractQuickInfoBody, isSupportedDocument } from './utils'
import { QuickInfoResponse } from './tsserver/types'

let pendingTimeout: NodeJS.Timeout | null = null
let refreshDecorationId = 0

const DEBUG_LOG = true
const PREFIX = '[jsdoc-deco]'

type LogMethod = (...args: unknown[]) => void
function createLogger(enabled: boolean) {
  const wrap =
    (method: LogMethod): LogMethod =>
    (...args) => {
      if (!enabled) return
      method(PREFIX, ...args)
    }

  return {
    log: wrap(console.log),
    info: wrap(console.info),
    warn: wrap(console.warn),
    error: wrap(console.error),
  }
}

export const logger = createLogger(DEBUG_LOG)

export function activate(context: vscode.ExtensionContext) {
	// 确保使用语义服务器，才能加载 tsserver 插件
	ensureSemanticServer()
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
}

function installHooks(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		// 文档内容变化时扫描
		vscode.workspace.onDidChangeTextDocument(event => {
			logger.info("content change")
			const editor = vscode.window.activeTextEditor
			if (editor && event.document === editor.document) {
				scheduleRefresh(editor)
			}
		}),
		// 打开文档的时候重新扫描
		vscode.workspace.onDidOpenTextDocument(document => {
			logger.info("open document")
			const editor = vscode.window.activeTextEditor
			if (editor && document === editor.document) {
				scheduleRefresh(editor)
			}
		}),
		// 切换活动编辑器时重新扫描
    vscode.window.onDidChangeActiveTextEditor((editor) => {
			logger.info("change active editor")
      if (editor) {
        scheduleRefresh(editor, 0);
      }
    }),
    // 光标移动时重新扫描（确保光标附近也刷新）
    vscode.window.onDidChangeTextEditorSelection((event) => {
			logger.info("selection change")
      scheduleRefresh(event.textEditor);
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
		console.error(`${PREFIX} failed to enforce semantic server`, err)
	}
}

function scheduleRefresh(editor: vscode.TextEditor, delay = 150) {
	if (!isSupportedDocument(editor.document)) {
		clearDecorations(editor)
		return
	}

	if (pendingTimeout) {
		clearTimeout(pendingTimeout)
	}

	pendingTimeout = setTimeout(() => {
		refreshDecorations(editor)
	})
}

async function refreshDecorations(editor: vscode.TextEditor) {
	const document = editor.document
	logger.log("refresh decorations")
	if (!isSupportedDocument(document)) {
		clearDecorations(editor)
		return
	}

	const currentId = ++refreshDecorationId
	const version = document.version

	const propertyAccesses = scanPropertyAccesses(document)
	if (!propertyAccesses) {
		clearDecorations(editor)
		return
	}
	logger.log("propertyAccesses", propertyAccesses)

	const decorationOptions: vscode.DecorationOptions[] = []
	for (const access of propertyAccesses) {
		const quickInfo: QuickInfoResponse = await vscode.commands.executeCommand(
			'typescript.tsserverRequest',
			"quickinfo",
			{
				file: document.uri.fsPath,
				position: document.offsetAt(access.nameRange.start)
			}
		)
		logger.log("quickInfo", access.left, access.right, quickInfo)
		const body = extractQuickInfoBody(quickInfo)
		if (!body) continue

		const text = extractDocumentation(body)
		if (!text) continue

		logger.log("add decorations for", text)

		decorationOptions.push({
			range: access.range,
			renderOptions: {
				after: {
					contentText: text,
					color: '#8a8a8a',
					margin: '0 0 0 8px'
				}
			}
		})
	}

	if (currentId !== refreshDecorationId || document.version !== version) return

	applyDecorations(editor, decorationOptions)
}
