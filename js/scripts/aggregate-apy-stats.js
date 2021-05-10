const { fetch } = require("cross-fetch");

const ENV = [null, "production", "devnet", "testnet"][0];
const serverURL = (() => {
  switch (ENV) {
    case "production":
      return "https://api-cryptoeconomics.sifchain.finance/api";
    case "devnet":
      return "https://api-cryptoeconomics-devnet.sifchain.finance/api";
    case "testnet":
      return "https://api-cryptoeconomics-testnet.sifchain.finance/api";
    default:
      return "http://localhost:3000/api";
  }
})();

(async () => {
  const results = { lm: [] /* , vs: [] */ };
  // Get Data
  for (let type in results) {
    let outputText = `Cryptoeconomics ${type.toUpperCase()} APY Summary:\n`;
    const outputPath = require("path").join(
      __dirname,
      `./aggregate-apy-stats-${type}.out.txt`
    );
    require("fs").writeFileSync(outputPath, "");
    const url = `${serverURL}/${type}`;
    const users = await fetch(`${url}?key=users`).then((r) => r.json());
    let count = 0;
    for (let address of users) {
      console.log(++count);
      const data = await (async () => {
        try {
          const userData = await fetch(
            `${url}?key=userData&address=${address}&timestamp=now`
          ).then((r) => r.json());
          // console.log({
          //   nextRewardProjectedFutureReward:
          //     userData.user.nextRewardProjectedFutureReward,
          // });

          return {
            userData: userData.user,
            address,
          };
        } catch (e) {
          console.error(e);
        }
      })();
      // console.log(
      //   [
      //     `\n${data.address}:`,
      //     `\tOriginal Maturity APY (${type.toUpperCase()}): ${
      //       data.userData.maturityAPY
      //     }`,
      //     `\tProjected APY On Current Liquidity (${type.toUpperCase()}): ${
      //       data.userData.nextRewardProjectedAPYOnCurrentLiquidity
      //     }`,
      //     `\tProjected APY On Tickets (${type.toUpperCase()}): ${
      //       data.userData.nextRewardProjectedAPYOnTickets
      //     }`,
      //   ].join("\n")
      // );
      results[type].push(data);
      require("fs").appendFileSync(outputPath, JSON.stringify(data) + "\n");
    }
    const sortKey = "maturityAPY";
    results[type] = await Promise.all(results[type]);
    results[type] = results[type].filter((v) => !!v);
    results[type] = results[type].sort((a, b) =>
      a.userData[sortKey] > b.userData[sortKey]
        ? -1
        : a.userData[sortKey] < b.userData[sortKey]
        ? 1
        : 0
    );
    // Create Text File Contents
    for (let i = 0; i < results[type].length; i++) {
      const item = results[type][i];
      const {
        maturityAPY,
        nextRewardProjectedAPYOnCurrentLiquidity,
        nextRewardProjectedAPYOnTickets,
        // nextRewardProjectedFutureReward,
      } = item.userData;
      outputText += [
        `\n${i + 1}. ${item.address}:`,
        `\tmaturityAPY: ${maturityAPY}`,
        `\tnextRewardProjectedAPYOnCurrentLiquidity: ${nextRewardProjectedAPYOnCurrentLiquidity}`,
        `\tnextRewardProjectedAPYOnTickets: ${nextRewardProjectedAPYOnTickets}`,
      ].join("\n");
    }
    require("fs").writeFileSync(outputPath, outputText);
  }
})();
