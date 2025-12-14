import { QuickInfoResponse } from './tsserver/types'
import * as vscode from 'vscode'

const SUPPORTED_LANGUAGES = new Set([
	'typescript', 'typescriptreact'
])
const DOC_PREFIX = '\u200b\u200b'
const DOC_SUFFIX = '\u200b\u200b'
export function isSupportedDocument(document: vscode.TextDocument): boolean {
  const ok = SUPPORTED_LANGUAGES.has(document.languageId)
  return ok
}

export function extractQuickInfoBody(
  response: QuickInfoResponse | { body?: unknown; response?: unknown } | undefined
): QuickInfoResponse['body'] | undefined {
  if (!response) {
    return undefined
  }

  // tsserver 协议：{ type, success, body }
  if ((response as any).success === false) {
    return undefined
  }
  if (Object.prototype.hasOwnProperty.call(response as any, 'body')) {
    return (response as any).body as QuickInfoResponse['body']
  }

  // 某些版本 API 直接返回 { response: body }
  if (Object.prototype.hasOwnProperty.call(response as any, 'response')) {
    return (response as any).response as QuickInfoResponse['body']
  }

  // 兜底：有可能直接返回 QuickInfoResponseBody 本身
  if ((response as any).documentation) {
    return response as any
  }

  return undefined
}

export function extractDocumentation(body: QuickInfoResponse['body'] | undefined): string {
  if (!body || !body.documentation) {
    return ''
  }

  const { documentation } = body
  const text = (typeof documentation === 'string'
    ? documentation
    : documentation.map((part) => part.text).join('')
  ).trim()

  if (!text.startsWith(DOC_PREFIX) || !text.endsWith(DOC_SUFFIX)) {
    return ''
  }

  return text.slice(DOC_PREFIX.length, text.length - DOC_SUFFIX.length).trim()
}
