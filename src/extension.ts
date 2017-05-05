import * as vscode from 'vscode';

import VCCLintingProvider from './features/vccLintProvider';

export function activate(context: vscode.ExtensionContext) {
	var disposable = vscode.commands.registerCommand('extension.vccRun', function () {
		let linter = new VCCLintingProvider();
		linter.doHlint(vscode.window.activeTextEditor.document);
		vscode.languages.registerCodeActionsProvider('vcc', linter);
	});
	context.subscriptions.push(disposable);

	var disposable = vscode.commands.registerCommand('extension.vccWatch', function () {
		let linter = new VCCLintingProvider();
		linter.activate(context.subscriptions);
		vscode.languages.registerCodeActionsProvider('vcc', linter);
	});

		var disposable = vscode.commands.registerCommand('extension.vccWatchStop', function () {
		let linter = new VCCLintingProvider();
		linter.dispose();
		// vscode.languages.('vcc', linter);
	});

	context.subscriptions.push(disposable);

}