const currentvals = require('./userExitStates.new.json');
const oldvsasl = require('./userExitStates.old.json');

const diffs = {};
let totalIncrease = 0;
let totalDecrease = 0;
for (let key in { ...currentvals, ...oldvsasl }) {
  const diff = (currentvals[key] || 0) - (oldvsasl[key] || 0);
  if (diff < 100) diffs[key] = diff;
  if (diff > 0) {
    totalIncrease += diff;
  } else {
    totalDecrease -= diff;
  }
}
console.log({ totalIncrease, totalDecrease });
require('fs').writeFileSync(
  './diffs.json',
  Buffer.from(JSON.stringify(diffs, null, 2))
);
