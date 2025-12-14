import type * as ts from 'typescript/lib/tsserverlibrary'

function init(modules: { typescript: typeof ts }) {
  const tsModule = modules.typescript

  function create(info: ts.server.PluginCreateInfo): ts.LanguageService {
    const logger = info.project.projectService.logger
    const dbg = (msg: string) => logger.info(`[jsdoc-deco-ts] ${msg}`)
    const base = info.languageService
    const proxy = copyLanguageService(base)

    proxy.getQuickInfoAtPosition = (fileName: string, position: number): ts.QuickInfo | undefined => {
      const quickInfo = base.getQuickInfoAtPosition(fileName, position)
      if (!quickInfo) {
        return undefined
      }

      try {
        const program = info.languageService.getProgram()
        if (!program) { return quickInfo }

        const sourceFile = program.getSourceFile(fileName)
        if (!sourceFile) { return quickInfo }

        const checker = program.getTypeChecker()

        const node = findNodeAtPosition(tsModule, sourceFile, position)
        if (!node) { return quickInfo }

        const propAccess = tsModule.findAncestor(node, tsModule.isPropertyAccessExpression)
        if (!propAccess || node !== propAccess.name) { return quickInfo }

        const memberSymbol = checker.getSymbolAtLocation(propAccess.name)
        if (!memberSymbol) { return quickInfo }

        const memberDecls = memberSymbol.getDeclarations() ?? []
        const declPaths = memberDecls.map((d) => d.getSourceFile().fileName)
        const start = tsModule.getLineAndCharacterOfPosition(sourceFile, propAccess.name.getStart())
        dbg(`quickinfo file=${fileName} pos=${start.line + 1}:${start.character + 1} name=${propAccess.name.getText()} decls=${declPaths.join(',')}`)

        const isFromLib = memberDecls.some((d) => {
          const file = d.getSourceFile().fileName
          return file.includes('/typescript/lib/') || file.includes('\\typescript\\lib\\')
        })
        dbg(`isFromLib=${isFromLib}`)
        if (isFromLib) { return quickInfo }

        const isFromConstObject = memberDecls.some((decl) => isConstObjectLiteralDecl(tsModule, decl))
        dbg(`isFromConstObject=${isFromConstObject}`)
        if (!isFromConstObject) { return quickInfo }

        const docParts = memberSymbol.getDocumentationComment(checker)
        const docText = docParts
          .map((p) => p.text.trim())
          .filter(Boolean)
          .join('\n')
        // 没有文档时不覆盖原始 quickInfo
        if (!docText) return quickInfo

        const PREFIX = '\u200b\u200b'
        const SUFFIX = '\u200b\u200b'
        quickInfo.documentation = [{ kind: 'text', text: `${PREFIX}${docText}${SUFFIX}` }]

      } catch {
        return undefined
      }

      return quickInfo
    }

    return proxy
  }

  return { create }
}

function copyLanguageService(base: ts.LanguageService): ts.LanguageService {
  const proxy: ts.LanguageService = Object.create(null)
  for (const key of Object.keys(base) as Array<keyof ts.LanguageService>) {
    proxy[key] = (...args: unknown[]) => (base[key] as any)(...args)
  }

  return proxy
}

/**
 * 在 SourceFile 中根据 position 找到最深层 node
 */
function findNodeAtPosition(
  tsModule: typeof ts,
  sourceFile: ts.SourceFile,
  position: number
): ts.Node | undefined {
  function visit(node: ts.Node): ts.Node | undefined {
    if (position < node.getStart() || position >= node.getEnd()) {
      return undefined
    }

    return tsModule.forEachChild(node, visit) ?? node
  }

  return visit(sourceFile)
}

function isConstObjectLiteralDecl(tsModule: typeof ts, decl: ts.Declaration): boolean {
  let current: ts.Node | undefined = decl
  while (current) {
    if (tsModule.isVariableDeclaration(current)) {
      const list = current.parent
      if (tsModule.isVariableDeclarationList(list)
        && (list.flags & tsModule.NodeFlags.Const) !== 0) {
          const init = current.initializer
          const obj = unwrapToObjectLiteral(tsModule, init)
          return obj !== undefined
      }
    }
    current = current.parent
  }
  return false
}

function unwrapToObjectLiteral(tsModule: typeof ts, expr: ts.Expression | undefined): ts.ObjectLiteralExpression | undefined {
  let cur = expr
  while (cur) {
    if (tsModule.isParenthesizedExpression(cur)) {
      cur = cur.expression
      continue
    }
    if (tsModule.isAsExpression(cur)) {
      cur = cur.expression
      continue
    }
    if (tsModule.isSatisfiesExpression(cur)) {
      cur = cur.expression
      continue
    }
    break
  }
  if (cur && tsModule.isObjectLiteralExpression(cur)) {
    return cur
  }
  return undefined
}
export = init
