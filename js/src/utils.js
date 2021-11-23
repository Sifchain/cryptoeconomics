import moment from 'moment';
import serverConfigs from './serverConfig';
const serverConfig =
  serverConfigs[
    window.sessionStorage.getItem('rewardProgram') ||
      Object.keys(serverConfigs)[0]
  ] || serverConfigs[Object.keys(serverConfigs)[0]];
export const timestampToDate = (timestamp) => {
  const start = moment.utc(serverConfig.START_DATETIME);
  const date = start.add(timestamp, 'm');
  return date.toDate();
};
