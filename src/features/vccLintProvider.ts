'use strict';

import * as path from 'path';
import * as cp from 'child_process';
import ChildProcess = cp.ChildProcess;

import * as vscode from 'vscode';

export default class VCCLintingProvider implements vscode.CodeActionProvider {

	private static commandId: string = 'vcc.runCodeAction';
	private command: vscode.Disposable;
	private diagnosticCollection: vscode.DiagnosticCollection;

	public activate(subscriptions: vscode.Disposable[]) {
		this.command = vscode.commands.registerCommand(VCCLintingProvider.commandId, this.runCodeAction, this);
		subscriptions.push(this);
		this.diagnosticCollection = vscode.languages.createDiagnosticCollection();

		vscode.workspace.onDidOpenTextDocument(this.doHlint, this, subscriptions);
		vscode.workspace.onDidSaveTextDocument(this.doHlint, this);
		vscode.workspace.onDidCloseTextDocument((textDocument) => {
			this.diagnosticCollection.delete(textDocument.uri);
		}, null, subscriptions);

		// lint all open c documents
		vscode.workspace.textDocuments.forEach(this.doHlint, this);
	}

	public dispose(): void {
		this.diagnosticCollection.clear();
		this.diagnosticCollection.dispose();
		this.command.dispose();
	}

	public doHlint(textDocument: vscode.TextDocument) {
		console.log(textDocument.languageId);
		if (textDocument.languageId !== 'cpp' && (textDocument.languageId !== 'c')) {
			return;
		}

		let decoded = ''
		let diagnostics: vscode.Diagnostic[] = [];

		let options = vscode.workspace.rootPath ? { cwd: vscode.workspace.rootPath } : undefined;
		let args = [textDocument.fileName];

		let childProcess = cp.spawn('vcc', args, options);
		childProcess.on('error', (error: Error) => {
			// console.log("ERROR:" + error);
			vscode.window.showInformationMessage(`Cannot vcc the c file.`);
		});
		if (childProcess.pid) {
			childProcess.stdout.on('data', (data: Buffer) => {
				decoded += data;
			});
			childProcess.stdout.on('end', () => {
				var messages = decoded.split("\n");
				console.log("fulltext: \n" + decoded, "textDocument: \n" + textDocument)

				messages.forEach(message => {
					console.log(message);

					var ind = message.indexOf(".c(");
					if (ind < 0) {
						ind = message.indexOf(".h(");
					}
					if (ind < 0) {
						return;
					}
					message = message.substr(ind + 3);
					let row = message.substr(0, message.indexOf(","))
					let column = message.substr(message.indexOf(",") + 1, message.indexOf(")") - message.indexOf(",") - 1)
					let err = message.substr(message.indexOf(":") + 1);

					let position = new vscode.Position(+row - 1, +column - 1);
					let range = textDocument.getWordRangeAtPosition(position);
					if (range == undefined) {
						range = new vscode.Range(+row - 1, +column - 1, +row - 1, +column)
					}
					let errmsg = err.substr(err.indexOf(":") + 2);
					let severity = vscode.DiagnosticSeverity.Error;

					let diagnostic = new vscode.Diagnostic(range, errmsg, severity);
					diagnostics.push(diagnostic);

					// console.log("ROW: " + row, "COL: " + column);
				})
				if (this.diagnosticCollection == null) {
					this.diagnosticCollection = vscode.languages.createDiagnosticCollection();
				}
				this.diagnosticCollection.set(textDocument.uri, diagnostics);

			});
		}
	}

	public provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.Command[] {
		// let diagnostic: vscode.Diagnostic = context.diagnostics[0];
		// return [{
		// 	title: "Accept hlint suggestion",
		// 	command: VCCLintingProvider.commandId,
		// 	arguments: [document, diagnostic.range, diagnostic.message]
		// }];
		return null;
	}

	private runCodeAction(document: vscode.TextDocument, range: vscode.Range, message: string): any {
		// let fromRegex: RegExp = /.*Replace:(.*)==>.*/g
		// let fromMatch: RegExpExecArray = fromRegex.exec(message.replace(/\s/g, ''));
		// let from = fromMatch[1];
		// let to: string = document.getText(range).replace(/\s/g, '')
		// if (from === to) {
		// 	let newText = /.*==>\s(.*)/g.exec(message)[1]
		// 	let edit = new vscode.WorkspaceEdit();
		// 	edit.replace(document.uri, range, newText);
		// 	return vscode.workspace.applyEdit(edit);
		// } else {
		// 	vscode.window.showErrorMessage("The suggestion was not applied because it is out of date. You might have tried to apply the same edit twice.");
		// }
	}
}
