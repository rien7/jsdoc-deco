import * as vscode from 'vscode'

export const decorationType = vscode.window.createTextEditorDecorationType({
  after: {
    color: '#8a8a8a',
    margin: '0 0 0 8px',
  }
})
export function clearDecorations(editor: vscode.TextEditor) {
  editor.setDecorations(decorationType, [])
}

export function applyDecorations(editor: vscode.TextEditor, decorationOptions: vscode.DecorationOptions[]) {
  editor.setDecorations(decorationType, decorationOptions)
}

export function disposeDecorations(): void {
  decorationType.dispose();
}
