import { networks } from './config';
const serverURL = (() => {
  let environment = process.env.REACT_APP_DEPLOYMENT_TAG;
  // environment = 'localnet';
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

const getProgramNameQueryString = (network) =>
  network === networks.DEVNET ? '&program=harvest' : '';
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
      )}}${timestamp ? `&timestamp=${new Date(timestamp).toISOString()}` : ``}`,
      {
        headers: getSnapshotNetworkHeaders(network),
      }
    )
    .then((response) => response.json())
    .catch(handleFailedRequest);
};

export const fetchUserTimeSeriesData = (address, type, network) => {
  return window
    .fetch(
      `${serverURL}/${type}?key=userTimeSeriesData&address=${address}${getProgramNameQueryString(
        network
      )}}`,
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
      `${serverURL}/${type}?key=stack${getProgramNameQueryString(network)}}`,
      {
        headers: getSnapshotNetworkHeaders(network),
      }
    )
    .then((response) => response.json())
    .catch(handleFailedRequest);
};
