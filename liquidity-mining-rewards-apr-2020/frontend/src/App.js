import { NUMBER_OF_INTERVALS_TO_RUN } from './config';
import './App.css';
import React from 'react';
import { raw, users } from './dataParsed';
import JSONPretty from 'react-json-pretty';
import 'react-json-pretty/themes/monikai.css';
import moment from 'moment';
import Chart from './Chart'
import { rewardBucketsTimeSeries } from './dataParsed';
import _ from 'lodash';

const totalInitialRowan = rewardBucketsTimeSeries[0].totalInitialRowan
const xFunc = d => d.timestamp
const addressYFunc = d => d.userClaimableAmount
const bucketYFunc = d => totalInitialRowan - d.totalCurrentRowan

class App extends React.Component {

  constructor(props) {
    super(props);


    this.state = {
      timestamp: 0,
      date: moment.utc('2021-02-19T05:00').format("MMMM Do YYYY, h:mm:ss a"),
      address: 'all',
      timeseriesDataSet: rewardBucketsTimeSeries,
      'xFunc': xFunc,
      'yFunc': bucketYFunc
    };

    this.updateAddress = this.updateAddress.bind(this);
    this.updateTimestamp = this.updateTimestamp.bind(this);
  }

  updateAddress(event) {
    const address = event.target.value
    this.setState({
      address,
      timeseriesDataSet: address === 'all' ? rewardBucketsTimeSeries : (
        getUserData(raw, address)
      ),
      'xFunc': xFunc,
      'yFunc': address === 'all' ? bucketYFunc : addressYFunc,
    });
  }

  updateTimestamp(event) {
    const timestamp = parseInt(event.target.value)
    const minutes = timestamp * 200;
    const date = moment.utc('2021-02-19T05:00').add(minutes, 'm').format("MMMM Do YYYY, h:mm:ss a");
    this.setState({
      date,
      timestamp
    });
  }


  render() {
    const timestampGlobalState = raw[this.state.timestamp + 1];
    const data = this.state.address === 'all' ? timestampGlobalState : timestampGlobalState.users[this.state.address]
    return (
      <div className="App" >
        <header className="App-header">
          Address to show: <select value={this.state.address} onChange={this.updateAddress}>
            <option key={'all'} value={'all'}>All</option>
            {users.sort().map(user => <option key={user} value={user}>{user}</option>)}
          </select>
          Timestamp: {this.state.date}
          <input
            id="timestamp"
            type="range"
            min="0" max={NUMBER_OF_INTERVALS_TO_RUN}
            value={this.state.timestamp}
            onChange={this.updateTimestamp}
            step="1" />

        </header>
        <div className='content'>
          <Chart xFunc={this.state.xFunc} yFunc={this.state.yFunc} data={this.state.timeseriesDataSet} />
          <JSONPretty id="json-pretty" data={data}></JSONPretty>
        </div>
      </div >
    );
  }
}

export default App;


function getUserData(all, address) {
  return all.map((timestampData, timestamp) => {
    const userData = timestampData.users[address] || { tickets: [], claimedReward: 0 };
    const userClaimableAmount = userData.claimedReward + _.sum(userData.tickets.map(t => t.reward * t.multiplier))
    const userReservedAmount = userData.claimedReward + _.sum(userData.tickets.map(t => t.reward * 1))
    return {
      timestamp, userClaimableAmount, userReservedAmount
    }
  }).slice(1)
}
