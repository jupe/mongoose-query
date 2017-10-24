/* Node.js official modules */

/* 3rd party modules */
const _ = require('lodash');
const mongoose = require('mongoose');
const chai = require('chai');

const { Schema } = mongoose;
const { assert, expect } = chai;

/* QueryPlugin itself */
const Query = require('../');
const parseQuery = require('../lib/parseQuery');
const { parseDateCustom } = require('../lib/tools');

mongoose.Promise = Promise;

const isPromise = function (obj) {
  return !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.then === 'function';
};
const assertPromise = function (obj) {
  expect(isPromise(obj)).to.be.true;
};

const { ObjectId } = Schema;
const OrigSchema = new mongoose.Schema({
  value: { type: String, default: 'original' }
});
const TestSchema = new mongoose.Schema({
  title: { type: String, index: true },
  msg: { type: String, lowercase: true, trim: true },
  date: { type: Date, default: Date.now },
  empty: { type: String },
  orig: { type: ObjectId, ref: 'originals' },
  i: { type: Number, index: true },
  arr: [
    { ay: { type: String } }
  ],
  nest: {
    ed: { type: String, default: 'value' }
  }
});
TestSchema.plugin(Query);

const OrigTestModel = mongoose.model('originals', OrigSchema);
const TestModel = mongoose.model('test', TestSchema);

