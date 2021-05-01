import { NUMBER_OF_INTERVALS_TO_RUN } from './config';
import './App.css';
import React from 'react';
import { raw, users } from './dataParsed';
import JSONPretty from 'react-json-pretty';
import 'react-json-pretty/themes/monikai.css';
import moment from 'moment';

class App extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      timestamp: 0,
      date: moment.utc('2021-02-19T05:00').format("MMMM Do YYYY, h:mm:ss a"),
      address: 'all'
    };

    this.updateAddress = this.updateAddress.bind(this);
    this.updateTimestamp = this.updateTimestamp.bind(this);
  }

  updateAddress(event) {
    this.setState({
      address: event.target.value,
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
            min="0" max={NUMBER_OF_INTERVALS_TO_RUN - 1}
            value={this.state.timestamp}
            onChange={this.updateTimestamp}
            step="1" />

        </header>
        <div className='content'>
          <JSONPretty id="json-pretty" data={data}></JSONPretty>
        </div>
      </div >
    );
  }
}

export default App;
