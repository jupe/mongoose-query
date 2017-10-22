const _ = require('lodash');
const mongoose = require('mongoose');

const { Types } = mongoose;
const { ObjectId } = Types;

// module tools
const tools = require('./tools');

const {
  toBool, toJSON, toNumber, isObjectID, parseDateCustom
} = tools;

function parseQuery(query, options = {}) {
  /**

  reserved keys: q,t,f,s,sk,l,p

  [q=<query>][&t=<type>][&f=<fields>][&s=<order>][&sk=<skip>][&l=<limit>][&p=<populate>]
  q=<query> - restrict results by the specified JSON query
  t=<type> - find|findOne|count|aggregate|distinct..
  f=<set of fields> - specify the set of fields to include or exclude in
    each document (1 - include; 0 - exclude)
  s=<sort order> - specify the order in which to sort each specified
    field (1- ascending; -1 - descending)
  sk=<num results to skip> - specify the number of results to skip in
    the result set; useful for paging
  l=<limit> - specify the limit for the number of results (default is 1000)
  p=<populate> - specify the fields for populate

  alternative search conditions:
  "key={in}a,b"
  "At least one of these is in array"

  "key={nin}a,b"
  "Any of these values is not in array"

  "key={all}a,b"
  "All of these contains in array"

  "key={empty}-"
   "Field is empty or not exists"

  "key={!empty}-"
   "Field exists and is not empty"

  "key={mod}a,b"
  "Docs where key mod a is b"

  "key={gt}a"
  "Docs key is greater than a"

  "key={lt}a"
  "Docs key is lower than a"

  "key=a|b|c"
  "Docs where key type is Array, contains at least one of given value
  */
  _.defaults(options, { includeAllParams: true });

  const qy = {
    q: {}, //  query
    map: '',
    reduce: '',
    t: 'find', //  count
    f: false, // fields
    s: false, //  sort
    sk: false, //  skip
    l: 1000, //  limit
    p: false, // populate
    fl: false // flat
  };

  function addCondition(key, val) {
    if (['$or', '$nor', '$and'].indexOf(key) !== -1) {
      if (!_.has(qy.q, key)) {
        qy.q[key] = [];
      }
      qy.q[key].push(val);
    } else {
      qy.q[key] = val;
    }
  }

  function parseParam(key, val) {
    const lcKey = key;
    let operator = false;
    if (typeof val === 'string') {
      operator = val.match(/\{(.*)\}/);
      if (operator) {
        // eslint-disable-next-line no-param-reassign
        val = val.replace(/\{(.*)\}/, '');
        [, operator] = operator;
      }
      // there is problem when/if value is valid objectid but it
      // should be handled as a number, e.g. "123456789012345678901234"
      // anyway - collision propability is quite low.
      if (!isObjectID(val)) {
        const num = toNumber(val);
        if (!Number.isNaN(num)) {
          // eslint-disable-next-line no-param-reassign
          val = num;
        }
      }
    }
    if (key[0] === '$') return; // bypass $ characters for security reasons!
    if (val === '' && operator !== 'empty' && operator !== '!empty') {
      // do nothing
    } else if (lcKey === 'sort_by') {
      const parts = val.match('(.*),([-1]{1})?');
      if (parts) {
        qy.s = {};
        qy.s[parts[1]] = parts.length > 2 ? parseInt(parts[2], 10) : 1;
      } else {
        throw new Error('invalid sort_by value');
      }
    } else if (toBool(val) !== -1) {
      const b = toBool(val);
      if (b === false) {
        const orCond = {};
        orCond[lcKey] = { $exists: false };
        qy.q.$or = [];
        qy.q.$or.push(orCond);
        orCond[lcKey] = b;
        qy.q.$or.push(orCond);
      } else addCondition(lcKey, b);
    } else if (operator === 'gt' ||
          operator === 'gte' ||
          operator === 'lt' ||
          operator === 'in' ||
          operator === 'nin' ||
          operator === 'lte' ||
          operator === 'ne' ||
          operator === 'size') {
      const arrayOperators = ['in', 'nin', 'all', 'mod'];
      const date = parseDateCustom(val);
      if (!Number.isNaN(date) && operator !== 'size' &&
              !_.indexOf(arrayOperators, operator) === -1) {
        // eslint-disable-next-line no-param-reassign
        val = date;
      }
      const tmp = {};
      if (_.indexOf(arrayOperators, operator) !== -1) {
        // eslint-disable-next-line no-param-reassign
        val = val.split(',');
      }
      tmp[`$${operator}`] = val;
      addCondition(lcKey, tmp);
    } else if (operator === 'i') {
      // key={i}<value>
      addCondition(lcKey, new RegExp(`^${val}$`, 'i')); // http://scriptular.com/
    } else if (operator === 'e') {
      // key={e}<value>
      addCondition(lcKey, new RegExp(`${val}$`));
    } else if (operator === 'b') {
      addCondition(lcKey, new RegExp(`^${val}`));
    } else if (operator === 'm') {
      // key={m}<key>,<value>
      if (_.isString(val)) {
        const match = val.match(/(.*),(.*)/);
        if (match) {
          qy.q[key] = {};
          qy.q[key].$elemMatch = {};
          // eslint-disable-next-line prefer-destructuring
          qy.q[key].$elemMatch[match[1]] = match[2];
        }
      }
    } else if (operator === 'empty') {
      const empty = {};
      empty[lcKey] = '';
      const unexists = {};
      unexists[lcKey] = { $exists: false };
      addCondition('$or', empty);
      addCondition('$or', unexists);
    } else if (operator === '!empty') {
      const empty = {};
      empty[lcKey] = '';
      const unexists = {};
      unexists[lcKey] = { $exists: false };
      addCondition('$nor', empty);
      addCondition('$nor', unexists);
    } else if (operator === 'c') {
      const tmp = val.match(/(.*)\/(.*)/);
      if (tmp) {
        addCondition(lcKey, new RegExp(tmp[1], tmp[2]));
      } else {
        throw new Error('Invalid options for operator "c"');
      }
    } else {
      if ((options.ignoreKeys === true) ||
            (_.isArray(options.ignoreKeys) &&
             (options.ignoreKeys.indexOf(key) !== -1))) {
        return;
      }
      if (_.isString(val)) {
        const parts = val.split('|');
        if (parts.length > 1) {
          for (let i = 0; i < parts.length; i += 1) {
            const tmp = {};
            tmp[lcKey] = parts[i];
            addCondition('$or', tmp);
          }
        } else {
          addCondition(lcKey, val);
        }
      } else {
        addCondition(lcKey, val);
      }
    }
  }
  function walker(value, key, obj) {
    if (value !== null && typeof value === 'object') {
      // Recurse into children
      _.each(value, walker);
    } else if (typeof value === 'string') {
      if (key === '$regex') {
        const m = value.match(/\/(.*)\//);
        if (m) {
          if (obj.$options) {
            m[2] = obj.$options;
            // eslint-disable-next-line no-param-reassign
            delete obj.$options;
          }
          // eslint-disable-next-line no-param-reassign
          obj[key] = new RegExp(m[1], m[2]);
        }
      } else if (value.startsWith('oid:')) {
        const oidValue = value.split(':')[1];
        // eslint-disable-next-line no-param-reassign
        obj[key] = new ObjectId(oidValue);
      }
    }
  }
  // eslint-disable-next-line guard-for-in, no-restricted-syntax
  for (const key in query) {
    switch (key) {
      case ('q'):
        qy.q = toJSON(decodeURIComponent(query[key]));
        _.each(qy.q, walker);
        break;
      case ('t'): qy.t = query[key]; break;
      case ('f'):
      case ('select'):
        qy.f = query[key]; break;
      case ('s'):
      case ('sort'):
        qy.s = toJSON(query[key]); break;
      case ('sk'):
      case ('skip'):
      case ('skips'):
        qy.sk = parseInt(query[key], 10); break;
      case ('l'):
      case ('limit'):
        qy.l = parseInt(query[key], 10); break;
      case ('p'):
        if (typeof query[key] === 'string') {
          if (query[key].startsWith('{') ||
              query[key].startsWith('[')) {
            // eslint-disable-next-line no-param-reassign
            query[key] = JSON.parse(decodeURIComponent(query[key]));
          } else if (query[key].indexOf(',') !== -1) {
            // eslint-disable-next-line no-param-reassign
            query[key] = query[key].split(',');
          }
        }
        qy.p = query[key];
        break;
      case ('map'): qy.map = query[key]; break;
      case ('reduce'): qy.reduce = query[key]; break;
      case ('fl'): qy.fl = toBool(query[key]); break;
      default:
        if (options.includeAllParams) parseParam(key, query[key]);
        break;
    }
  }
  return qy;
}

module.exports = parseQuery;
