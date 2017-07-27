/**
  MONGOOSE QUERY GENERATOR FROM HTTP URL
  e.g.
  var QueryPlugin = require(mongoose-query);
  schema.plugin(QueryPlugin);
  mymodel.query(req.query, function(error, data){
  });

*/
const util = require('util')
  , flatten = require('flat').flatten
  , _ = require('lodash')
  , parseQuery = require('./parseQuery')
  , mongoose = require('mongoose');

let dummyLogger = ()=>{};
let logger =  {
  debug: dummyLogger, //console.log,
  error: dummyLogger
}
module.exports = function QueryPlugin (schema, options) {

  let doQuery = function (data, opt, callback) {
    logger.debug('doQuery:', data, opt, callback);
    let q = parseQuery(data, opt);
    if(!this instanceof mongoose.Model) {
      return q;
    }
    logger.debug('q:', JSON.stringify(q));
    let query;
    switch(q.t){
      case('find'):
      case('findOne'):
          query = this.find(q.q);
          logger.debug('find:',q.q);
          break;
      case('count'):
          if (!callback) {
            return this.count(q.q);
          }
          this.count(q.q, function(error,count){
            if(error) callback(error);
            else callback(error, {count: count});
          });
          return;
      case('distinct'):
          return this.distinct(q.f, q.q, callback);
      case('aggregate'):
          return this.aggregate(q.q, callback);
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
            logger.debug("mapReduce:",o);
            return this.mapReduce(o, callback);
          } catch(e){
            if(callback) {
              callback(e);
            }
            return e;
          }
          return;
      default:
          logger.error('not supported query type');
          return;
    }

    if( ['find','findOne'].indexOf(q.t) >= 0 ){

      if(q.s) query = query.sort(q.s);
      if(q.sk) query = query.skip(q.sk);
      if(q.l) query = query.limit(q.l);
      if(q.f) query = query.select(q.f);
      if(q.p) query = query.populate(q.p);

      if (opt.lean) query = query.lean();

      if( q.t === 'findOne' ){
        if( q.fl ) {
          if (!callback) {
            return new Error("`flat` is not supported without callback");
          }
          query.findOne( function(error, doc){
            if(error) callback(error);
            else {
              callback(error, flatten(doc));
            }
          })
        } else {
          return query.findOne(callback);
        }
      } else {
        if( q.fl ) {
          if (!callback) {
            return new Error("`flat` is not supported without callback");
          }
          query.find( function(error, docs){
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
          logger.debug('find..', callback);
          return query.exec(callback);
        }
      }
    }
  }
  let qOpts = _.defaults({lean: false}, options);
  let query = function (data, callback) {
    return doQuery.bind(this)(data, qOpts, callback);
  };
  schema.static('query', query);
  schema.static('urlQuery', query);

  let lOpts = _.defaults({lean: true}, options);
  let leanQuery = function (query, callback) {
    return doQuery.bind(this)(query, lOpts, callback);
  }
  schema.static('leanQuery', leanQuery);
}
