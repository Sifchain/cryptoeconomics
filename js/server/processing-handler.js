const { fork } = require('child_process');

// Provides #dispatch method by which the express router endpoints can interact with processed data
function createProcessingHandler() {
	let didExit = false;
	let didError = false;
	const childProcess = fork(`${__dirname}/process.childprocess.js`); //the first argument to fork() is the name of the js file to be run by the child process

	childProcess.on('error', (e) => {
		didError = true;
		console.error(e);
	});
	childProcess.on('exit', (code) => {
		didExit = true;
		if (code !== 0) {
			console.error(new Error(`Child processs stopped with exit code ${code}`));
		}
	});
	async function dispatch(method, payload) {
		const invokationId = Math.random().toString();
		childProcess.send({
			action: 'invoke',
			payload: {
				fn: method,
				args: [payload],
				id: invokationId,
			},
		});
		return new Promise((r, rj) => {
			const handler = async (msg) => {
				if (typeof msg != 'object' || msg.action !== 'return' || !msg.payload)
					return;
				if (msg.payload.id !== invokationId) return;
				r(msg.payload.out);
				childProcess.off('message', handler);
			};
			childProcess.on('message', handler);
		});
	}
	async function waitForReadyState() {
		return new Promise(async (r, rj) => {
			while (true) {
				let isReady = await dispatch('CHECK_IF_PARSED_DATA_READY');
				if (didError) rj('errored');
				if (didExit) rj('exited');
				if (isReady) return r(true);
				await new Promise((r) => setTimeout(r, 100));
			}
		});
	}
	return {
		// Remotely invokes child process actions in `./process.childprocess.js` `BackgroundProcessor#actions`
		async dispatch(method, payload) {
			await waitForReadyState();
			return dispatch(method, payload);
		},
	};
}

module.exports = {
	createProcessingHandler,
};
