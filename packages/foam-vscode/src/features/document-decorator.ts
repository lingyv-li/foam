import { debounce } from 'lodash';
import * as vscode from 'vscode';
import { FoamFeature } from '../types';
import {
  ConfigurationMonitor,
  monitorFoamVsCodeConfig,
} from '../services/config';
import { ResourceParser } from '../core/model/note';
import { FoamWorkspace } from '../core/model/workspace';
import { Foam } from '../core/model/foam';
import { fromVsCodeUri } from '../utils/vsc-utils';

export const CONFIG_KEY = 'decorations.links.enable';

const linkDecoration = vscode.window.createTextEditorDecorationType({
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  textDecoration: 'none',
  color: { id: 'textLink.foreground' },
  cursor: 'pointer',
});

const placeholderDecoration = vscode.window.createTextEditorDecorationType({
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  textDecoration: 'none',
  color: { id: 'editorWarning.foreground' },
  cursor: 'pointer',
});

const updateDecorations = (
  areDecorationsEnabled: () => boolean,
  parser: ResourceParser,
  workspace: FoamWorkspace
) => (editor: vscode.TextEditor) => {
  if (
    !editor ||
    !areDecorationsEnabled() ||
    editor.document.languageId !== 'markdown'
  ) {
    return;
  }
  const note = parser.parse(
    fromVsCodeUri(editor.document.uri),
    editor.document.getText()
  );
  let linkRanges = [];
  let placeholderRanges = [];
  note.links.forEach(link => {
    const linkUri = workspace.resolveLink(note, link);
    if (linkUri.isPlaceholder()) {
      placeholderRanges.push(link.range);
    } else {
      linkRanges.push(link.range);
    }
  });
  editor.setDecorations(linkDecoration, linkRanges);
  editor.setDecorations(placeholderDecoration, placeholderRanges);
};

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const areDecorationsEnabled: ConfigurationMonitor<boolean> = monitorFoamVsCodeConfig(
      CONFIG_KEY
    );
    const foam = await foamPromise;
    let activeEditor = vscode.window.activeTextEditor;

    const immediatelyUpdateDecorations = updateDecorations(
      areDecorationsEnabled,
      foam.services.parser,
      foam.workspace
    );

    const debouncedUpdateDecorations = debounce(
      immediatelyUpdateDecorations,
      500
    );

    immediatelyUpdateDecorations(activeEditor);

    context.subscriptions.push(
      areDecorationsEnabled,
      linkDecoration,
      placeholderDecoration,
      vscode.window.onDidChangeActiveTextEditor(editor => {
        activeEditor = editor;
        immediatelyUpdateDecorations(activeEditor);
      }),
      vscode.workspace.onDidChangeTextDocument(event => {
        if (activeEditor && event.document === activeEditor.document) {
          debouncedUpdateDecorations(activeEditor);
        }
      })
    );
  },
};

export default feature;
