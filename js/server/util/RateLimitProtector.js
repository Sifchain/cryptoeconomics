module.exports.RateLimitProtector = class RateLimitProtector {
  constructor ({ padding }) {
    this.padding = padding;
    this.lastInvokation = 0;
    this.backOfLine = Promise.resolve();
  }

  get waitTime () {
    let time = Date.now();
    let timeSinceLastCall = time - this.lastInvokation;
    let timeToWait = Math.max(this.padding - timeSinceLastCall, 0);
    return timeToWait;
  }

  shieldAll (obj, context) {
    for (let prop in obj) {
      let item = obj[prop];
      if (item instanceof Function) {
        obj[prop] = this.buildAsyncShield(item, context);
      }
    }
  }

  buildAsyncShield (fn, context) {
    let self = this;
    if (context !== undefined) {
      fn = fn.bind(context);
    }
    let shieldFn = async (...args) => {
      let shieldPromiseToWaitFor = this.backOfLine;
      let resolver;
      this.backOfLine = new Promise(resolve => {
        resolver = resolve;
      });
      await shieldPromiseToWaitFor;
      let waitTime = self.waitTime;
      if (waitTime) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      self.lastInvokation = Date.now();
      // @ts-ignore
      resolver();
      return fn(...args);
    };
    let shield = {
      async [fn.name] (...args) {
        return shieldFn(...args);
      }
    }[fn.name];
    return shield;
  }
};
