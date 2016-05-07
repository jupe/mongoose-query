/**
  MONGOOSE QUERY GENERATOR FROM HTTP URL
  e.g.
  var QueryPlugin = require(mongoose-query);
  schema.plugin(QueryPlugin);
  mymodel.Query(req.query, function(error, data){
  });
  
*/
var util = require('util')
  , flatten = require('flat').flatten
  , _ = require('lodash');
  
var dbg = false;  
  
var parseQuery = function(query, options){
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
  
  var qy = {
    q: {},      //  query
    map: '',
    reduce: '',
    t: 'find',   //  count
    f: false,      // fields
    s: false,      //  sort
    sk: false,      //  skip
    l: 1000,     //  limit
    p: false,    //populate
    fl: false    //flat
  }
  
  var toJSON = function(str){
    var json = {}
    try{
      json = JSON.parse(str);
    } catch(e){
      console.log('parsing error');
      json = {};
    } 
    return json;
  }
  var convertToBoolean = function (str) {
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
  var addCondition = function(key, cond)
  {
    if( cond['$or'] ) {
      if( !qy.q.hasOwnProperties('$or') ){
        qy.q['$or'] = [];
      }
      qy.q['$or'].push( {key: cond} );
    } else {
      qy.q[key] = cond;
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
  var isStringValidDate = function(str){
    if(util.isDate(new Date(str)))return true;
    if(util.isDate(parseDate(str)))return true;
    if(util.isDate(parseDate2(str)))return true;
    return false;
  }
  var parseParam = function(key, val){
    var lcKey = key;

    var operator = false;
    if( typeof val == 'string' ){
        operator = val.match(/\{(.*)\}/);
        val = val.replace(/\{(.*)\}/, '');
        if (operator){
          operator = operator[1];
        }
    }
    if( key[0] == '$' ) return; //bypass $ characters for security reasons!
    if (val === "") {
      return;
    } else if (lcKey === "skips") {
      qy.sk = parseInt(val);
    } else if (lcKey === "select") {
      qy.s = val;
    } else if (lcKey === "limit") {
      qy.l = val;
    } else if (lcKey === "sort_by") {
      var parts = val.split(',');
      qy.s = {};
      qy.s[parts[0]] = parts.length > 1 ? parseInt(parts[1]) : 1;
    } else {
      if( convertToBoolean(val) != -1 ) {
        var b = convertToBoolean(val);
        if( b == false ) {
          var orCond = {}
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
          /*operator === "in" ||
          operator === "nin" ||*/
          operator === "lte") {
            if (isStringValidDate(val)) {
              val = new Date(val);
            }
            tmp = {}
            var arrayOperators = ['in', 'nin', 'all', 'mod']
            if( arrayOperators.indexOf(operator)>=0){
              val = val.split(',');
              tmp = []
            }
            tmp["$"+operator] =  val;
            
            
            addCondition(lcKey, tmp);
            
        } else if(operator == 'i') {
          addCondition(lcKey, new RegExp('^'+val+'$', 'i')); //http://scriptular.com/
        } else if(operator == 'e') {
          addCondition(lcKey, new RegExp(val+'$'));
        } else if(operator == 'b') {
          addCondition(lcKey, new RegExp('^' + val));
        } else if(operator == 'in') {
          var parts = val.split(',');
          addCondition(lcKey, {'$in': parts } );
        } else if(operator == 'ne') {
          addCondition(lcKey, {'$ne': val } );
        } else if(operator == 'nin') {
          var parts = val.split(',');
          addCondition(lcKey, {'$nin': parts } );
        } else if(operator == 'all') {
          var parts = val.split(',');
          addCondition(lcKey, {'$all': parts } );
        } else if(operator == 'size') {
          addCondition(lcKey, {'$size': val } );
        } else if(operator == 'm') {
          // key={m}<key>,<value>
          value = value.split(',');
          qy.q[ key ] = {};
          qy.q[ key ]['$elemMatch']  = {};
          qy.q[ key]['$elemMatch']['key']  = value[0];
          qy.q[ key]['$elemMatch']['value']  = value[1];
        } else if(operator == 'empty') {
          var empty = {};
          empty[lcKey] = '';
          var unexists =  {};
          unexists[lcKey] = {$exists: false};
          addCondition('$or', [ empty, unexists ] );
        } else if(operator == '!empty') {
            var empty = {};
            empty[lcKey] = '';
            var unexists =  {};
            unexists[lcKey] = {$exists: false};
            addCondition('$nor', [ empty, unexists ] );
        } else if(operator == 'c') {
          val = val.split('/');
          addCondition(lcKey, new RegExp(val[0], val[1]));
        } else {
          if (options.ignoreKeys === true) return;
          if (options.ignoreKeys && typeof options.ignoreKeys.indexOf === 'function' && options.ignoreKeys.indexOf(key) != -1) return;
          var parts = val.split('|');
          if( parts.length > 1){
            var arr = []
            for(i=0;i<parts.length;i++){
              tmp = {}
              tmp[lcKey] = parts[i];
              arr.push( tmp );
            }
            addCondition('$or', arr );
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
    } else if( typeof value === "string" ) {
      if( key === '$regex' ) {
        var m = value.match(/\/(.*)\//);
        if(m) {
          var options;
          if(obj['$options'] ) {
            m[2] = obj['$options']
            delete obj['$options'];
          }
          obj[key] = new RegExp(m[1], m[2]);
        }
      }
    }
  }
  for(var key in query){
    switch(key) {
      case('q'): 
        qy.q = toJSON(decodeURIComponent(query[key]));
        _.each(qy.q, walker);
        break;
      case('t'): qy.t = query[key]; break;
      case('f'): qy.f = query[key]; break;
      case('s'): qy.s = toJSON(query[key]); break;
      case('sk'): qy.sk = parseInt(query[key]); break;
      case('l'): qy.l = parseInt(query[key]); break;
      case('p'):
        if (typeof query[key] === 'string') {
          if (query[key].indexOf('{') !== -1) query[key] = JSON.parse(decodeURIComponent(query[key]));
          else if (query[key].indexOf('[') !== -1) query[key] = JSON.parse(decodeURIComponent(query[key]));
        }
        qy.p = query[key];
        break;
      case('map'): qy.map = query[key]; break;
      case('reduce'): qy.reduce = query[key]; break;
      case('fl'): qy.fl = query[key]=='true'?true:false; break;
      default: 
        parseParam(key, query[key]);
        break;
    }
  }
  return qy;
}
var doQuery = function(query, model, options, callback)
{
  if(dbg)console.log(query);
  var q = parseQuery(query, options);
  if(!model)return q;
  if(dbg)console.log(q);
  var find = model;
  switch(q.t){
    case('find'): 
    case('findOne'):    
        find = find.find(q.q);
        break;
    case('count'):
        if (!callback) {
          return find.count(q.q); 
        }
        find.count(q.q, function(error,count){
          if(error) callback(error);
          else callback(error, {count: count});
        });
        return;
    case('distinct'):
        return find.distinct(q.f, q.q, callback); 
    case('aggregate'):
        return find.aggregate(q.q, q.s, callback);
    case('mapReduce'):
        var o = {};
        try{
          //eval("(function(x) { return x*x})");
          o.map = eval(q.map);
          o.reduce = eval(q.reduce);
          o.limit = q.l;
          o.query = q.q;
          if( q.scope ) o.scope = JSON.parse(decodeURIComponent(q.scope));
          if( q.finalize )  o.finalize = eval(decodeURIComponent(q.finalize));
          if(dbg)console.log(o);
          return find.mapReduce(o, callback);
        } catch(e){
          if(callback) {
            callback(e);
          }
          return e;
        }
        return;
    default: 
        console.log('not supported query type');
        return;
  }
  
  if( ['find','findOne'].indexOf(q.t) >= 0 ){
    
    if(q.s) find = find.sort(q.s);
    if(q.sk) find = find.skip(q.sk);
    if(q.l) find = find.limit(q.l);
    if(q.f) find = find.select(q.f);
    if(q.p) find = find.populate(q.p);

    if (options.lean) find = find.lean();
    
    if( q.t === 'findOne' ){
      if( q.fl ) {
        if (!callback) {
          return new Error("`flat` is not supported without callback"); 
        }
        find.findOne( function(error, doc){
          if(error) callback(error);
          else {
            callback(error, flatten(doc));
          }
        })
      } else {
        return find.findOne(callback);
      }
    } else {
      if( q.fl ) {
        if (!callback) {
          return new Error("`flat` is not supported without callback");
        }
        find.find( function(error, docs){
          if(error) callback(error);
          else {
            var arr = [];
            docs.forEach( function(doc){
              var json = doc.toJSON({virtuals: true});
              arr.push( flatten(json));
            });
            callback(error, arr);
          }
        })
      } else {
        return find.exec(callback);
      }
    }  
  }
}

module.exports = exports = function QueryPlugin(schema, options) {
  schema.statics.query = schema.statics.Query = function(query, callback){
    options = options || {};
    options.lean = false;
    return doQuery(query, this, options, callback)
  }
  schema.statics.leanQuery = schema.statics.leanQuery = function(query, callback){
    options = options || {};
    options.lean = true;
    return doQuery(query, this, options, callback)
  }
}
