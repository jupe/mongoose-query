const _ = require('lodash')
  , mongoose = require('mongoose')
  , ObjectId = mongoose.Types.ObjectId
  // module tools
  , logger = require('./logger')
  , tools = require('./tools')
  , toBool = tools.toBool
  , toJSON = tools.toJSON
  , parseDateCustom = tools.parseDateCustom;

module.exports = function parseQuery(query, options){
  /**

  reserved keys: q,t,f,s,sk,l,p

  [q=<query>][&t=<type>][&f=<fields>][&s=<order>][&sk=<skip>][&l=<limit>][&p=<populate>]
  q=<query> - restrict results by the specified JSON query
  t=<type> - find|findOne|count|aggregate|distinct..
  f=<set of fields> - specify the set of fields to include or exclude in each document (1 - include; 0 - exclude)
  s=<sort order> - specify the order in which to sort each specified field (1- ascending; -1 - descending)
  sk=<num results to skip> - specify the number of results to skip in the result set; useful for paging
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

  options = options || {};

  let qy = {
    q: {},        //  query
    map: '',
    reduce: '',
    t: 'find',    //  count
    f: false,     // fields
    s: false,     //  sort
    sk: false,    //  skip
    l: 1000,      //  limit
    p: false,     // populate
    fl: false    // flat
  }

  let addCondition = function(key, val)
  {
    if (["$or", "$nor", "$and"].indexOf(key)!==-1) {
      if (!_.has(qy.q, key)) {
        qy.q[key] = [];
      }
      qy.q[key].push(val);
    } else {
      qy.q[key] = val;
    }
  }

  let parseParam = function(key, val){
    let lcKey = key;
    let operator = false;
    if (typeof val == 'string') {
        operator = val.match(/\{(.*)\}/);
        if (operator){
          val = val.replace(/\{(.*)\}/, '');
          operator = operator[1];
        }
    }
    if (key[0] == '$' ) return; //bypass $ characters for security reasons!
    if (val === "" && operator !== 'empty' && operator !== '!empty') {
      return;
    } else if (lcKey === "sort_by") {
      let parts = val.split(',');
      qy.s = {};
      qy.s[parts[0]] = parts.length > 1 ? parseInt(parts[1]) : 1;
    } else {
      if (toBool(val) !== -1) {
        let b = toBool(val);
        if (b == false) {
          let orCond = {}
          orCond[ lcKey ] = {$exists: false};
          qy.q[ '$or' ] = []
          qy.q[ '$or' ].push(orCond);
          orCond[ lcKey ] = b;
          qy.q[ '$or' ].push(orCond);
        }
        else addCondition( lcKey, b);
      } else {
        if (operator === "gt" ||
          operator === "gte" ||
          operator === "lt" ||
          operator === "in" ||
          operator === "nin" ||
          operator === "lte" ||
          operator === "ne" ||
          operator === "size") {
            const arrayOperators = ['in', 'nin', 'all', 'mod'];
            const date = parseDateCustom(val);
            if (date !== NaN &&
              operator !== "size" &&
              !_.indexOf(arrayOperators, operator) === -1) {
              val = date;
            }
            let tmp = {};

            if (_.indexOf(arrayOperators, operator)!==-1) {
              val = val.split(',');
            }
            tmp["$"+operator] =  val;
            addCondition(lcKey, tmp);
        } else if (operator == 'i') {
          addCondition(lcKey, new RegExp('^'+val+'$', 'i')); //http://scriptular.com/
        } else if (operator == 'e') {
          addCondition(lcKey, new RegExp(val+'$'));
        } else if (operator == 'b') {
          addCondition(lcKey, new RegExp('^' + val));
        } else if (operator == 'm') {
          // key={m}<key>,<value>
          let value = val.split(',');
          qy.q[key] = {};
          qy.q[key]['$elemMatch']  = {};
          qy.q[key]['$elemMatch']['key']  = value[0];
          qy.q[key]['$elemMatch']['value']  = value[1];
        } else if (operator == 'empty') {
          let empty = {};
          empty[lcKey] = '';
          let unexists =  {};
          unexists[lcKey] = {$exists: false};
          addCondition('$or', empty);
          addCondition('$or', unexists);
        } else if (operator == '!empty') {
            let empty = {};
            empty[lcKey] = '';
            let unexists =  {};
            unexists[lcKey] = {$exists: false};
            addCondition('$nor', empty);
            addCondition('$nor', unexists);
        } else if (operator == 'c') {
          val = val.split('/');
          addCondition(lcKey, new RegExp(val[0], val[1]));
        } else {
          if ((options.ignoreKeys === true) ||
            (_.isArray(options.ignoreKeys) &&
             (options.ignoreKeys.indexOf(key) !== -1))) {
              return;
          }
          let parts = val.split('|');
          if (parts.length > 1) {
            for(i=0;i<parts.length;i++){
              let tmp = {}
              tmp[lcKey] = parts[i];
              addCondition('$or', tmp);
            }
          } else {
            addCondition(lcKey, val );
          }
        }
      }
    }
  }
  function walker(value, key, obj) {
    if (value !== null && typeof value === "object") {
        // Recurse into children
        _.each(value, walker);
    } else if (typeof value === "string") {
      if( key === '$regex' ) {
        let m = value.match(/\/(.*)\//);
        if(m) {
          if(obj['$options'] ) {
            m[2] = obj['$options']
            delete obj['$options'];
          }
          obj[key] = new RegExp(m[1], m[2]);
        }
      }
      else if (value.startsWith('oid:')) {
          let oidValue = value.split(":")[1];
          obj[key] = new ObjectId(oidValue);
      }
    }
  }
  for(let key in query) {
    switch(key) {
      case('q'):
        qy.q = toJSON(decodeURIComponent(query[key]));
        _.each(qy.q, walker);
        break;
      case('t'): qy.t = query[key]; break;
      case('f'):
      case('select'):
        qy.f = query[key]; break;
      case('s'):
      case('sort'):
        qy.s = toJSON(query[key]); break;
      case('sk'):
      case('skip'):
      case('skips'):
        qy.sk = parseInt(query[key]); break;
      case('l'):
      case('limit'):
        qy.l = parseInt(query[key]); break;
      case('p'):
        if (typeof query[key] === 'string') {
          if (query[key].startsWith('{') ||
              query[key].startsWith('[')) {
            query[key] = JSON.parse(decodeURIComponent(query[key]));
          } else if(query[key].indexOf(',') !== -1) {
            query[key] = query[key].split(',');
          }
        }
        qy.p = query[key];
        break;
      case('map'): qy.map = query[key]; break;
      case('reduce'): qy.reduce = query[key]; break;
      case('fl'): qy.fl = toBool(query[key]); break;
      default:
        parseParam(key, query[key]);
        break;
    }
  }
  return qy;
}
