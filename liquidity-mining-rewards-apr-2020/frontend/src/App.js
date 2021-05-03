import { NUMBER_OF_INTERVALS_TO_RUN, START_DATETIME } from './config';
import { getUserData } from './utils'
import './App.css';
import React from 'react';
import {
  rawAugmented, users,
} from './dataParsed';
import JSONPretty from 'react-json-pretty';
import 'react-json-pretty/themes/monikai.css';
import moment from 'moment';
import Chart from './Chart'
import StackAll from './StackAll'

class App extends React.Component {

  constructor(props) {
    super(props);


    this.state = {
      timestamp: 0,
      date: moment.utc(START_DATETIME).format("MMMM Do YYYY, h:mm:ss a"),
      address: 'all',
    };

    this.updateAddress = this.updateAddress.bind(this);
    this.updateTimestamp = this.updateTimestamp.bind(this);
  }

  updateAddress(event) {
    const address = event.target.value
    this.setState({
      address,
      timeseriesDataSet: getUserData(rawAugmented, address),
    });
  }

  updateTimestamp(event) {
    const timestamp = parseInt(event.target.value)
    const minutes = timestamp * 200;
    const date = moment.utc(START_DATETIME).add(minutes, 'm').format("MMMM Do YYYY, h:mm:ss a");
    this.setState({
      date,
      timestamp
    });
  }


  render() {
    const timestampGlobalState = rawAugmented[this.state.timestamp + 1];
    const data = this.state.address === 'all' ? timestampGlobalState :
      {
        ...timestampGlobalState,
        users: undefined,
        user: timestampGlobalState.users[this.state.address]
      }
    return (
      <div className="App" >
        <header className="App-header">
          Address to show: <select value={this.state.address} onChange={this.updateAddress}>
            <option key={'all'} value={'all'}>All</option>
            {users.sort().map(user => <option key={user} value={user}>{user}</option>)}
          </select>

        </header>
        <div className='content'>
          {this.state.address === 'all' && <StackAll />}
          {this.state.address !== 'all' &&
            <Chart data={this.state.timeseriesDataSet} />}
          {this.state.address !== 'all' &&
            <div className="timestamp-slider-description">Timestamp: {this.state.date} </div>}
          {this.state.address !== 'all' && <input
            id="timestamp"
            className="timestamp-slider"
            type="range"
            min="0" max={NUMBER_OF_INTERVALS_TO_RUN}
            value={this.state.timestamp}
            onChange={this.updateTimestamp}
            step="1" />}
          {this.state.address !== 'all' && <JSONPretty id="json-pretty" data={data}></JSONPretty>}
        </div>
      </div >
    );
  }
}

export default App;
