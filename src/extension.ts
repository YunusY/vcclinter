import * as vscode from 'vscode';

import VCCLintingProvider from './features/vccLintProvider';

export function activate(context: vscode.ExtensionContext) {
	console.log("ACTIVATED");
	console.log(vscode.workspace.getConfiguration('vcc'));
	console.log(vscode.workspace.getConfiguration('window'));
	console.log(vscode.window.activeTextEditor.document.languageId)
	
	let linter = new VCCLintingProvider(context.subscriptions);

	let disposable = vscode.commands.registerCommand('extension.vccVerify', function () {
		linter.verify(['']);
	});
	context.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand('extension.vccVerifyWithoutIncludes', function () {
		linter.verify(['/ii']);
	});
	context.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand('extension.vccVerifyThis', function () {
		linter.verify(['/loc:' + vscode.window.activeTextEditor.document.fileName + ':' + ((+vscode.window.activeTextEditor.selection.active.line) + 1)]);
	});
	context.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand('extension.vccReVerify', function () {
		linter.reVerify();
	});
	context.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand('extension.vccCustomVerify', function () {
		let options: vscode.InputBoxOptions = {
			prompt: "Enter your VCC parameters",    // <- Der Hilfstext der unter dem Eingabefeld erscheinen soll.
			value: "/bvd",                                // <- Der Text der schon im Eingabefeld voreingestellt sein soll. REPLACE MIT CONFIG later
			placeHolder: "VCC Parameters"                        // <- Ein Text, der ausgegraut im Eingabefeld angezeigt wird.
		}
		  vscode.window.showInputBox(options).then((input) => {
			  linter.verify(input.split(" "))
			});

	});
	context.subscriptions.push(disposable);


	disposable = vscode.commands.registerCommand('extension.vccWatch', function () {
		linter.watch();
	});
	context.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand('extension.vccWatchStop', function () {
		linter.stopWatch();
	});
	context.subscriptions.push(disposable);

}