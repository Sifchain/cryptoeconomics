import { networks } from './config';
import serverConfigs from './serverConfig';

export const serverURL = (() => {
  let environment = process.env.REACT_APP_DEPLOYMENT_TAG;
  environment = 'local';
  if (window.sessionStorage.getItem('endpoint')) {
    return window.sessionStorage.getItem('endpoint');
  } else {
    window.sessionStorage.setItem(
      'endpoint',
      'https://api-cryptoeconomics.sifchain.finance/api'
    );
    window.location.reload();
  }
  switch (environment) {
    case 'production':
      return 'https://api-cryptoeconomics.sifchain.finance/api';
    case 'devnet':
      return 'https://api-cryptoeconomics-devnet.sifchain.finance/api';
    case 'testnet':
      return 'https://api-cryptoeconomics-testnet.sifchain.finance/api';
    default:
      return 'http://localhost:3000/api';
  }
})();

const rewardProgram =
  window.sessionStorage.getItem('rewardProgram') ||
  Object.keys(serverConfigs)[0];

const getProgramNameQueryString = (network) => `&program=${rewardProgram}`;
const getSnapshotNetworkHeaders = (network) => ({
  'snapshot-source': network || networks.MAINNET,
});

function handleFailedRequest() {
  setTimeout(() => {
    window.location.reload();
  }, 3000);
}
export const fetchUsers = (type, network) => {
  return window
    .fetch(
      `${serverURL}/${type}?key=users${getProgramNameQueryString(network)}`,
      {
        headers: getSnapshotNetworkHeaders(network),
      }
    )
    .then((response) => response.json())
    .catch(handleFailedRequest);
};

export const fetchUserData = (address, type, timestamp, network) => {
  return window
    .fetch(
      `${serverURL}/${type}?key=userData&address=${address}${getProgramNameQueryString(
        network
      )}${timestamp ? `&timestamp=${new Date(timestamp).toISOString()}` : ``}`,
      {
        headers: getSnapshotNetworkHeaders(network),
      }
    )
    .then((response) => response.json())
    .catch(handleFailedRequest);
};

export const fetchRewardPrograms = () => {
  const serverUrlParts = serverURL.split('/');
  serverUrlParts.pop();
  return window
    .fetch(`${serverUrlParts.join('/')}/graphql`, {
      method: 'POST',
      body: JSON.stringify({
        query: `{
          rewardPrograms {
            rewardProgramName
          }
        }`,
        variables: {},
      }),
      headers: [['content-type', 'application/json']],
    })
    .then((r) => r.json())
    .then((r) => r.data.rewardPrograms);
};

export const fetchUserTimeSeriesData = (address, type, network) => {
  return window
    .fetch(
      `${serverURL}/${type}?key=userTimeSeriesData&address=${address}${getProgramNameQueryString(
        network
      )}`,
      {
        headers: getSnapshotNetworkHeaders(network),
      }
    )
    .then((response) => response.json())
    .catch(handleFailedRequest);
};

export const fetchStack = (type, network) => {
  return window
    .fetch(
      `${serverURL}/${type}?key=stack${getProgramNameQueryString(network)}`,
      {
        headers: getSnapshotNetworkHeaders(network),
      }
    )
    .then((response) => response.json())
    .catch(handleFailedRequest);
};
