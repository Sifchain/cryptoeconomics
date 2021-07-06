import { networks } from './config';
const serverURL = (() => {
  let environment = process.env.REACT_APP_DEPLOYMENT_TAG;
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

const getSnapshotNetworkHeaders = (network) => ({
  'snapshot-source': network || networks.MAINNET,
});

function handleFailedRequest() {
  setTimeout(() => {
    window.location.reload();
  }, 3000);
}
const getUrl = (network) => {
  let url = serverURL;
  if (networks.MAINNET_SNAPSHOTS_V2_BETA === network) {
    url = 'http://ec2-3-138-153-106.us-east-2.compute.amazonaws.com:3000/api';
  }
  return url;
};
export const fetchUsers = (type, network) => {
  return window
    .fetch(`${getUrl(network)}/${type}?key=users`, {
      headers: getSnapshotNetworkHeaders(network),
    })
    .then((response) => response.json())
    .catch(handleFailedRequest);
};

export const fetchUserData = (address, type, timestamp, network) => {
  return window
    .fetch(
      `${getUrl(network)}/${type}?key=userData&address=${address}${
        timestamp ? `&timestamp=${new Date(timestamp).toISOString()}` : ``
      }`,
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
      `${getUrl(network)}/${type}?key=userTimeSeriesData&address=${address}`,
      {
        headers: getSnapshotNetworkHeaders(network),
      }
    )
    .then((response) => response.json())
    .catch(handleFailedRequest);
};

export const fetchStack = (type, network) => {
  return window
    .fetch(`${getUrl(network)}/${type}?key=stack`, {
      headers: getSnapshotNetworkHeaders(network),
    })
    .then((response) => response.json())
    .catch(handleFailedRequest);
};
