/**
  MONGOOSE QUERY GENERATOR FROM HTTP URL
  e.g.
  var query = require(mongoose-query);
  query(req.query, mymodel).exec(function(error, data){
  });
  
*/

var parseQuery = function(query){
  /**
  [q=<query>][&c=true][&f=<fields>][&fo=true][&s=<order>][&sk=<skip>][&l=<limit>]
  q=<query> - restrict results by the specified JSON query
  c=true - return the result count for this query
  f=<set of fields> - specify the set of fields to include or exclude in each document.
  fo=true - return a single document from the result set (same as findOne() using the mongo shell
  s=<sort order> - specify the order in which to sort each specified field (1- ascending; -1 - descending)
  p=<set of fields> - specify the set of fields to populate in each document
  sk=<num results to skip> - specify the number of results to skip in the result set; useful for paging
  l=<limit> - specify the limit for the number of results (default is 1000)
  */
  var qy = {
    q: {},      //  query
    c: false,   //  count
    f: '',      // fields
    fo: false,  //  findOne / find
    s: {},      //  sort
    sk: 0,      //  skip
    l: 1000,     //  limit
    p: false
  }
  
  var toJSON = function(str){
    var json = {}
    try{
      json = JSON.parse(str);
    } catch(e){
      json = {};
    } 
    return json;
  }
  
  for(var key in query){
    switch(key) {
      case('q'): qy.q = toJSON(query[key]); break;
      case('c'): qy.c = query[key]=='true'?true:false; break;
      case('f'): qy.f = query[key]; break;
      case('fo'): qy.fo = query[key]=='false'?false:true; break;
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
var doQuery = function(query, model)
{
  var query = parseQuery(query);
  console.log(query);
  var find = model;
  if( query.f) find = find.select(query.f);
  
  if( query.fo ) {
    find = find.findOne(query.q);
  } else {
    find = find.find(query.q);
  } 
  if( query.c ){
    find = find.count();
    return find;
  }
  
  if( query.l ) find = find.limit(query.l);
  if( query.sk ) find = find.skip(query.sk);
  if( query.s ) find = find.sort(query.s);
  if( query.p) find = find.populate(query.q);
  
  return find;
}

module.exports = doQuery;
