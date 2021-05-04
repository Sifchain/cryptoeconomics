import moment from 'moment';
import { START_DATETIME } from './config'

export const timestampToDate = timestamp => {
  const start = moment.utc(START_DATETIME)
  const date = start.add(timestamp, 'm')
  return date.toDate()
}
