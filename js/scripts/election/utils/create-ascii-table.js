const { Console } = require('node:console');
const { Transform } = require('node:stream');
module.exports.createAsciiTable = () => {
  const ts = new Transform({
    transform(chunk, enc, cb) {
      cb(null, chunk);
    },
  });
  const logger = new Console({ stdout: ts });

  function getTable(data) {
    logger.table(data);
    return (ts.read() || '').toString();
  }

  const str = getTable({ foo: 'bar' });
  console.log(str.length); // 105
  console.log(str);
};
