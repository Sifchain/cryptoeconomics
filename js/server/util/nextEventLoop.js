
module.exports = {
  async nonBlockingForEach (items, cb) {
    const index = 
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await cb(item);
      await new Promise(r => setImmediate(r));
    }
  }
}