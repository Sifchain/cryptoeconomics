const fetch = require('node-fetch').default;
const moment = require('moment');

require('fs').rmdirSync(
  require('path').join(__dirname, `./output/get-all-user-data-at-v1-end`),
  { recursive: true }
);
require('fs').mkdirSync(
  require('path').join(__dirname, `./output/get-all-user-data-at-v1-end`)
);
const getAllUserDataAtV1End = async () => {
  const startedAt = Date.now();
  const bigReqs = [];
  for (let type of ['lm', 'vs']) {
    const permaType = type;
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
          const currI = ++i;
          reqs.push(
            (async () => {
              while (true) {
                try {
                  const timestamp = `${encodeURIComponent(
                    moment('2021-08-04T23:59:59').utc().toISOString()
                  )}`;
                  const userData = await fetch(
                    `https://api-cryptoeconomics.sifchain.finance/api/${type}?key=userData&address=${u}&timestamp=${timestamp}`
                  ).then((r) => r.json());
                  output[u] = true;
                  require('fs').writeFileSync(
                    require('path').join(
                      __dirname,
                      `./output/get-all-user-data-at-v1-end/${permaType}__${u}.json`
                    ),
                    JSON.stringify(userData)
                  );
                  console.log(`${currI} / ${data.length}`);
                  const elapsed = Date.now() - startedAt;
                  const estimatedTotalTime = (elapsed * data.length) / currI;
                  console.log(
                    `${~~(elapsed / 60000)} / ${~~(
                      estimatedTotalTime / 60000
                    )} minutes`
                  );
                  if (userData && userData.user) {
                    break;
                  }
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