describe('unittests', function () {
  describe('parseDateCustom', function () {
    it('is not valid date', function () {
      assert.isNaN(parseDateCustom('2000'));
      assert.isNaN(parseDateCustom('1000128123'));
      assert.isNaN(parseDateCustom('2011A1020'));
      assert.isNaN(parseDateCustom(''));
      assert.isNaN(parseDateCustom());
    });
    it('is valid', function () {
      assert.isTrue(_.isDate(parseDateCustom('2017/09/10')));
      assert.isTrue(_.isDate(parseDateCustom('31/2/2010')));
      assert.isTrue(_.isDate(parseDateCustom('2011-10-10T14:48:00'))); // ISO 8601 with time
      assert.isTrue(_.isDate(parseDateCustom('2011-10-10'))); // ISO 8601
    });
  });
  describe('parseQuery', function () {
    const defaultResp = {
      q: {},
      map: '',
      reduce: '',
      t: 'find',
      f: false,
      s: false,
      sk: false,
      l: 1000,
      p: false,
      fl: false
    };
    const mergeResult = obj => _.merge({}, defaultResp, obj);


    it('option q(query as a json) is parsed correctly', function () {
      const date = new Date();
      assert.deepEqual(
        parseQuery({ q: `{"a": "b", "b": 1, "c": "${date.toISOString()}", "d": "oid:000000000000000000000000"}` }),
        mergeResult({
          q: {
            a: 'b', b: 1, c: date, d: '000000000000000000000000'
          }
        })
      );

      const aggregate = [
        {
          $match: {
            _id: '000000000000000000000000'
          }
        },
        {
          $group: {
            _id: '$_id',
            balance: { $sum: '$records.amount' }
          }
        }
      ];
      const q = JSON.stringify(aggregate);
      assert.deepEqual({ q, type: 'aggregate' }, { q, type: 'aggregate' });
      assert.throws(parseQuery.bind(this, { q: '{a: "a"' }), Error);
    });
    it('option t (type) is parsed correctly', function () {
      assert.deepEqual(
        parseQuery({ t: 'count' }),
        mergeResult({ t: 'count' })
      );
    });
    it('option p(populate) is parsed correctly', function () {
      assert.deepEqual(
        parseQuery({ p: 'a' }),
        mergeResult({ p: 'a' })
      );
      assert.deepEqual(
        parseQuery({ p: '["a","b"]' }),
        mergeResult({ p: ['a', 'b'] })
      );
      assert.deepEqual(
        parseQuery({ p: '{"a":"b"}' }),
        mergeResult({ p: { a: 'b' } })
      );
      assert.deepEqual(
        parseQuery({ p: 'a,b' }),
        mergeResult({ p: ['a', 'b'] })
      );
    });


    it('values are parsed correctly without option', function () {
      assert.deepEqual(
        parseQuery({ id: '000000000000000000000000' }),
        mergeResult({ q: { id: '000000000000000000000000' } })
      );
      assert.deepEqual(
        parseQuery({ id: '00000000000000000000000' }),
        mergeResult({ q: { id: 0 } })
      );
      assert.deepEqual(
        parseQuery({ q: '{"id":"000000000000000000000000"}' }),
        mergeResult({ q: { id: '000000000000000000000000' } })
      );

      const date = new Date();
      assert.deepEqual(
        parseQuery({ time: `${date.toISOString()}` }),
        mergeResult({ q: { time: date } })
      );
    });
    it('option l(limit) is parsed correctly', function () {
      assert.deepEqual(
        parseQuery({ l: '101' }),
        mergeResult({ l: 101 })
      );
      assert.deepEqual(
        parseQuery({ limit: '101' }),
        mergeResult({ l: 101 })
      );
      assert.deepEqual(
        parseQuery({ skips: '101' }),
        mergeResult({ sk: 101 })
      );
    });
    it('invalid keys thrown an error', function () {
      assert.throws(parseQuery.bind(this, { $1: 'a' }), Error);
      assert.throws(parseQuery.bind(this, { sort_by: undefined }), Error);
    });
    it('value operators is parsed properly', function () {
      assert.deepEqual(
        parseQuery({ a: '{in}a,b' }),
        mergeResult({ q: { a: { $in: ['a', 'b'] } } })
      );
      assert.deepEqual(
        parseQuery({ a: '{m}k,v' }),
        mergeResult({ q: { a: { $elemMatch: { k: 'v' } } } })
      );
      assert.deepEqual(
        parseQuery({ a: '{empty}' }),
        mergeResult({ q: { $or: [{ a: '' }, { a: { $exists: false } }] } })
      );
      assert.deepEqual(
        parseQuery({ a: '{!empty}' }),
        mergeResult({ q: { $nor: [{ a: '' }, { a: { $exists: false } }] } })
      );
      assert.deepEqual(
        parseQuery({ a: 'b|c|d' }),
        mergeResult({ q: { $or: [{ a: 'b' }, { a: 'c' }, { a: 'd' }] } })
      );
      assert.deepEqual(
        parseQuery({ a: '/a/' }),
        mergeResult({ q: { a: /a/ } })
      );
      assert.deepEqual(
        parseQuery({ a: '/a/i' }),
        mergeResult({ q: { a: /a/i } })
      );
    });
  });
});
describe('Query:apitests', function () {
  let origTestDocId;
  const _id = '57ae125aaf1b792c1768982b';
  let firstDate;
  let lastDate;

  const docCount = 4000;
  const defaultLimit = 1000;

  const create = (i, max, callback) => {
    if (i < max - 1) {
      const obj = new TestModel({
        title: (i % 2 === 0 ? 'testa' : 'testb'), msg: `i#${i}`, orig: origTestDocId, i, arr: [{ ay: `i#${i}` }]
      });
      obj.save(() => {
        if (!firstDate) firstDate = obj.date;
        create(i + 1, max, callback);
      });
    } else {
      const obj = new TestModel({
        _id, title: (i % 2 === 0 ? 'testa' : 'testb'), msg: `i#${i}`, orig: origTestDocId, i
      });
      lastDate = obj.date;
      obj.save(callback);
    }
  };

  before(function (done) {
    const useMongoClient = true;
    mongoose.connect('mongodb://localhost/mongoose-query-tests', { useMongoClient });
    mongoose.connection.on('connected', done);
  });
  before(function (done) {
    this.timeout(10000);
    const obj = new OrigTestModel();
    obj.save((error, doc) => {
      assert.equal(error, undefined);
      origTestDocId = doc._id;
      TestModel.remove({}, () => {
        create(0, docCount, done);
      });
    });
  });
  after(function (done) {
    OrigTestModel.remove({}, done);
  });
  after(function (done) {
    TestModel.remove({}, done);
  });
  after(function (done) {
    mongoose.disconnect(done);
  });

  it('find', function (done) {
    const req = { q: '{}' };
    TestModel.query(req, function (error, data) {
      assert.equal(error, undefined);

      const validateData = (obj) => {
        assert.equal(obj.length, defaultLimit);
        assert.isTrue((`${obj[0].orig}`).match(/([0-9a-z]{24})/) != null);
        _.each(obj, (doc) => {
          assert.isTrue(!_.isPlainObject(doc));
        });
      };
      validateData(data);
      // alternative:
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('findOne using objectid', function (done) {
    const req = { _id, t: 'findOne' };
    TestModel.query(req, function (error, data) {
      assert.equal(error, undefined);
      assert.equal(data._id, _id);
      done();
    });
  });
  it('regex', function (done) {
    const req = { q: '{"title": {"$regex": "/^testa/"}, "i": { "$lt": 20}}' };
    TestModel.query(req, function (error, data) {
      assert.equal(error, undefined);
      const validateData = (obj) => {
        assert.equal(obj.length, 10);
        assert.isTrue((`${obj[0].orig}`).match(/([0-9a-z]{24})/) != null);
      };
      validateData(data);
      // alternative
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('findOne & sort', function (done) {
    const req = { q: '{}', t: 'findOne', s: '{"msg": 1}' };
    TestModel.query(req, function (error, data) {
      assert.equal(error, undefined);
      const validateData = (obj) => {
        assert.typeOf(obj, 'Object');
        assert.equal(obj.title, 'testa');
        assert.equal(obj.msg, 'i#0');
      };
      validateData(data);
      // alternative
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('exact', function (done) {
    const req = { q: '{"msg":"i#3"}' };
    TestModel.query(req, function (error, data) {
      assert.equal(error, undefined);
      const validateData = (obj) => {
        assert.equal(obj.length, 1);
        assert.equal(obj[0].msg, 'i#3');
      };
      validateData(data);
      // alternative
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('populate', function (done) {
    const req = { q: '{"msg":"i#3"}', p: 'orig' };
    TestModel.query(req, function (error, data) {
      assert.equal(error, undefined);
      const validateData = (obj) => {
        assert.equal(obj.length, 1);
        assert.equal(obj[0].msg, 'i#3');
        assert.equal(obj[0].orig.value, 'original');
      };
      validateData(data);
      // alternative
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('limit & select', function (done) {
    const req = {
      q: '{}', f: 'title', l: '3', s: '{"title": -1}'
    };
    TestModel.query(req, function (error, data) {
      assert.equal(error, undefined);
      const validateData = (obj) => {
        assert.equal(obj.length, 3);
        assert.equal(obj[0].msg, undefined);
        assert.equal(obj[0].title, 'testb');
        assert.equal(obj[1].msg, undefined);
        assert.equal(obj[1].title, 'testb');
        assert.equal(obj[2].msg, undefined);
        assert.equal(obj[2].title, 'testb');
      };
      validateData(data);
      // alternative
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });

  it('skip', function (done) {
    const req = { q: '{}', sk: '3' };
    TestModel.query(req, function (error, data) {
      assert.equal(error, undefined);
      const validateData = (obj) => {
        assert.equal(obj.length, defaultLimit);
      };
      validateData(data);
      // alternative
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });

  it('count', function (done) {
    const req = { q: '{"$or": [ {"msg":"i#1"}, {"msg":"i#2"}]}', t: 'count' };
    TestModel.query(req, function (error, data) {
      assert.equal(error, undefined);
      const validateData = (obj) => {
        assert.typeOf(obj, 'object');
        assert.equal(obj.count, 2);
      };
      validateData(data);
      // alternative
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });

  it('distinct', function (done) {
    const req = { f: 'title', t: 'distinct' };
    TestModel.query(req, function (error, data) {
      assert.equal(error, undefined);
      assert.equal(data.length, 2);
      // alternative
      assertPromise(TestModel.query(req));
      done();
    });
  });
  it('flatten', function (done) {
    const req = { q: '{}', fl: 'true', l: '1' };
    TestModel.query(req, function (error, data) {
      assert.equal(error, undefined);
      const validateData = (obj) => {
        assert.typeOf(obj, 'array');
        obj.forEach(function (item) {
          assert.typeOf(item, 'object');
          assert.equal(item['nest.ed'], 'value');
        });
      };
      validateData(data);
      // this is not supported when no callback is used
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('!empty', function (done) {
    // Field exists and is not empty
    const req = { 'nest.ed': '{!empty}-' };
    TestModel.query(req, function (error, data) {
      assert.equal(error, undefined);
      const validateData = (obj) => {
        assert.equal(obj[0].nest.ed, 'value');
      };
      validateData(data);
      // this is not supported when no callback is used
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('!empty', function (done) {
    // Field exists and is not empty
    const req = { empty: '{!empty}-' };
    TestModel.query(req, function (error, data) {
      assert.equal(error, undefined);
      const validateData = (obj) => {
        assert.equal(obj.length, 0);
      };
      validateData(data);
      // this is not supported when no callback is used
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('empty', function (done) {
    // Field is empty or not exists
    const req = { empty: '{empty}-' };
    TestModel.query(req, function (error, data) {
      assert.equal(error, undefined);
      const validateData = (obj) => {
        assert.equal(obj.length, defaultLimit);
      };
      validateData(data);
      // this is not supported when no callback is used
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('limit more than default', function (done) {
    // Field is empty or not exists
    const req = { l: '2000' };
    TestModel.query(req, function (error, data) {
      assert.equal(error, undefined);
      const validateData = (obj) => {
        assert.equal(obj.length, 2000);
      };
      validateData(data);
      // this is not supported when no callback is used
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('limit with skip', function (done) {
    // Field is empty or not exists
    const req = { l: '2000', sk: '2500' };
    TestModel.query(req, function (error, data) {
      assert.equal(error, undefined);
      const validateData = (obj) => {
        assert.equal(obj.length, 1500);
      };
      validateData(data);
      // this is not supported when no callback is used
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('limit with filter', function (done) {
    // Field is empty or not exists
    const req = { l: '2000', q: '{ "title": "testa"}' };
    TestModel.query(req, function (error, data) {
      assert.equal(error, undefined);
      const validateData = (obj) => {
        assert.equal(obj.length, 2000);
      };
      validateData(data);
      // this is not supported when no callback is used
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('limit with sort', function (done) {
    // Field is empty or not exists
    const req = { l: '2000', s: '{ "i": -1 }' };
    TestModel.query(req, function (error, data) {
      assert.equal(error, undefined);
      const validateData = (obj) => {
        assert.equal(obj.length, 2000);
      };
      validateData(data);
      // this is not supported when no callback is used
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('oid wildcard', function (done) {
    const req = { q: `{"_id": "${_id}"}` };
    TestModel.query(req, function (error, data) {
      assert.equal(error, undefined);
      const validateData = (obj) => {
        assert.equal(obj.length, 1);
        assert.equal(obj[0]._id, `${_id}`);
      };
      validateData(data);
      // this is not supported when no callback is used
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('leanQuery', function (done) {
    const req = {};
    TestModel.leanQuery(req, function (error, data) {
      assert.equal(error, undefined);
      const validateData = (obj) => {
        assert.equal(obj.length, defaultLimit);
        _.each(obj, (json) => {
          assert.isTrue(_.isPlainObject(json));
        });
      };
      validateData(data);
      // this is not supported when no callback is used
      const promise = TestModel.leanQuery(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('leanQuery with flatten', function (done) {
    const req = { fl: 1 };
    TestModel.leanQuery(req, function (error, data) {
      assert.equal(error, undefined);
      const validateData = (obj) => {
        assert.equal(obj.length, defaultLimit);
        _.each(obj, (json) => {
          assert.isTrue(_.isPlainObject(json));
        });
      };
      validateData(data);
      // this is not supported when no callback is used
      const promise = TestModel.leanQuery(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('number search', function (done) {
    const req = { i: '1' };
    TestModel.leanQuery(req, function (error, data) {
      assert.equal(error, undefined);
      assert.equal(data.length, 1);
      assert.equal(data[0].i, 1);
      done();
    });
  });
  it('match', function (done) {
    const req = { arr: '{m}ay,i#1' };
    TestModel.leanQuery(req, function (error, data) {
      assert.equal(error, undefined);
      assert.equal(data.length, 1);
      assert.equal(data[0].arr[0].ay, 'i#1');
      done();
    });
  });
  it('aggregate', function () {
    const req = {
      q: JSON.stringify([
        {
          $match: {
            date: {
              $gt: firstDate.toString(),
              $lte: lastDate.toString()
            }
          }
        },
        {
          $group: {
            _id: '$title'
          }
        }
      ]),
      t: 'aggregate'
    };
    return TestModel.query(req).then((data) => {
      assert.deepEqual(data, [{ _id: 'testb' }, { _id: 'testa' }]);
    });
  });
});
