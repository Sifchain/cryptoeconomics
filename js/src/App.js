import { START_DATETIME } from './config';
import './App.css';
import React from 'react';
import { fetchUsers, fetchUserData, fetchUserTimeSeriesData } from './api';
import JSONPretty from 'react-json-pretty';
import 'react-json-pretty/themes/monikai.css';
import moment from 'moment';
import DataChart from './DataChart';
import DataStackAll from './DataStackAll';
import { StatBlocks } from './StatBlocks';
import { UserDataSummary } from './UserDataSummary';

const DATE_FORMAT = 'MMMM Do YYYY [at] h:mm';

// show all fields locally
const SHOULD_HIDE_NON_USER_FRIENDLY_FIELDS = !!process.env
  .REACT_APP_DEPLOYMENT_TAG;

const userFieldsToHide = [
  'reservedReward',
  'nextRewardShare',
  'ticketAmountAtMaturity',
  'yieldAtMaturity',
  'nextReward',
  'nextRewardProjectedFutureReward',
  'yearsToMaturity',
  'currentAPYOnTickets'
];

const debounce = (fn, ms) => {
  let t = setTimeout(() => {}, 0);
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => {
      fn(...args);
    }, ms);
  };
};
// const now = moment.utc(Date.parse(new Date()));
// function initTimestamp() {
//   return moment.duration(now.diff(START_DATETIME)).asMinutes() / 200;
// }

class App extends React.Component {
  constructor (props) {
    super(props);

    const [address, type] = window.location.hash.substr(1).split('&type=');
    this.state = {
      timestamp: 0,
      date: moment.utc(new Date()),
      address: address || undefined,
      type: type || 'lm',
      dataDisplayPoints: [],
      userData: null,
      bulkUserData: null
    };

    this.updateAddressEvent = this.updateAddressEvent.bind(this);
    this.updateAddress = this.updateAddress.bind(this);
    this.updateTimestamp = this.updateTimestamp.bind(this);
    this.updateType = this.updateType.bind(this);
    this.updateAddress(this.state.address);
  }

  initDateTime () {
    const now = moment.utc(Date.parse(new Date()));
    this.setState({
      date: moment.utc(now),
      timestamp: Math.floor(
        moment.duration(now.diff(moment.utc(START_DATETIME))).asMinutes() / 200
      )
    });
  }

  componentDidMount () {
    fetchUsers('lm').then(usersLM => this.setState({ usersLM }));
    fetchUsers('vs').then(usersVS => this.setState({ usersVS }));
    this.initDateTime();
  }

  updateAddressEvent (event) {
    const address = event.target.value;
    this.updateAddress(address);
  }

