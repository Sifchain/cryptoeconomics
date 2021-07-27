const fetch = require('node-fetch').default;

const reformatAllMaturityDates = () => {
  const data = require('../../all-maturity-dates.json');
  const output = [];
  Object.entries(data.lm).forEach(([k, v]) => {
    output.push({
      Program: 'Liquidity Mining',
      Address: k,
      'Maturity Date': v,
    });
  });
  Object.entries(data.vs).forEach(([k, v]) => {
    output.push({
      Program: 'Validator Subsidy',
      Address: k,
      'Maturity Date': v,
    });
  });
  require('fs').writeFileSync(
    './all-maturity-dates-as-array.json',
    JSON.stringify(output)
  );
};

reformatAllMaturityDates();

const getAllMaturityDates = async () => {
  const finalOut = { lm: null, vs: null };
  const bigReqs = [];
  for (let type of ['lm', 'vs']) {
    let i = 0;
    const output = {};
    const bigReq = fetch(
      `https://api-cryptoeconomics.sifchain.finance/api/${type}?key=users&snapshot-source=mainnet`
    )
      .then((r) => r.json())
      .then(async (data) => {
        let reqs = [];
        for (let u of data) {
          if (reqs.length > 20) {
            await Promise.all(reqs);
            reqs = [];
          }
          reqs.push(
            (async () => {
              while (!output.hasOwnProperty(u)) {
                try {
                  output[u] = await fetch(
                    `https://api-cryptoeconomics.sifchain.finance/api/${type}?key=userData&address=${u}&timestamp=now`
                  )
                    .then((r) => r.json())
                    .then((u) => u.user && u.user.maturityDate);
                  console.log(`${++i} / ${data.length}`);
                } catch (e) {
                  console.error(e);
                }
              }
            })()
          );
        }
      })
      .then(() => {
        finalOut[type] = output;
      });
    bigReqs.push(bigReq);
  }
  await Promise.all(bigReqs);
  require('fs').writeFileSync('./all-maturity-dates', JSON.stringify(finalOut));
};
