import { workspace, commands, window, InputBoxOptions, ExtensionContext, Disposable } from 'vscode';

import VCCLinter from './vccLinter';

export function activate(context: ExtensionContext) {
	let linter = new VCCLinter(context.subscriptions);
	registerCommandListeners(linter, context.subscriptions);
}

function registerCommandListeners(linter: VCCLinter, subscriptions: Disposable[]) {
	subscriptions.push(commands.registerCommand('vcclinter.verify', function () {
		linter.checkAutoSaveAndVerify([''])
	}));

	subscriptions.push(commands.registerCommand('vcclinter.verifyWithoutIncludes', function () {
		linter.checkAutoSaveAndVerify(['/ii']);
	}));

	subscriptions.push(commands.registerCommand('vcclinter.verifyThis', function () {
		linter.checkAutoSaveAndVerify(['/loc:' + window.activeTextEditor.document.fileName + ':' + ((+window.activeTextEditor.selection.active.line) + 1)]);
	}));

	subscriptions.push(commands.registerCommand('vcclinter.reVerify', function () {
		linter.reVerify();
	}));

	subscriptions.push(commands.registerCommand('vcclinter.customVerify', function () {
		let options: InputBoxOptions = {
			prompt: "Enter your VCC parameters",    // <- Der Hilfstext der unter dem Eingabefeld erscheinen soll.
			value: "/bvd",                                // <- Der Text der schon im Eingabefeld voreingestellt sein soll. REPLACE MIT CONFIG later
			placeHolder: "VCC Parameters"                        // <- Ein Text, der ausgegraut im Eingabefeld angezeigt wird.
		}
		window.showInputBox(options).then((input) => {
			linter.checkAutoSaveAndVerify(input.split(" "), true)
		});

	}));
	subscriptions.push(commands.registerCommand('vcclinter.cancel', function () {
		linter.cancel();
	}));
	subscriptions.push(commands.registerCommand('vcclinter.watch', function () {
		linter.watch();
	}));

	subscriptions.push(commands.registerCommand('vcclinter.watchStop', function () {
		linter.stopWatch();
	}));

	subscriptions.push(commands.registerCommand('vcclinter.showErrorModel', function (file) {
		if (file == null) {

			window.showInformationMessage('Command \'Show Error Model\' is not enabled in the current context.');
		} else {
			linter.showErrorModel(file.fsPath);
		}
	}));


	subscriptions.push(commands.registerCommand('vcclinter.showLastErrorModel', function () {
		linter.showErrorModel();
	}));

	subscriptions.push(commands.registerCommand('vcclinter.help', function () {
		linter.help();
	}));
}
