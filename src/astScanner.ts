import * as vscode from 'vscode';
import * as ts from 'typescript';

export interface PropertyAccessInfo {
  left: string;
  right: string;
  range: vscode.Range;
  nameRange: vscode.Range;
  offset: number;
}

function getScriptKind(document: vscode.TextDocument): ts.ScriptKind {
  if (document.languageId === 'typescriptreact') {
    return ts.ScriptKind.TSX;
  }
  return ts.ScriptKind.TS;
}

export function scanPropertyAccesses(document: vscode.TextDocument): PropertyAccessInfo[] {
  // 仅使用 createSourceFile 解析当前文档，避免创建 Program/类型检查
  const sourceFile = ts.createSourceFile(
    document.fileName,
    document.getText(),
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(document)
  );

  const results: PropertyAccessInfo[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAccessExpression(node)) {
      // 收集左值/右值文本与 Range 信息
      const left = node.expression.getText(sourceFile);
      const right = node.name.getText(sourceFile);
      const fullRange = new vscode.Range(
        document.positionAt(node.getStart(sourceFile)),
        document.positionAt(node.getEnd())
      );
      const nameStart = node.name.getStart(sourceFile);
      const nameEnd = node.name.getEnd();
      const nameRange = new vscode.Range(document.positionAt(nameStart), document.positionAt(nameEnd));

      results.push({
        left,
        right,
        range: fullRange,
        nameRange,
        offset: nameStart
      });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return results;
}
