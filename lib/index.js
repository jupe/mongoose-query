/**
  MONGOOSE QUERY GENERATOR FROM HTTP URL
  e.g.
  var query = require(mongoose-query);
  query(req.query, mymodel, function(error, data){
  });
  
*/

var dbg = false;
var flatten = require('flat').flatten;
var parseQuery = function(query){
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
  
  "key={mod}a,b"
  "Docs where key mod a is b"
  
  "key={gt}a"
  "Docs key is greater than a"
  
  "key={lt}a"
  "Docs key is lower than a"
  
  */
  
  var qy = {
    q: {},      //  query
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
          addCondition('$or', [ {lcKey: ''}, {lcKey: {'$exists': false} } ] );
        } else if(operator == 'c') {
          val = val.split('/');
          addCondition(lcKey, new RegExp(val[0], val[1]));
        } else {
          var parts = val.split(',');
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
  
  for(var key in query){
    switch(key) {
      case('q'): qy.q = toJSON(query[key]); break;
      case('t'): qy.t = query[key]; break;
      case('f'): qy.f = query[key]; break;
      case('s'): qy.s = toJSON(query[key]); break;
      case('sk'): qy.sk = parseInt(query[key]); break;
      case('l'): qy.l = parseInt(query[key]); break;
      case('p'): qy.p = query[key]; break;
      case('fl'): qy.fl = query[key]=='true'?true:false; break;
      default: 
        parseParam(key, query[key]);
        break;
    }
  }
  return qy;
}
var doQuery = function(query, model, callback)
{
  if(dbg)console.log(query);
  var q = parseQuery(query);
  if(!model)return q;
  if(dbg)console.log(q);
  var find = model;
  
  switch(q.t){
    case('find'): 
    case('findOne'):    
        find = find.find(q.q);
        break;
    case('count'):
        find.count(q.q, function(error,count){
          if(error) callback(error);
          else callback(error, {count: count});
        });
        return;
    case('distinct'):
        find.distinct(q.f, q.q, callback);
        return; 
    case('aggregate'):
        find.aggregate(q.q, q.s, callback);
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
    
    if( q.t === 'findOne' ){
      if( q.fl ) {
        find.findOne( function(error, doc){
          if(error) callback(error);
          else {
            callback(error, flatten(doc));
          }
        })
      } else {find.findOne(callback);}
    } else {
      if( q.fl ) {
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
        find.execFind(callback);
      }
    }
      
  }
}

module.exports = doQuery;
