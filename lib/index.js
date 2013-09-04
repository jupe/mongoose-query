/**
  MONGOOSE QUERY GENERATOR FROM HTTP URL
  e.g.
  var query = require(mongoose-query);
  query(req.query, mymodel, function(error, data){
  });
  
*/

var dbg = false;

var parseQuery = function(query){
  /**
  [q=<query>][&t=<type>][&f=<fields>][&s=<order>][&sk=<skip>][&l=<limit>][&p=<populate>]
  q=<query> - restrict results by the specified JSON query
  t=<type> - find|findOne|count|aggregate|distinct..
  f=<set of fields> - specify the set of fields to include or exclude in each document (1 - include; 0 - exclude)
  s=<sort order> - specify the order in which to sort each specified field (1- ascending; -1 - descending)
  sk=<num results to skip> - specify the number of results to skip in the result set; useful for paging
  l=<limit> - specify the limit for the number of results (default is 1000)
  p=<populate> - specify the fields for populate
  */
  var qy = {
    q: {},      //  query
    t: 'find',   //  count
    f: false,      // fields
    s: false,      //  sort
    sk: false,      //  skip
    l: 1000,     //  limit
    p: false    //populate
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
  
  for(var key in query){
    switch(key) {
      case('q'): qy.q = toJSON(query[key]); break;
      case('t'): qy.t = query[key]; break;
      case('f'): qy.f = query[key]; break;
      case('s'): qy.s = toJSON(query[key]); break;
      case('sk'): qy.sk = parseInt(query[key]); break;
      case('l'): qy.l = parseInt(query[key]); break;
      case('p'): qy.p = query[key]; break;
      default: 
        qy.q[key] = query[key];
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
        find.count(q.q, callback);
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
      find.findOne(callback);
    } else {
      find.execFind(callback);
    }
      
  }
}

module.exports = doQuery;