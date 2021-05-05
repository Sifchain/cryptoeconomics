import { START_DATETIME } from './config';
import './App.css';
import React from 'react';
import {
  fetchUsers, fetchUserData, fetchUserTimeSeriesData
} from './api';
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
      address: window.location.hash.substr(1) || 'all',
      addressFilter: '',
    };

    this.updateAddressEvent = this.updateAddressEvent.bind(this);
    this.updateAddress = this.updateAddress.bind(this);
    this.updateTimestamp = this.updateTimestamp.bind(this);
    this.updateAddress(this.state.address)
  }

  componentDidMount() {
    fetchUsers().then(users => this.setState({ users }));
  }

  updateAddressEvent(event) {
    const address = event.target.value
    this.updateAddress(address)
  }
  updateAddress(address) {
    window.history.pushState(undefined, '', `#${address}`)
    if (address !== 'all') {
      fetchUserTimeSeriesData(address).then(userTimeSeriesData => this.setState({ userTimeSeriesData }));
      fetchUserData(address).then(userData => this.setState({ userData }));
    }
    this.setState({
      address,
      userData: undefined,
      userTimeSeriesData: undefined,
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
    if (!this.state.users) {
      return <div>Loading...</div>
    }
    const userTimestampJSON = this.state.userData ? this.state.userData[this.state.timestamp + 1] : 'Loading...'
    const usersFiltered = this.state.addressFilter ?
      this.state.users.filter(user => user.includes(this.state.addressFilter)) :
      this.state.users
    const timeSeriesData = this.state.userTimeSeriesData || []
    return (

      <div className="App" >
        <header className="App-header">
          Address to show: <select value={this.state.address} onChange={this.updateAddressEvent}>
            <option key={'all'} value={'all'}>All</option>
            {usersFiltered.sort().map(user => <option key={user} value={user}>{user}</option>)}
          </select>

        </header>
        <div className='content'>
          {this.state.address === 'all' && <StackAll users={this.state.users} />}
          {this.state.address !== 'all' && !timeSeriesData &&
            <div>Loading...</div>}
          {this.state.address !== 'all' && timeSeriesData &&
            <Chart data={timeSeriesData} />}
          {this.state.address !== 'all' &&
            <div className="timestamp-slider-description">Timestamp: {this.state.date} </div>}
          {this.state.address !== 'all' && <input
            id="timestamp"
            className="timestamp-slider"
            type="range"
            min="0" max={timeSeriesData.length - 1}
            value={this.state.timestamp}
            onChange={this.updateTimestamp}
            step="1" />}
          {this.state.address !== 'all' && <JSONPretty id="json-pretty" data={userTimestampJSON}></JSONPretty>}
        </div>
      </div >
    );
  }
}

export default App;
