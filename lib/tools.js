const util = require('util')
  , logger = require('./logger');

module.exports.toJSON = function(str){
  var json = {}
  try{
    json = JSON.parse(str);
  } catch(e){
    logger.warn('parsing error:', e);
    json = {};
  }
  return json;
}
module.exports.toBool = function (str) {
  if (str.toLowerCase() === "true" ||
      str.toLowerCase() === "yes" ){
    return true;
  } else if (
      str.toLowerCase() === "false" ||
      str.toLowerCase() === "no" ){
    return false;
  } else {
    return -1;
  }
}
function parseDate(str) {
  //31/2/2010
  var m = str.match(/^(\d{1,2})[\/\s\.\-\,](\d{1,2})[\/\s\.\-\,](\d{4})$/);
  return (m) ? new Date(m[3], m[2]-1, m[1]) : null;
}
function parseDate2(str) {
  //2010/31/2
  var m = str.match(/^(\d{4})[\/\s\.\-\,](\d{1,2})[\/\s\.\-\,](\d{1,2})$/);
  return (m) ? new Date(m[1], m[2]-1, m[3]) : null;
}
function isDate(val) {
  return util.isDate(val) && !isNaN(val.getTime());
}
module.exports.isStringValidDate = function(str){
  if(isDate(new Date(str)))return true;
  if(isDate(parseDate(str)))return true;
  if(isDate(parseDate2(str)))return true;
  return false;
}
