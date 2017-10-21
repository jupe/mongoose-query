const dummy = () => {};
class Logger {
  constructor() {
    this.logger = this.getDummyLogger();
  }
  // eslint-disable-next-line class-methods-use-this
  getDummyLogger() {
    return {
      silly: dummy,
      warn: dummy,
      error: dummy,
      info: dummy,
      debug: dummy
    };
  }
  get silly() { return this.logger.silly; }
  get warn() { return this.logger.warn; }
  get error() { return this.logger.error; }
  get info() { return this.logger.info; }
  get debug() { return this.logger.debug; }
  setLogger(logger) {
    this.logger = logger;
  }
}
module.exports = new Logger();
