const fs = require('fs');
const path = require('path');

async function divideDispensations () {
  console.log('');
  const [distName] = fs.readdirSync(`./output/divide-dispensations`);
  const getOutputFilePath = (...paths) =>
    path.join(__dirname, `./output/divide-dispensations/${distName}`, ...paths);

  for (let type of ['vs', 'lm', 'airdrop']) {
    const files = fs.readdirSync(`./output/divide-dispensations/${distName}`);

    const rawDist = JSON.parse(
      fs.readFileSync(getOutputFilePath(`${type}.raw.json`)).toString()
    );
    const sumAllPayoutsInDist = dist =>
      dist.Output.reduce(
        (prev, curr) =>
          prev +
          curr.coins.reduce(
            (prev, curr) => BigInt(curr.amount) + prev,
            BigInt(0)
          ),
        BigInt(0)
      );
    const totalExpected = sumAllPayoutsInDist(rawDist);
    const actualReceived = files
      .filter(f => f.startsWith(type) && f.endsWith('.split.json'))
      .reduce(
        (prev, filename) =>
          prev +
          sumAllPayoutsInDist(
            JSON.parse(fs.readFileSync(getOutputFilePath(filename)).toString())
          ),
        BigInt(0)
      );
    console.group(`${type.toUpperCase()}`);
    if (totalExpected === actualReceived) {
      console.info('Success ✅');
    } else {
      console.log('failure!');
    }
    console.log(`Expected  (bulk file dispensation sum): ${totalExpected}`);
    console.log(`Received (all split dispensations sum): ${actualReceived}`);
    console.log('');
    console.groupEnd();
  }
}

divideDispensations();
