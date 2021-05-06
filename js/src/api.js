const serverURL = 'https://sif-cryptoecon-test.herokuapp.com/api'

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
