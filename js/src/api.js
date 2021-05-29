const serverURL = (() => {
  let environment = process.env.REACT_APP_DEPLOYMENT_TAG;
  // environment = 'devnet';
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

function handleFailedRequest () {
  window.location.reload();
}
export const fetchUsers = type => {
  return window
    .fetch(`${serverURL}/${type}?key=users`)
    .then(response => response.json())
    .catch(handleFailedRequest);
};

export const fetchUserData = (address, type, timestamp) => {
  return window
    .fetch(
      `${serverURL}/${type}?key=userData&address=${address}${
        timestamp ? `&timestamp=${new Date(timestamp).toISOString()}` : ``
      }`
    )
    .then(response => response.json())
    .catch(handleFailedRequest);
};

export const fetchUserTimeSeriesData = (address, type) => {
  return window
    .fetch(`${serverURL}/${type}?key=userTimeSeriesData&address=${address}`)
    .then(response => response.json())
    .catch(handleFailedRequest);
};

export const fetchStack = type => {
  return window
    .fetch(`${serverURL}/${type}?key=stack`)
    .then(response => response.json())
    .catch(handleFailedRequest);
};
