import { START_DATETIME, networks, NETWORK_STORAGE_KEY } from './config';
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

const DATE_FORMAT = 'ddd MMMM Do YYYY[,] h:mm A';

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
      timeIndex: 0,
      nowTimeIndex: 0,
      date: moment.utc(new Date()),
      address: address || undefined,
      type: type || 'lm',
      dataDisplayPoints: [],
      userData: null,
      bulkUserData: null,
      network:
        window.localStorage.getItem(NETWORK_STORAGE_KEY) || networks.MAINNET,
      usersLM: [],
      usersVS: [],
      isLoadingLeaderboard: false
    };

    this.updateAddressEvent = this.updateAddressEvent.bind(this);
    this.updateAddress = this.updateAddress.bind(this);
    this.updateTimestamp = this.updateTimestamp.bind(this);
    this.updateType = this.updateType.bind(this);
    this.updateAddress(this.state.address);
  }

  getTimeIndex (time) {
    time = moment.utc(time);
    return (
      Math.floor(
        moment.duration(time.diff(moment.utc(START_DATETIME))).asMinutes() / 200
      ) + 1
    );
  }

  initDateTime () {
    const now = moment.utc(Date.now());
    const currentTimeIndex = this.getTimeIndex(now);
    this.setState({
      date: now,
      timeIndex: currentTimeIndex,
      nowTimeIndex: currentTimeIndex
    });
  }

  componentDidMount () {
    fetchUsers('lm').then(usersLM => this.setState({ usersLM }));
    fetchUsers('vs').then(usersVS => this.setState({ usersVS }));
    this.initDateTime();
  }

  updateNetwork (network) {
    window.localStorage.setItem(NETWORK_STORAGE_KEY, network);
    window.location.assign(`#&type=${this.state.type}`);
    window.location.reload();
    this.setState({
      network
    });
  }

  updateAddressEvent (event) {
    const address = event.target.value;
    this.updateAddress(address);
  }

  updateAddress (address) {
    address = address ? address.trim() : address;
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
      setTimeout(() => {
        fetchUserData(address, this.state.type).then(bulkUserData => {
          this.setState({
            bulkUserData
          });
        });
      }, 500);
    }
    this.setState({
      address,
      userData: undefined,
      userTimeSeriesData: undefined
    });
  }

  updateTimestamp (timeIndex) {
    const minutes = timeIndex * 200;
    const dateObj = moment
      .utc(START_DATETIME)
      .add(minutes, 'm')
      .utc();
    const date = dateObj;
    this.setState({
      date,
      timeIndex,
      userData: null
    });
    const address = this.state.address;
    if (address && address.startsWith('sif')) {
      if (this.state.bulkUserData) {
        this.setState({
          userData: this.state.bulkUserData[timeIndex]
        });
      } else {
        // if (this.debouncedTimestampTimeout !== undefined) {
        //   clearTimeout(this.debouncedTimestampTimeout);
        // }
        // this.debouncedTimestampTimeout = setTimeout(() => {
        //   fetchUserData(
        //     address,
        //     this.state.type,
        //     this.state.date.valueOf()
        //   ).then((userData) =>
        //     this.setState({
        //       userData,
        //     })
        //   );
        // }, 500);
      }
    }
  }

  updateType (type) {
    window.history.pushState(
      undefined,
      '',
      `#${this.state.address || ''}&type=${type}`
    );
    const users = this.getUsersByType(type);
    this.setState(
      {
        type
      },
      () => {
        this.updateAddress(
          this.state.address && users.includes(this.state.address)
            ? this.state.address
            : undefined
        );
      }
    );
  }

  getUsersByType (type) {
    return type === 'lm' ? this.state.usersLM : this.state.usersVS;
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
    const users = this.getUsersByType(this.state.type);

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
    };

    const clearInputIfAddressIncompatibile = nextType => {
      if (!this.getUsersByType(nextType).includes(this.state.address)) {
        clearInput();
      }
    };

    const timeSeriesData = this.state.userTimeSeriesData;

    const isLoadingUserData =
      this.state.address !== 'leaderboard' &&
      this.state.address !== undefined &&
      (!userTimestampJSON || !timeSeriesData);
    const isLoading = this.state.isLoadingLeaderboard || isLoadingUserData;

    return (
      <div className='App'>
        <header className='App-header'>
          <div className='logo-container'>
            <img
              className={`${isLoading ? 'loading' : ''}`}
              src='sifchain-s.svg'
            />
          </div>
          <div className='logo-network'>
            {this.state.network !== networks.MAINNET
              ? this.state.network
              : null}
          </div>
          <div
            style={{ width: '100%', display: 'flex', flexDirection: 'row' }}
            className='tab-group'
          >
            <div
              onClick={e => {
                this.updateType('lm');
                clearInputIfAddressIncompatibile('lm');
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
                clearInputIfAddressIncompatibile('vs');
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
            <DataStackAll
              onLoadingStateChange={state => {
                if (state !== this.state.isLoadingLeaderboard) {
                  this.setState({
                    isLoadingLeaderboard: state
                  });
                }
              }}
              type={this.state.type}
            />
          )}
          {this.state.address !== 'leaderboard' &&
            this.state.address !== undefined &&
            !timeSeriesData && (
              <div
                style={{
                  color: 'turquoise',
                  width: '100%',
                  textAlign: 'center'
                }}
              >
                Loading Rewards...
              </div>
            )}
          {this.state.address !== 'leaderboard' &&
            this.state.address !== undefined &&
            timeSeriesData && <DataChart data={timeSeriesData} />}

          {this.state.address !== 'leaderboard' &&
            this.state.address !== undefined &&
            timeSeriesData && (
              <div className='timestamp-slider'>
                <input
                  onDoubleClick={e =>
                    this.updateTimestamp(this.state.nowTimeIndex)
                  }
                  style={{ width: '100%' }}
                  id='timestamp'
                  type='range'
                  min='0'
                  max={timeSeriesData.length - 1}
                  value={this.state.timeIndex}
                  onChange={e => this.updateTimestamp(e.target.value)}
                  step='1'
                />
              </div>
            )}
          {this.state.address !== 'leaderboard' &&
            this.state.address !== undefined && (
              <div
                title={new Date(this.state.date.valueOf()).toString()}
                className='stat-card timestamp-slider-description'
              >
                <div className='timestamp-slider-description__title'>
                  {this.state.timeIndex < this.state.nowTimeIndex
                    ? 'Past Rewards'
                    : this.state.timeIndex > this.state.nowTimeIndex
                    ? 'Future Rewards'
                    : 'Current Rewards'}
                </div>
                <div className='timestamp-slider-description__datetime'>
                  {this.state.date.format(DATE_FORMAT) + ' UTC'}
                </div>
              </div>
            )}
          {false &&
            this.state.address !== 'leaderboard' &&
            this.state.address !== undefined &&
            timeSeriesData && (
              <div
                style={{
                  width: '100%',
                  textAlign: 'center'
                }}
              >
                <input
                  style={{
                    color: 'white',
                    background: 'black'
                  }}
                  type='number'
                  min='0'
                  max={timeSeriesData.length - 1}
                  value={this.state.timeIndex}
                  onChange={e => this.updateTimestamp(e.target.value)}
                  onInput={e => this.updateTimestamp(e.currentTarget.value)}
                  step='1'
                />
              </div>
            )}
          {this.state.address !== 'leaderboard' &&
          this.state.address !== undefined ? (
            <UserDataSummary
              // @ts-ignore
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
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}
          >
            {' '}
            {this.state.address !== 'leaderboard' &&
            this.state.address !== undefined &&
            userTimestampJSON &&
            // @ts-ignore
            userTimestampJSON.user
              ? // @ts-ignore
                Object.entries(userTimestampJSON.user)
                  .map(([key, statNumVal]) => {
                    const block = StatBlocks[this.state.type][key];
                    if (!block || !block.shouldDisplay(statNumVal))
                      return false;
                    return { block, statNumVal };
                  })
                  .filter(b => !!b)
                  .map(({ block, statNumVal }) => {
                    return (
                      <div
                        key={block.title + this.state.timeIndex}
                        className='stat-card'
                        style={{ order: block.order }}
                      >
                        <div
                          className='stat-subtitle'
                          dangerouslySetInnerHTML={{ __html: block.subtitle }}
                        />
                        <div
                          className='stat-title'
                          dangerouslySetInnerHTML={{ __html: block.title }}
                        />
                        <div className='stat-data'>
                          {block.prefix}
                          {block.data(statNumVal)}
                          {block.suffix}
                        </div>
                      </div>
                    );
                  })
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

          {this.state.address !== 'leaderboard' &&
            this.state.address !== undefined && (
              <div
                style={{ display: 'none' }}
                className='timestamp-slider-description'
              >
                {new Date(this.state.date.toISOString()).toString()}
              </div>
            )}
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
          <select
            className='dropdown--select-network'
            value={this.state.network}
            onChange={e => this.updateNetwork(e.target.value)}
            defaultValue={networks.MAINNET}
          >
            <option value={networks.MAINNET}>MAINNET</option>
            <option value={networks.DEVNET}>DEVNET</option>99.9999
          </select>
        </div>
      </div>
    );
  }
}

export default App;
