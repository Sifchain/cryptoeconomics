const fetch = require('node-fetch').default;
const moment = require('moment');
const getAllUserDataAtV1End = async () => {
  const bigReqs = [];
  for (let type of ['lm', 'vs']) {
    const permaType = type;
    let i = 0;
    const output = {};
    const bigReq = fetch(
      `https://api-cryptoeconomics.sifchain.finance/api/${type}?key=users&snapshot-source=mainnet`
    )
      .then(r => r.json())
      .then(async data => {
        let reqs = [];
        for (let u of data) {
          if (reqs.length > 20) {
            await Promise.all(reqs);
            reqs = [];
          }
          const currI = ++i;
          reqs.push(
            (async () => {
              while (!output[u]) {
                try {
                  const timestamp = `${encodeURIComponent(
                    moment('2021-08-04T23:59:59')
                      .utc()
                      .toISOString()
                  )}`;
                  console.log({ timestamp });
                  const userData = await fetch(
                    `https://api-cryptoeconomics.sifchain.finance/api/${type}?key=userData&address=${u}&timestamp=${timestamp}`
                  ).then(r => r.json());
                  output[u] = true;
                  require('fs').writeFileSync(
                    require('path').join(
                      __dirname,
                      `./output/get-all-user-data-at-v1-end/${permaType}__${u}.json`
                    ),
                    JSON.stringify(userData)
                  );
                  console.log(`${currI} / ${data.length}`);
                } catch (e) {
                  console.error(e);
                }
              }
            })()
          );
        }
      });
    bigReqs.push(bigReq);
  }
  await Promise.all(bigReqs);
};

getAllUserDataAtV1End();
