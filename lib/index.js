/**
  MONGOOSE QUERY GENERATOR FROM HTTP URL
  e.g.
  let QueryPlugin = require(mongoose-query);
  schema.plugin(QueryPlugin);
  mymodel.query(req.query, function(error, data){
  });

*/
const flatten = require('flat').flatten
  , _ = require('lodash')
  , mongoose = require('mongoose')
  , parseQuery = require('./parseQuery')
  , logger = require('./logger');

module.exports = function QueryPlugin (schema, options) {

  options = options || {};
  if(_.has(options, 'logger')) {
    logger.setLogger(logger);
  }
  let allowEval = _.get(options, 'allowEval', true);
  let doEval = (str) => {
    if(allowEval) {
      return eval(str);
    } else {
      return false;
    }
  }
  options = _.omit(options, ['logger', 'allowEval', 'lean']);

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
          this.count(q.q, (error,count) => {
            if(error) callback(error);
            else callback(error, {count});
          });
          return;
      case('distinct'):
          return this.distinct(q.f, q.q, callback);
      case('aggregate'):
          return this.aggregate(q.q, callback);
      case('mapReduce'):
          let o = {};
          try{
            //eval("(function(x) { return x*x})");
            o.map = doEval(q.map);
            o.reduce = doEval(q.reduce);
            o.limit = q.l;
            o.query = q.q;
            if( q.scope ) o.scope = JSON.parse(decodeURIComponent(q.scope));
            if( q.finalize )  o.finalize = doEval(decodeURIComponent(q.finalize));
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
      if(opt.lean) query = query.lean();
      if( q.t === 'findOne' ){
        if( q.fl ) {
          if (callback) {
            query.findOne((error, doc) => {
              if(error) callback(error);
              else callback(error, flatten(doc));
            });
          } else {
            return new Promise((resolve, reject) => {
              query.findOne((error, doc) => {
                if(error) reject(error);
                else resolve(flatten(doc));
              });
            });
          }
        } else {
          return query.findOne(callback);
        }
      } else {
        if (q.fl) {
          if (callback) {
            query.find((error, docs) => {
              if (error) callback(error);
              else {
                const arr = [];
                docs.forEach((doc) => {
                  const json = opt.lean ? doc : doc.toJSON({virtuals: true});
                  arr.push(flatten(json));
                });
                callback(error, arr);
              }
            });
          } else {
            return new Promise((resolve, reject) => {
              query.find((error, docs) => {
                if (error) reject(error);
                else {
                  const arr = [];
                  docs.forEach((doc) => {
                    const json = opt.lean ? doc : doc.toJSON({virtuals: true});
                    arr.push(flatten(json));
                  });
                  resolve(arr);
                }
              });
            });
          }
        } else {
          logger.debug('find..', callback);
          return query.exec(callback);
        }
      }
    }
  }
  let query = function (data, callback) {
    return doQuery.bind(this)(data, options, callback);
  };
  schema.static('query', query);

  let leanQuery = function (data, callback) {
    return doQuery.bind(this)(data,
        _.defaults({lean: true}, options),
        callback);
  };
  schema.static('leanQuery', leanQuery);
}
