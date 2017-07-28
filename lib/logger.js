const _ = require('lodash');
const dummy = () => {};
class Logger {
    constructor() {
        this._logger = this._getDummyLogger();
    }
    _getDummyLogger() {
        return {
            silly: dummy,
            warn: dummy,
            error: dummy,
            info: dummy,
            debug: dummy
        };
    }
    get silly() { return this._logger.silly; }
    get warn() { return this._logger.warn; }
    get error() { return this._logger.error; }
    get info() { return this._logger.info; }
    get debug() { return this._logger.debug; }
    setLogger(logger) {
        this._logger = logger;
    }
}
module.exports = new Logger();
