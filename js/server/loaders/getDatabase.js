const slonik = require('slonik');

let getDatabase = () => {
  let db = slonik.createPool(process.env.DATABASE_URL, {
    maximumPoolSize: 10
  });
  getDatabase = () => db;
  return db;
};

module.exports = {
  getDatabase () {
    return getDatabase();
  }
};
