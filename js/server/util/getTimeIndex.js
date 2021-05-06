const moment = require("moment")
const { START_DATETIME } = require("../config");

function getTimeIndex( timestampFromClient ) {
	if(!timestampFromClient) { return }
	if (timestampFromClient === "now") { nowMoment = moment(Date.parse(new Date())) }
	else { nowMoment = moment(timestampFromClient) }
	return Math.floor(moment.duration(nowMoment.diff(START_DATETIME)).asMinutes()/200)
} 

module.exports = {
  getTimeIndex
}