  updateAddress (address) {
    window.history.pushState(
      undefined,
      '',
      `#${address || ''}&type=${this.state.type}`
    );
    if (address !== 'leaderboard' && address !== undefined) {
      fetchUserTimeSeriesData(address, this.state.type).then(
        userTimeSeriesData => this.setState({ userTimeSeriesData })
      );
      fetchUserData(address, this.state.type, this.state.date.valueOf()).then(
        userData => {
          this.setState({
            userData
          });
        }
      );
      fetchUserData(address, this.state.type).then(bulkUserData => {
        this.setState({
          bulkUserData
        });
      });
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
    const dateObj = moment
      .utc(START_DATETIME)
      .add(minutes, 'm')
      .utc(false);
    const date = dateObj;
    this.setState({
      date,
      timestamp,
      userData: null
    });
    const address = this.state.address;
    if (address && address.startsWith('sif')) {
      if (this.state.bulkUserData) {
        this.setState({
          userData: this.state.bulkUserData[this.state.timestamp]
        });
      } else {
        if (this.debouncedTimestampTimeout !== undefined) {
          clearTimeout(this.debouncedTimestampTimeout);
        }
        this.debouncedTimestampTimeout = setTimeout(() => {
          fetchUserData(
            address,
            this.state.type,
            this.state.date.valueOf()
          ).then(userData =>
            this.setState({
              userData
            })
          );
        }, 500);
      }
    }
  }

  updateType (type) {
    window.history.pushState(undefined, '', `#&type=${type}`);
    this.setState({
      type,
      address: undefined
    });
  }

  getCurrentUsers () {
    return this.state.type === 'lm' ? this.state.usersLM : this.state.usersVS;
  }

  render () {
    if (!this.state.usersLM || !this.state.usersVS) {
      return (
        <div className='loading-screen'>
          <div className='logo-loader'>
            <img src='Sifchain-logo-gold.svg' />
            <div className='logo-loader-overlay' />
          </div>
        </div>
      );
    }
    const users = this.getCurrentUsers();

    let userTimestampJSON = '';
    const userData =
      this.state.userData ||
      (this.state.bulkUserData
        ? this.state.bulkUserData[this.state.address + '']
        : null);
    if (userData) {
      const data = userData;
      userTimestampJSON = !SHOULD_HIDE_NON_USER_FRIENDLY_FIELDS
        ? data
        : !data
        ? null
        : Object.fromEntries(
            Object.entries(data).filter(([key, val]) => {
              return !userFieldsToHide.includes(key);
            })
          );
      console.log(data, userTimestampJSON);
    }

    let addressInputRef = React.createRef();
    let addressSelectRef = React.createRef();
    const clearInput = () => {
      addressInputRef.current.value = '';
      addressSelectRef.current.value = '';
    };

    const timeSeriesData = this.state.userTimeSeriesData;

    const isLoading =
      (this.state.address !== 'leaderboard' &&
        this.state.address !== undefined &&
        !timeSeriesData) ||
      (!!this.state.address && !userTimestampJSON);

    return (
      <div className='App'>
        <header className='App-header'>
          <div className='logo-container'>
            <img
              className={`${isLoading ? 'loading' : ''}`}
              src='sifchain-s.svg'
            />
          </div>
          <div
            style={{ width: '100%', display: 'flex', flexDirection: 'row' }}
            className='tab-group'
          >
            <div
              onClick={e => {
                this.updateType('lm');
                clearInput();
              }}
              className={['tab', this.state.type === 'lm' ? 'active' : ''].join(
                ' '
              )}
            >
              Liquidity Pool Mining Rewards
            </div>
            <div
              onClick={e => {
                this.updateType('vs');
                clearInput();
              }}
              className={['tab', this.state.type === 'vs' ? 'active' : ''].join(
                ' '
              )}
            >
              Validator Staking & Delegating Rewards
            </div>
          </div>
          <div className='select-container'>
            <div className='address-container'>
              <div className='dropdown-container'>
                <select
                  onInput={e => {
                    this.updateAddressEvent(e);
                    if (
                      addressInputRef.current.value !== e.currentTarget.value
                    ) {
                      addressInputRef.current.value = e.currentTarget.value;
                    }
                  }}
                  ref={addressSelectRef}
                  style={{ display: 'block' }}
                  value=''
                  className='dropdown'
                >
                  <option key='none' value=''>
                    Select
                  </option>
                  {
                    <option key='leaderboard' value='leaderboard'>
                      Leaderboard
                    </option>
                  }
                  {users.sort().map(user => (
                    <option key={user} value={user}>
                      {user}
                    </option>
                  ))}
                </select>

                <input
                  autoComplete='off'
                  ref={addressInputRef}
                  defaultValue={this.state.address}
                  list='address-search'
                  name='address-search'
                  placeholder='Search or Select a Sif Address'
                  className='dropdown'
                  onChange={debounce(e => {
                    if (e.target.value !== this.state.address) {
                      let isValid = users.includes(e.target.value);
                      if (isValid) this.updateAddressEvent(e);
                    }
                  }, 500)}
                  onBlur={e => {
                    if (e.target.value !== this.state.address) {
                      this.updateAddressEvent(e);
                    }
                  }}
                  spellCheck={false}
                />
                <datalist id='address-search'>
                  {users.map(user => (
                    <option key={user} value={user}>
                      {user}
                    </option>
                  ))}
                </datalist>
                <button onClick={e => clearInput()} className='clear-input-btn'>
                  clear
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className='content'>
          {this.state.address === 'leaderboard' && (
            <DataStackAll type={this.state.type} />
          )}
          {this.state.address !== 'leaderboard' &&
            this.state.address !== undefined &&
            !timeSeriesData && (
              <div style={{ color: 'turquoise' }}>Loading Rewards...</div>
            )}
          {this.state.address !== 'leaderboard' &&
            this.state.address !== undefined &&
            timeSeriesData && <DataChart data={timeSeriesData} />}

          {this.state.address !== 'leaderboard' &&
            this.state.address !== undefined &&
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
          {this.state.address !== 'leaderboard' &&
            this.state.address !== undefined && (
              <div className='timestamp-slider-description'>
                {this.state.date.format(DATE_FORMAT)}
              </div>
            )}

          {this.state.address !== 'leaderboard' &&
          this.state.address !== undefined ? (
            <UserDataSummary
              user={userTimestampJSON.user}
              type={this.state.type}
            />
          ) : null}

          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'stretch',
              justifyContent: 'flex-start',
              flexWrap: 'wrap'
            }}
          >
            {' '}
            {this.state.address !== 'leaderboard' &&
            this.state.address !== undefined &&
            userTimestampJSON &&
            userTimestampJSON.user
              ? Object.entries(userTimestampJSON.user).map(
                  ([key, statNumVal]) => {
                    const block = StatBlocks[this.state.type][key];
                    if (!block || !block.shouldDisplay(statNumVal)) return null;
                    return (
                      <div key={block.title} className='stat-card'>
                        <div className='stat-subtitle'>{block.subtitle}</div>
                        <div className='stat-title'>{block.title}</div>
                        <div className='stat-data'>
                          {block.prefix}
                          {block.data(statNumVal)}
                          {block.suffix}
                        </div>
                      </div>
                    );
                  }
                )
              : null}
          </div>

          {this.state.address !== 'leaderboard' &&
          this.state.address !== undefined ? (
            <details className='metadata-container'>
              <summary>JSON Metadata</summary>
              <JSONPretty
                className='json-metadata'
                id='json-pretty'
                data={userTimestampJSON}
              />
            </details>
          ) : null}
          {this.state.type === 'vs' ? (
            <div className='info-text'>
              Learn more about Sifchain Validator Staking & Delegation{' '}
              <a
                target='_blank'
                rel='noopener noreferrer'
                href='https://docs.sifchain.finance/roles/validators'
              >
                here
              </a>
              .
            </div>
          ) : (
            <div className='info-text'>
              Learn more about Sifchain Liquidity Pooling{' '}
              <a
                target='_blank'
                rel='noopener noreferrer'
                href='https://docs.sifchain.finance/roles/liquidity-providers'
              >
                here
              </a>
              .
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default App;
