'use strict';

import * as path from 'path';
import * as cp from 'child_process';
import ChildProcess = cp.ChildProcess;

import * as vscode from 'vscode';

export default class VCCLinter {

	private diagnosticCollection: vscode.DiagnosticCollection;
	private outputChannel: vscode.OutputChannel;
	public saveWatcher: vscode.Disposable;
	private changeWatcher: vscode.Disposable;
	public lastParameters: string[];
	private config: vscode.WorkspaceConfiguration;
	private lock: boolean;
	private childProcess: cp.ChildProcess;

	constructor(subscriptions: vscode.Disposable[]) {
		// subscriptions.push(this);
		this.diagnosticCollection = vscode.languages.createDiagnosticCollection();
		this.outputChannel = vscode.window.createOutputChannel("VCC");
		vscode.workspace.onDidChangeConfiguration(this.loadConfig, this, subscriptions);
		this.loadConfig();
	}

	public cancel() {
		if(this.childProcess)
			this.childProcess.kill();
		this.lock = false;
	}

	private loadConfig() {
		this.config = vscode.workspace.getConfiguration("vcclinter");
	}
	public help() {
		if (this.lock) {
			return;
		}
		this.lock = true;
		let args = ["/help"];
		console.log("HERe:" + this.config.vccPath);

		this.childProcess = cp.spawn(this.config.vccPath.toString(), args);
		this.outputChannel.clear()
		this.outputChannel.show(true);
		this.outputChannel.append(this.config.vccPath + ' ' + args + "\n");

		this.childProcess.on('error', (error: Error) => {
			this.lock = false;
			vscode.window.showInformationMessage(`Cannot run vcc /help.`);
			this.outputChannel.append(error.message);
		});
		this.childProcess.on('exit', (code) => {
			this.lock = false;
		});
		let decoded = ''
		if (this.childProcess.pid) {
			this.childProcess.stdout.on('data', (data: Buffer) => {
				decoded += data;
			});
			this.childProcess.stdout.on('end', () => {
				console.log(decoded);
				this.outputChannel.append(decoded);
			});
		}

	}
	private getFilename(path: string) {
		let pos = path.indexOf("\\");
		while (pos >= 0) {
			path = path.substr(pos + 1);
			pos = path.indexOf("\\");
		}
		return path;
	}
	private removeFileEnding(filename: string) {
		let lastchar = filename.charAt(filename.length - 1);
		while (lastchar != '.') {
			filename = filename.substr(0, filename.length - 1);
			lastchar = filename.charAt(filename.length - 1);
		}
		return filename;
	}
	private getDirectory(path: string) {
		let lastchar = path.charAt(path.length - 1);
		while (lastchar != '\\') {
			path = path.substr(0, path.length - 1);
			lastchar = path.charAt(path.length - 1);
		}
		return path;
	}
	public showErrorModel(path = null) {
		if (this.lock) {
			return;
		}
		this.lock = true;
		path = path || vscode.window.activeTextEditor.document.uri.fsPath;
		let options = { cwd: this.getDirectory(path) };
		let args = [this.removeFileEnding(this.getFilename(path)) + "model"];

		this.childProcess = cp.spawn(this.config.bvdPath, args, options);

		this.childProcess.on('error', (error: Error) => {
			this.lock = false;
			vscode.window.showInformationMessage(`The model viewer could not be opened`);
			this.outputChannel.append(error.message);

		});
		this.childProcess.on('exit', (code) => {
			this.lock = false;
		});
	}
	public watch() {
		this.saveWatcher = vscode.workspace.onDidSaveTextDocument(() => {
			this.verify([''])
		}, this);
	}

