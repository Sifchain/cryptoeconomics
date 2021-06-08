import { networks, NETWORK_STORAGE_KEY } from './config';
const serverURL = (() => {
  let environment = process.env.REACT_APP_DEPLOYMENT_TAG;
  const snapshotNetwork = window.localStorage.getItem(NETWORK_STORAGE_KEY);
  // environment = 'devnet';
  switch (environment) {
    case 'production':
      return snapshotNetwork === networks.DEVNET
        ? 'https://api-cryptoeconomics-devnet.sifchain.finance/api'
        : 'https://api-cryptoeconomics.sifchain.finance/api';
    case 'devnet':
      return 'https://api-cryptoeconomics-devnet.sifchain.finance/api';
    case 'testnet':
      return 'https://api-cryptoeconomics-testnet.sifchain.finance/api';
    default:
      return 'http://localhost:3000/api';
  }
})();

const getSnapshotNetworkHeaders = () => ({
  'snapshot-source':
    window.localStorage.getItem(NETWORK_STORAGE_KEY) || networks.MAINNET
});

function handleFailedRequest () {
  setTimeout(() => {
    window.location.reload();
  }, 3000);
}
export const fetchUsers = type => {
  return window
    .fetch(`${serverURL}/${type}?key=users`, {
      headers: getSnapshotNetworkHeaders()
    })
    .then(response => response.json())
    .catch(handleFailedRequest);
};

export const fetchUserData = (address, type, timestamp) => {
  return window
    .fetch(
      `${serverURL}/${type}?key=userData&address=${address}${
        timestamp ? `&timestamp=${new Date(timestamp).toISOString()}` : ``
      }`,
      {
        headers: getSnapshotNetworkHeaders()
      }
    )
    .then(response => response.json())
    .catch(handleFailedRequest);
};

export const fetchUserTimeSeriesData = (address, type) => {
  return window
    .fetch(`${serverURL}/${type}?key=userTimeSeriesData&address=${address}`, {
      headers: getSnapshotNetworkHeaders()
    })
    .then(response => response.json())
    .catch(handleFailedRequest);
};

export const fetchStack = type => {
  return window
    .fetch(`${serverURL}/${type}?key=stack`, {
      headers: getSnapshotNetworkHeaders()
    })
    .then(response => response.json())
    .catch(handleFailedRequest);
};
