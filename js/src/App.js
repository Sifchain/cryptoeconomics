import { START_DATETIME } from './config';
import './App.css';
import React from 'react';
import { fetchUsers, fetchUserData, fetchUserTimeSeriesData } from './api';
import JSONPretty from 'react-json-pretty';
import 'react-json-pretty/themes/monikai.css';
import moment from 'moment';
import Chart from './Chart';
import StackAll from './StackAll';

class App extends React.Component {
  constructor (props) {
    super(props);

    const [address, type] = window.location.hash.substr(1).split('&type=');
    this.state = {
      timestamp: 0,
      date: moment.utc(START_DATETIME).format('MMMM Do YYYY, h:mm:ss a'),
      address: address || 'none',
      type: type || 'lm'
    };

    this.updateAddressEvent = this.updateAddressEvent.bind(this);
    this.updateAddress = this.updateAddress.bind(this);
    this.updateTimestamp = this.updateTimestamp.bind(this);
    this.updateType = this.updateType.bind(this);
    this.updateAddress(this.state.address);
  }

  componentDidMount () {
    fetchUsers('lm').then(usersLM => this.setState({ usersLM }));
    fetchUsers('vs').then(usersVS => this.setState({ usersVS }));
  }

  updateAddressEvent (event) {
    const address = event.target.value;
    this.updateAddress(address);
  }

  updateAddress (address) {
    window.history.pushState(
      undefined,
      '',
      `#${address}&type=${this.state.type}`
    );
    if (address !== 'all' && address !== 'none') {
      fetchUserTimeSeriesData(address, this.state.type).then(
        userTimeSeriesData => this.setState({ userTimeSeriesData })
      );
      fetchUserData(address, this.state.type).then(userData =>
        this.setState({ userData })
      );
    }
    this.setState({
      address,
      userData: undefined,
      userTimeSeriesData: undefined
    });
  }

  updateTimestamp (event) {
    const timestamp = parseInt(event.target.value);
    const minutes = timestamp * 200;
    const date = moment
      .utc(START_DATETIME)
      .add(minutes, 'm')
      .format('MMMM Do YYYY, h:mm:ss a');
    this.setState({
      date,
      timestamp
    });
  }

  updateType (event) {
    const type = event.target.value;
    window.history.pushState(undefined, '', `#none&type=${this.state.type}`);
    this.setState({
      type,
      address: 'none'
    });
  }

  render () {
    if (!this.state.usersLM || !this.state.usersVS) {
      return <div>Loading...</div>;
    }
    const users =
      this.state.type === 'lm' ? this.state.usersLM : this.state.usersVS;
    const userTimestampJSON = this.state.userData
      ? this.state.userData[this.state.timestamp + 1]
      : 'Loading...';
    const timeSeriesData = this.state.userTimeSeriesData;
    return (
      <div className='App'>
        <header className='App-header'>
          <div className='radios'>
            <label>
              <input
                type='radio'
                value='lm'
                onChange={e => this.updateType(e)}
                checked={this.state.type === 'lm'}
              />
              Liquidity Pooling Rewards
            </label>
            <label>
              <input
                type='radio'
                value='vs'
                onChange={e => this.updateType(e)}
                checked={this.state.type === 'vs'}
              />
              Validator Staking/Delegating Rewards
            </label>
          </div>
          Address to show:{' '}
          <select
            value={this.state.address}
            onChange={e => this.updateAddressEvent(e)}
          >
            <option key='none' value='none'>
              None
            </option>
            {
              <option key='all' value='all'>
                Top 50
              </option>
            }
            {users.sort().map(user => (
              <option key={user} value={user}>
                {user}
              </option>
            ))}
          </select>
        </header>
        <div className='content'>
          {this.state.address === 'all' && <StackAll type={this.state.type} />}
          {this.state.address !== 'all' &&
            this.state.address !== 'none' &&
            !timeSeriesData && <div>Loading...</div>}
          {this.state.address !== 'all' &&
            this.state.address !== 'none' &&
            timeSeriesData && <Chart data={timeSeriesData} />}
          {this.state.address !== 'all' && this.state.address !== 'none' && (
            <div className='timestamp-slider-description'>
              Timestamp: {this.state.date}{' '}
            </div>
          )}
          {this.state.address !== 'all' &&
            this.state.address !== 'none' &&
            timeSeriesData && (
              <input
                id='timestamp'
                className='timestamp-slider'
                type='range'
                min='0'
                max={timeSeriesData.length - 1}
                value={this.state.timestamp}
                onChange={e => this.updateTimestamp(e)}
                step='1'
              />
            )}
          {this.state.address !== 'all' && this.state.address !== 'none' && (
            <JSONPretty id='json-pretty' data={userTimestampJSON} />
          )}
        </div>
      </div>
    );
  }
}

export default App;
