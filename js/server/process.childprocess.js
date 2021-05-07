if (process.env.NODE_ENV === 'development') {
	require('dotenv').config();
}
const fs = require('fs');
const {
	loadLiquidityMinersSnapshot,
} = require('./loaders/loadLiquidityMinersSnapshot');
const { loadValidatorsSnapshot } = require('./loaders/loadValidatorsSnapshot');
const { getProcessedLMData, getProcessedVSData } = require('./process');
const { getUserData, getUserTimeSeriesData } = require('./user');

/* 
  Reloads & re-processes Miner & Validator data once every `RELOAD_INTERVAL`
*/
const RELOAD_INTERVAL = 10 * 60 * 1000;
// processing time included to ensure data has been processed by time client reloads
const PROCESSING_TIME = 60 * 1000;

const LOCAL_ONLY_DEV_MODE = process.env.NODE_ENV == 'development' && true;
// temp file. Do not access outside this function. Deleted before exit
const outputFilePath = `/tmp/cryptoecon-processing-result-${Date.now()}.json`;

process.on('beforeExit', () => fs.unlinkSync(outputFilePath));

class BackgroundProcessor {
	constructor() {
		// Set in this#reloadAndReprocessOnLoop
		this.lmDataParsed = null;
		this.vsDataParsed = null;
	}

	/* 
    ACTIONS INVOKABLE FROM `./MAIN.JS` via `processingHandler#dispatch(...)`
  */
	get actions() {
		return {
			CHECK_IF_PARSED_DATA_READY: () => {
				return !!this.lmDataParsed && !!this.vsDataParsed;
			},
			// LM DATA ACTIONS
			GET_LM_KEY_VALUE: (key) => {
				return this.lmDataParsed[key];
			},
			GET_LM_USER_TIME_SERIES_DATA: (address) => {
				return getUserTimeSeriesData(this.lmDataParsed.processedData, address);
			},
			GET_LM_USER_DATA: (address) => {
				return getUserData(this.lmDataParsed.processedData, address);
			},
			GET_LM_STACK_DATA: () => {
				return this.lmDataParsed.stackClaimableRewardData;
			},

			// VS DATA ACTIONS
			GET_VS_KEY_VALUE: (key) => {
				return this.vsDataParsed[key];
			},
			GET_VS_USER_TIME_SERIES_DATA: (address) => {
				return getUserTimeSeriesData(this.vsDataParsed.processedData, address);
			},
			GET_VS_USER_DATA: ({ address, timeIndex }) => {
				return getUserData(this.vsDataParsed.processedData, address, timeIndex);
			},
			GET_VS_STACK_DATA: () => {
				return this.vsDataParsed.stackClaimableRewardData;
			},
		};
	}

	async listenForParentThreadInvokations() {
		process.on('message', async (msg) => {
			if (
				typeof msg != 'object' ||
				msg.action != 'invoke' ||
				!msg.payload ||
				!this.actions[msg.payload.fn]
			)
				return;
			try {
				const out = this.actions[msg.payload.fn](...msg.payload.args);
				process.send({
					action: 'return',
					payload: {
						id: msg.payload.id,
						out,
					},
				});
			} catch (e) {
				console.error(e);
			}
		});
	}
	async reloadAndReprocessOnLoop() {
		if (LOCAL_ONLY_DEV_MODE) {
			console.log('LOCAL_ONLY_DEV_MODE enabled! Will not refresh or reprocess snapshots!')
		}
		try {
			const [lMSnapshot, vsSnapshot] = LOCAL_ONLY_DEV_MODE ? [
				require("../snapshots/snapshot_lm_latest.json"),
				require("../snapshots/snapshot_vs_latest.json")
			] : await Promise.all([
				loadLiquidityMinersSnapshot(),
				loadValidatorsSnapshot(),
			]);
			delete this.lmDataParsed;
			console.time('getProcessedLMData');
			this.lmDataParsed = getProcessedLMData(lMSnapshot);
			console.timeEnd('getProcessedLMData');
			console.time('getProcessedVSData')
			this.vsDataParsed = getProcessedVSData(vsSnapshot);
			console.timeEnd('getProcessedVSData')
		} catch (e) {
			console.error(e);
		}
	 	if (!LOCAL_ONLY_DEV_MODE) setTimeout(this.reloadAndReprocessOnLoop.bind(this), RELOAD_INTERVAL);
	}

	static start() {
		const instance = new this();
		instance.reloadAndReprocessOnLoop();
		instance.listenForParentThreadInvokations();
	}
}
BackgroundProcessor.start();

// Async JSON Serialization, if remiplementation is desired in future
// const saveJson = async (data) => {
//   await require('bfj').write(outputFilePath, data, {
//     Promise,
//     bufferLength: 512,
//     yieldRate: 500
//   })
//   console.log('finished!!!');
//   process.send(outputFilePath);
//   console.log('wrote file ' + outputFilePath)
// }
