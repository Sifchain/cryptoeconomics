const serverURL = (() => {
  switch (process.env.REACT_APP_DEPLOYMENT_TAG) {
    case "development":
      return `https://api-cryptoeconomics-devnet.sifchain.finance/api`;
    case "testnet":
      return `https://api-cryptoeconomics-testnet.sifchain.finance/api`;
    default:
      return `https://api-cryptoeconomics.sifchain.finance/api`;
  }
})()

export const fetchUsers = type => {
  return fetch(`${serverURL}/${type}?key=users`)
    .then(response => response.json())
}

export const fetchUserData = (address, type) => {
  return fetch(`${serverURL}/${type}?key=userData&address=${address}`)
    .then(response => response.json())
}

export const fetchUserTimeSeriesData = (address, type) => {
  return fetch(`${serverURL}/${type}?key=userTimeSeriesData&address=${address}`)
    .then(response => response.json())
}

export const fetchStack = type => {
  return fetch(`${serverURL}/${type}?key=stack`)
    .then(response => response.json())
}
