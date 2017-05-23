'use strict';

import * as path from 'path';
import * as cp from 'child_process';
import ChildProcess = cp.ChildProcess;

import * as vscode from 'vscode';

export default class VCCLintingProvider {

	private static commandId: string = 'vcc.runCodeAction';
	private command: vscode.Disposable;
	private diagnosticCollection: vscode.DiagnosticCollection;
	private outputChannel: vscode.OutputChannel;
	private saveWatcher: vscode.Disposable;
	private changeWatcher: vscode.Disposable;
	public lastParameters: string[];

	constructor(subscriptions: vscode.Disposable[]) {
		subscriptions.push(this);
		this.diagnosticCollection = vscode.languages.createDiagnosticCollection();
		this.outputChannel = vscode.window.createOutputChannel("VCC");
		this.changeWatcher = vscode.workspace.onDidChangeTextDocument(this.diagnosticCollection.clear, this);
	}

	public watch() {
		this.saveWatcher = vscode.workspace.onDidSaveTextDocument(() => {
			this.verify([''])
		}, this);
		this.verify(['']);
	}

	public stopWatch() {
		this.saveWatcher.dispose();
	}
	public dispose(): void {
		this.diagnosticCollection.clear();
		this.diagnosticCollection.dispose();
		this.outputChannel.clear();
		this.outputChannel.dispose();
		this.changeWatcher.dispose();
		if (this.saveWatcher != null) {
			this.saveWatcher.dispose();
		}
	}
	public reVerify() {
		if (this.lastParameters != null) {
			this.verify(this.lastParameters)
		} else {
			this.outputChannel.clear();
			this.outputChannel.show(true);
			this.outputChannel.append("You have never verified before...");
			return;
		}

	}
	
	public verify(parameters: string[]) {
		let textDocument = vscode.window.activeTextEditor.document;
		if (textDocument.languageId !== 'cpp' && (textDocument.languageId !== 'c')) {
			return;
		}
		this.outputChannel.clear();
		this.outputChannel.show(true);
		this.lastParameters = parameters;

		let options = vscode.workspace.rootPath ? { cwd: vscode.workspace.rootPath } : undefined;
		let args = [textDocument.fileName].concat(parameters);
		let childProcess = cp.spawn('vcc', args, options);
		this.outputChannel.append('vcc ' + args + "\n");

		childProcess.on('error', (error: Error) => {
			// console.log("ERROR:" + error);
			vscode.window.showInformationMessage(`Cannot vcc the c file.`);
		});

		let decoded = ''
		if (childProcess.pid) {
			childProcess.stdout.on('data', (data: Buffer) => {
				decoded += data;
			});
			childProcess.stdout.on('end', () => {
				var messages = decoded.split("\n");
				let diagnostics: vscode.Diagnostic[] = [];

				messages.forEach(message => {
					console.log(message);
					this.outputChannel.append(message);
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
}
