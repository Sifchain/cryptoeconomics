const serverURL = 'http://ec2-3-142-154-74.us-east-2.compute.amazonaws.com/api'

export const fetchUsers = _ => {
  return fetch(`${serverURL}?key=users`)
    .then(response => response.json())
}

export const fetchUserData = address => {
  return fetch(`${serverURL}?key=userData&address=${address}`)
    .then(response => response.json())
}

export const fetchUserTimeSeriesData = address => {
  return fetch(`${serverURL}?key=userTimeSeriesData&address=${address}`)
    .then(response => response.json())
}

export const fetchStack = _ => {
  return fetch(`${serverURL}?key=stack`)
    .then(response => response.json())
}
