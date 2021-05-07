if (process.env.NODE_ENV === 'development') {
	require('dotenv').config();
}
const express = require('express');
const cors = require('cors');

// implements process.js in separate thread
const { createProcessingHandler } = require('./processing-handler');
const processingHandler = createProcessingHandler();

const port = process.env.PORT || 3000;
const app = express();
app.use(cors());

app.listen(port, () => {
	console.log(`Server running on port ${port}`);
});

app.get('/status', (req, res, next) => {
	res.status(200).send({ status: 'OK' });
});

/* 
 TODO: Add timestamp parameter to endpoints 
  e.g. https://sif-cryptoecon-test.herokuapp.com/api?key=userData&address=sif1048c2lagwe84sz0sk4ncy2myrzxykjes40hn62with&timestamp=XYZ
*/
app.get('/api/lm', async (req, res, next) => {
	const key = req.query.key;
	let responseJSON;
	// switch/case
	switch (key) {
		case 'userTimeSeriesData': {
			const address = req.query.address;
			responseJSON = await processingHandler.dispatch(
				'GET_LM_USER_TIME_SERIES_DATA',
				address
			);
			break;
		}
		case 'userData': {
			const address = req.query.address;
			responseJSON = await processingHandler.dispatch(
				'GET_LM_USER_DATA',
				address
			);
			break;
		}
		case 'stack': {
			rewardData = await processingHandler.dispatch('GET_LM_STACK_DATA', null);
			responseJSON = { rewardData };
			break;
		}
		default: {
			responseJSON = await processingHandler.dispatch('GET_LM_KEY_VALUE', key);
		}
	}
	res.json(responseJSON);
});

app.get('/api/vs', async (req, res, next) => {
	const key = req.query.key;
	let responseJSON;
	// switch/case
	switch (key) {
		case 'userTimeSeriesData': {
			const address = req.query.address;
			responseJSON = await processingHandler.dispatch(
				'GET_VS_USER_TIME_SERIES_DATA',
				address
			);
			break;
		}
		case 'userData': {
			const address = req.query.address;
			responseJSON = await processingHandler.dispatch(
				'GET_VS_USER_DATA',
				address
			);
			break;
		}
		case 'stack': {
			rewardData = await processingHandler.dispatch('GET_VS_STACK_DATA', null);
			responseJSON = { rewardData };
			break;
		}
		default: {
			responseJSON = await processingHandler.dispatch('GET_VS_KEY_VALUE', key);
		}
	}
	res.json(responseJSON);
});
