import moment from 'moment';
import serverConfigs from './serverConfig';
const serverConfig =
  serverConfigs[window.sessionStorage.getItem('rewardProgram') || 'harvest'];
export const timestampToDate = (timestamp) => {
  const start = moment.utc(serverConfig.START_DATETIME);
  const date = start.add(timestamp, 'm');
  return date.toDate();
};
