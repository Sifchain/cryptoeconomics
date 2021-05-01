import data from './data.json';
import _ from 'lodash';

export const users = _.uniq(_.flatten(data.map(timestamp => Object.keys(timestamp.users))))
export const raw = data
