/**
  MONGOOSE QUERY GENERATOR FROM HTTP URL
  e.g.
  let QueryPlugin = require(mongoose-query);
  schema.plugin(QueryPlugin);
  mymodel.query(req.query, function(error, data){
  });

*/
const { flatten } = require('flat');
const _ = require('lodash');
const parseQuery = require('./parseQuery');
const logger = require('./logger');

function QueryPlugin(schema, options = {}) {
  _.defaults(options, { allowEval: true });
  if (_.has(options, 'logger')) {
    logger.setLogger(logger);
  }
  const doEval = (str) => {
    if (options.allowEval) {
      // eslint-disable-next-line no-eval
      return eval(str);
    }
    return false;
  };
  // eslint-disable-next-line no-param-reassign
  options = _.omit(options, ['logger', 'allowEval', 'lean']);
  const leanOptions = _.defaults({ lean: true }, options);

  const tmp = {};
  function doQuery(data, opt, callback) {
    logger.debug('doQuery:', data, opt, callback);
    const q = parseQuery(data, opt);
    logger.debug('q:', JSON.stringify(q));
    let query;
    switch (q.t) {
      case ('find'):
      case ('findOne'):
        query = this.find(q.q);
        logger.debug('find:', q.q);
        break;
      case ('count'):
        if (!callback) {
          return this.count(q.q).exec().then(count => ({ count }));
        }
        return this.count(q.q, (error, count) => {
          if (error) callback(error);
          else callback(error, { count });
        });
      case ('distinct'):
        return this.distinct(q.f, q.q, callback);
      case ('aggregate'):
        return this.aggregate(q.q).exec(callback);
      case ('mapReduce'):
        try {
          // eval("(function(x) { return x*x})");
          tmp.map = doEval(q.map);
          tmp.reduce = doEval(q.reduce);
          tmp.limit = q.l;
          tmp.query = q.q;
          if (q.scope) tmp.scope = JSON.parse(decodeURIComponent(q.scope));
          if (q.finalize) tmp.finalize = doEval(decodeURIComponent(q.finalize));
          logger.debug('mapReduce:', tmp);
          return this.mapReduce(tmp, callback);
        } catch (e) {
          if (callback) {
            callback(e);
          }
          return e;
        }

      default:
        logger.error('not supported query type');
        return {};
    }

    if (['find', 'findOne'].indexOf(q.t) >= 0) {
      if (q.s) query = query.sort(q.s);
      if (q.sk) query = query.skip(q.sk);
      if (q.l) query = query.limit(q.l);
      if (q.f) query = query.select(q.f);
      if (q.p) query = query.populate(q.p);
      if (opt.lean) query = query.lean();
      if (q.t === 'findOne') {
        if (q.fl) {
          if (callback) {
            query.findOne((error, doc) => {
              if (error) callback(error);
              else callback(error, flatten(doc));
            });
          } else {
            return new Promise((resolve, reject) => {
              query.findOne((error, doc) => {
                if (error) reject(error);
                else resolve(flatten(doc));
              });
            });
          }
        } else {
          return query.findOne(callback);
        }
      } else if (q.fl) {
        if (callback) {
          query.find((error, docs) => {
            if (error) {
              return callback(error);
            }

            const arr = [];
            docs.forEach((doc) => {
              const json = opt.lean ? doc : doc.toJSON({ virtuals: true });
              arr.push(flatten(json));
            });
            return callback(error, arr);
          });
        } else {
          return new Promise((resolve, reject) => {
            query.find((error, docs) => {
              if (error) {
                return reject(error);
              }
              const arr = [];
              docs.forEach((doc) => {
                const json = opt.lean ? doc : doc.toJSON({ virtuals: true });
                arr.push(flatten(json));
              });
              return resolve(arr);
            });
          });
        }
      } else {
        logger.debug('find..', callback);
        return query.exec(callback);
      }
    }
    return undefined;
  }
  function defaultQuery(data, callback) {
    return doQuery.bind(this)(data, options, callback);
  }
  // eslint-disable-next-line no-param-reassign
  schema.query.query = defaultQuery;
  schema.static('query', defaultQuery);

  function leanQuery(data, callback) {
    return doQuery.bind(this)(data, leanOptions, callback);
  }
  // eslint-disable-next-line no-param-reassign
  schema.query.leanQuery = leanQuery;
  schema.static('leanQuery', leanQuery);
}

QueryPlugin.parseQuery = parseQuery;

module.exports = QueryPlugin;
