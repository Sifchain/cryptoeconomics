const slonik = require('slonik');

let getDatabase = () => {
  let db = slonik.createPool(process.env.DATABASE_URL);
  getDatabase = () => db;
  return db;
};

module.exports = {
  getDatabase () {
    return getDatabase();
  }
};
