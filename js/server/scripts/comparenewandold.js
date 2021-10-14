const currentvals = require('./user-exit-states.with-readds.json');
const oldvsasl = require('./user-exit-states.without-readds.json');

const diffs = {};
let totalIncrease = 0;
let totalDecrease = 0;
for (let key in { ...currentvals, ...oldvsasl }) {
  const diff = (currentvals[key] || 0) - (oldvsasl[key] || 0);
  if (diff > 0) {
    diffs[key] = diff;
  }
  if (diff > 0) {
    totalIncrease += diff;
  } else {
    totalDecrease -= diff;
  }
}
console.log({ totalIncrease, totalDecrease });
require('fs').writeFileSync(
  require('path').join(__dirname, './diffs.json'),
  Buffer.from(JSON.stringify(diffs, null, 2))
);