	public stopWatch() {
		if (this.saveWatcher != null) {
			this.saveWatcher.dispose();
		}
	}
	public dispose(): void {
		this.diagnosticCollection.clear();
		this.diagnosticCollection.dispose();
		this.outputChannel.clear();
		this.outputChannel.dispose();
		this.stopWatch();
	}
	public reVerify() {
		if (this.lastParameters != null) {
			this.checkAutoSaveAndVerify(this.lastParameters)
		} else {
			this.outputChannel.clear();
			this.outputChannel.show(true);
			this.outputChannel.append("You have never verified before...");
			return;
		}
	}
	public checkAutoSaveAndVerify(parameters: string[], overWriteDefault = false) {
		if (vscode.workspace.getConfiguration('vcclinter').saveBeforeVerify) {
			let reEnableSaveWatcher = this.saveWatcher != null;
			this.stopWatch();
			vscode.window.activeTextEditor.document.save().then(() => {
				if (reEnableSaveWatcher) {
					this.watch();
				}
				this.verify(parameters, overWriteDefault);
			});
		} else {
			this.verify(parameters, overWriteDefault);
		}
	}
	public verify(parameters: string[], overWriteDefault = false) {
		let textDocument = vscode.window.activeTextEditor.document;
		if (textDocument.languageId !== 'cpp' && (textDocument.languageId !== 'c')) {
			return;
		}
		if (this.lock) {
			vscode.window.showInformationMessage('A Verification Process is already running. Please wait or cancel the process [default keybind: Alt+V, Alt+C].');
			return;
		}
		this.lock = true;
		this.outputChannel.clear();
		this.outputChannel.show(true);
		parameters = parameters.concat(this.config.defaultParameters);
		this.lastParameters = parameters;

		let options = { cwd: vscode.workspace.rootPath };
		let args = [textDocument.fileName].concat(parameters);
		if (this.config.showZ3Inspector) {
			args.push("/i")
		}
		this.childProcess = cp.spawn('vcc', args, options);
		this.outputChannel.append('vcc ' + args.toString().replace(/,/g, " ") + "\n");



		let decoded = ''
		if (this.childProcess.pid) {

			this.childProcess.on('error', (error: Error) => {
				// console.log("ERROR:" + error);
				this.lock = false;
				vscode.window.showInformationMessage(`Cannot vcc the c file.`);
				this.outputChannel.append(error.message);
			});

			this.childProcess.stdout.on('data', (data: Buffer) => {
				decoded += data;
			});
			this.childProcess.stdout.on('end', () => {
				var messages = decoded.split("\n");
				let diagnostics: vscode.Diagnostic[] = [];
				let filename = textDocument.fileName.replace(/^.*[\\\/]/, '');
				console.log(filename);
				if (this.changeWatcher != null) {
					this.changeWatcher.dispose();
				}

				messages.forEach(message => {
					console.log(message);
					this.outputChannel.append(message);
					//  let oldregex = new RegExp("(.*?)\\(([0-9]+),([0-9]+)\\)\\s:\\serror\\s.*?:(\\s.*'(.*)'.*)|(\\(Location of symbol related to previous error.\\))")

					let regex = new RegExp("(.*?)\\((?:([0-9]+)|([0-9]+),([0-9]+))\\)\\s:\\serror\\s.*?:(?:(\\s.*'(.*)'.*)|(\\(Location of symbol related to previous error.\\))|(.+))")

					// 1 - path
					// 2/3 - row
					// 4 - col
					// 5 - possible errormessage
					// 6 - possible errorword
					// 7 - other possible errormessage
					// 8 - unknown error message

					let result = regex.exec(message);
					if (result == null || result[1].replace(/^.*[\\\/]/, '') != filename) {
						return;
					}
					console.log(result);
					let relevant = message.substr(message.indexOf(filename) + filename.length + 1);
					let row = result[2] || result[3];
					let column = result[4];
					let errmsg = result[5] || result[7] || result[8];
					let errword = result[6];
					let position = new vscode.Position(+row - 1, +column - 1);
					let range = null;
					let text = "";
					//try finding error word at given position
					if (errword != null) {
						range = new vscode.Range(+row - 1, +column - 1, +row - 1, +column + errword.length - 1);
						text = textDocument.getText(range)
					}

					//try finding any word at given position if error word is not found
					if (text != errword) {
						range = textDocument.getWordRangeAtPosition(position);
						if (range == null) {
							range = new vscode.Range(+row - 1, +column - 1, +row - 1, +column)
						}
					}

					let severity = vscode.DiagnosticSeverity.Warning;

					let diagnostic = new vscode.Diagnostic(range, errmsg, severity);
					diagnostics.push(diagnostic);

				})

				this.diagnosticCollection.set(textDocument.uri, diagnostics);
				setTimeout(() => {
					this.changeWatcher = vscode.workspace.onDidChangeTextDocument(() => {
						this.diagnosticCollection.clear()
						console.log("test");
					}, this);
				}, 2000)
			});


			this.childProcess.on('exit', (code) => {
				this.lock = false;
				switch (code) {
					case -1:
						this.outputChannel.append("\n=== VCC was canceled. ===");
						break;
					case 0:
						this.outputChannel.append("\n=== Verification succeeded. ===");
						break;
					case 2:
						this.outputChannel.append("Incorrect commandline arguments were used.");
						this.outputChannel.append("\n=== Verification failed. ===\n");
						break;
					case 1:
					case 3:
						this.outputChannel.append("\n=== Verification failed. ===");
						break;
					default:
						this.outputChannel.append("\n=== VCC finished with unknown exitcode. ===");
						break;
				}
			});
		}
	}
}
