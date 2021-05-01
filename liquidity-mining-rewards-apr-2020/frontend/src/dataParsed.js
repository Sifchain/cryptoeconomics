import data from './data.json';
import _ from 'lodash';

export const users = _.uniq(_.flatten(data.map(timestamp => Object.keys(timestamp.users))))
export const raw = data
export const rewardBucketsTimeSeries = data.map((timestampData, timestamp) => {
  const rewardBuckets = timestampData.rewardBuckets
  const totalCurrentRowan = _.sum(rewardBuckets.map(b=>b.rowan))
  const totalInitialRowan = _.sum(rewardBuckets.map(b=>b.initialRowan))
  return {
    timestamp, totalCurrentRowan, totalInitialRowan
  }
}).slice(1)
