const _ = require('lodash');

module.exports.toBool = function toBool(str) {
  if (_.isUndefined(str)) { return true; }
  if (!_.isString(str)) { return -1; }
  if (str.toLowerCase() === 'true' ||
      str.toLowerCase() === 'yes') {
    return true;
  } else if (
    str.toLowerCase() === 'false' ||
      str.toLowerCase() === 'no') {
    return false;
  }
  return -1;
};

module.exports.isObjectID = function isObjectID(str) {
  return /^[a-f\d]{24}$/i.test(str);
};
/**
 * Convert string to numbers
 * @param {String}srt string to be converted
 * @return {Number|NaN} number of NaN if not valid number
 */
module.exports.toNumber = function toNumber(str) {
  if (str === '') return NaN;
  const num = Number(str);
  if (Number.isNaN(num)) {
    return NaN;
  }
  return num;
};

function parseDateFormat1(str) {
  // 31/2/2010
  const m = str.match(/^(\d{1,2})[/\s.\-,](\d{1,2})[/\s.\-,](\d{4})$/);
  return (m) ? new Date(m[3], m[2] - 1, m[1]) : NaN;
}
function parseDateFormat2(str) {
  // 2010/31/2
  const m = str.match(/^(\d{4})[/\s.\-,](\d{1,2})[/\s.\-,](\d{1,2})$/);
  return (m) ? new Date(m[1], m[2] - 1, m[3]) : NaN;
}

function containsInvalidDateStr(str) {
  if (!_.isString(str)) return true;
  if (str.match(/[\d]/) === null) return true; // no any numbers
  if (str.match(/.*[-:T/].*/) === null) return true; // no any date parts related characters
  return false;
}
function newDate(str) {
  return new Date(str);
}
function isDate(val) {
  return _.isDate(val) && !Number.isNaN(val.getTime());
}

/**
 * Custom date parser - because there is no indicate when string
 * is used as a int and when as a date.
 * e.g. 2010 -> assuming it's number
 * 2010/10/1 -> its'a date (y/m/d) but Date.parse doesn't detect it
 * //31/2/2010 -> it's another representation about date (m/d/y)
 * @param {String}str
 * @return {Date|NaN}
 */
module.exports.parseDateCustom = function parseDateCustom(str) {
  if (containsInvalidDateStr(str)) return NaN;
  const converters = [newDate, parseDateFormat1, parseDateFormat2];
  // eslint-disable-next-line no-restricted-syntax, guard-for-in
  for (const i in converters) {
    const date = converters[i](str);
    if (isDate(date)) return date;
  }
  return NaN;
};
