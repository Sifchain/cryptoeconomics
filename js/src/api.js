export const fetchUsers = _ => {
  return fetch('./api/server?key=users')
    .then(response => response.json())
}

export const fetchUserData = address => {
  return fetch(`./api/server?key=userData&address=${address}`)
    .then(response => response.json())
}

export const fetchUserTimeSeriesData = address => {
  return fetch(`./api/server?key=userTimeSeriesData&address=${address}`)
    .then(response => response.json())
}

export const fetchStack = _ => {
  return fetch(`./api/server?key=stack`)
    .then(response => response.json())
}
