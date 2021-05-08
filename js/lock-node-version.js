/**
 * This script executes before "npm install"
 * Lock the version of Node running based on the one set in the package.json
 */

const fs = require('fs');
const path = require('path');

const packageJson = require('./package.json');
const requiredNodeVersion = packageJson.engines.node;

const runningNodeVersion = process.version;
console.log(process.version);
// set .nvmrc and .node_version to have the same version

fs.writeFileSync(
  path.join(__dirname, '.node-version'),
  requiredNodeVersion,
  'UTF8'
);
fs.writeFileSync(path.join(__dirname, '.nvmrc'), requiredNodeVersion, 'UTF8');

// check that the required version of Node is running

if (
  !runningNodeVersion
    .split('v')
    .join('')
    .includes(requiredNodeVersion)
) {
  console.error(
    `You are not running the required version of Node, please use version ${requiredNodeVersion}. \nIf you have installed NVM and AVN, just exit the project folder and cd into it again.`
  );

  // kill the process if the required node version is not the one running
  // process.exit(1);
}
