/* Node.js official modules */
const fs = require('fs')
/* 3rd party modules */
  , _ = require('lodash')
  , mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , type = require('type-detect')
  , chai = require('chai')
  , assert = chai.assert
  , expect = chai.expect
/* QueryPlugin itself */
  , Query = require('../')
  , parseQuery = require('../lib/parseQuery')
  , {parseDateCustom} = require('../lib/tools');

mongoose.Promise = Promise;

let isPromise = function (obj) {
  return !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.then === 'function';
};
let assertPromise = function(obj) {
  expect(isPromise(obj)).to.be.true;
};

const ObjectId = Schema.ObjectId;
let OrigSchema = new mongoose.Schema({
  value: {type: String, default: 'original'}
});
let TestSchema = new mongoose.Schema({
    title  : { type: String, index: true }
  , msg    : { type: String, lowercase: true, trim: true }
  , date   : {type: Date, default: Date.now}
  , empty  : {type: String}
  , orig   : {type: ObjectId, ref: 'originals' }
  , i      : {type: Number, index: true }
  , arr    : [
      {ay: {type: String}}
    ]
  , nest   : {
    ed: {type: String, default: 'value'}
  }
});
TestSchema.plugin(Query);

const OrigTestModel = mongoose.model('originals', OrigSchema);
const TestModel = mongoose.model('test', TestSchema);
const docCount = 4000;
const defaultLimit = 1000;
let _id;

let create = (i, max, callback) => {
  if( i<max -1){
    let obj = new TestModel({title: (i%2===0?'testa':'testb'), msg: 'i#'+i, orig: _id, i: i, arr: [{ay: `i#${i}`}]});
    obj.save( (error, doc) => {
      create(i+1, max, callback);
    });
  }
  else {
    let obj = new TestModel({_id: "57ae125aaf1b792c1768982b", title: (i%2===0?'testa':'testb'), msg: 'i#'+i, orig: _id, i: i});
    obj.save( (error, doc) => {
      callback();
    });
  }
};

describe('unittests', function() {
  describe('parseDateCustom', function () {
    it('is not valid date', function () {
      assert.isNaN(parseDateCustom("2000"));
      assert.isNaN(parseDateCustom("1000128123"));
      assert.isNaN(parseDateCustom("2011A1020"));
      assert.isNaN(parseDateCustom(""));
      assert.isNaN(parseDateCustom());
    });
    it('is valid', function () {
      assert.isTrue(_.isDate(parseDateCustom("2017/09/10")));
      assert.isTrue(_.isDate(parseDateCustom("31/2/2010")));
      assert.isTrue(_.isDate(parseDateCustom("2011-10-10T14:48:00"))); // ISO 8601 with time
      assert.isTrue(_.isDate(parseDateCustom("2011-10-10"))); // ISO 8601
    });
  });
  it('parseQuery', function() {
    let defaultResp = {
      q: {},
      map: "",
      reduce: "",
      t: "find",
      f: false,
      s: false,
      sk: false,
      l: 1000,
      p: false,
      fl: false
    };
     assert.deepEqual(parseQuery({q: '{"a": "b"}'}),
                     _.defaults({q: {a: 'b'}}, defaultResp));
     assert.deepEqual(parseQuery({t: 'count'}),
                     _.defaults({t: 'count'}, defaultResp));
     assert.deepEqual(parseQuery({p: 'a'}),
                     _.defaults({p: 'a'}, defaultResp));
     assert.deepEqual(parseQuery({p: '["a","b"]'}),
                     _.defaults({p: ['a','b']}, defaultResp));
     assert.deepEqual(parseQuery({p: '{"a":"b"}'}),
                     _.defaults({p: {a:"b"}}, defaultResp));
     assert.deepEqual(parseQuery({p: 'a,b'}),
                     _.defaults({p: ['a','b']}, defaultResp));
     assert.deepEqual(parseQuery({l: '101'}),
                    _.defaults({l: 101}, defaultResp));
    assert.deepEqual(parseQuery({limit: '101'}),
                   _.defaults({l: 101}, defaultResp));
     assert.deepEqual(parseQuery({skips: '101'}),
                  _.defaults({sk: 101}, defaultResp));
     assert.deepEqual(parseQuery({$1: 'a'}), defaultResp);
     assert.deepEqual(parseQuery({a: '{in}a,b'}),
                  _.defaults({q: {a: {$in: ['a','b']}}}, defaultResp));
     assert.deepEqual(parseQuery({a: '{m}k,v'}),
                 _.defaults({q: {a: {$elemMatch: {k: 'v'}}}}, defaultResp));
     assert.deepEqual(parseQuery({a: '{empty}'}),
                 _.defaults({q: {$or: [{a: ''}, {a: {$exists: false}}]}}, defaultResp));
     assert.deepEqual(parseQuery({a: '{!empty}'}),
                 _.defaults({q: {$nor: [{a: ''}, {a: {$exists: false}}]}}, defaultResp));
     assert.deepEqual(parseQuery({a: 'b|c|d'}),
                 _.defaults({q: {$or: [{a: 'b'}, {a: 'c'}, {a: 'd'}]}}, defaultResp));

  });
});
describe('Query:basic', function() {
  before(function(done){
    const useMongoClient = true;
    mongoose.connect("mongodb://localhost/mongoose-query-tests", {useMongoClient});
    mongoose.connection.on('connected', done);
  });
  before(function(done) {
    this.timeout(10000);
    let obj = new OrigTestModel();
    obj.save((error, doc) => {
       _id = doc._id;
       TestModel.remove({}, () => {
        create(0, docCount, done);
      });
    });
  });
  after(function(done) {
    OrigTestModel.remove({}, done);
  });
  after(function(done) {
    TestModel.remove({}, done);
  });
  after(function(done) {
    mongoose.disconnect(done);
  });

  it('find', function(done) {
    const req = {q:'{}'};
    TestModel.query(req, function(error, data){
      assert.equal( error, undefined );

      const validateData = (obj) => {
        assert.equal(obj.length, defaultLimit);
        assert.isTrue((obj[0].orig + '').match(/([0-9a-z]{24})/) != null);
        _.each(obj, (doc) => {
          assert.isTrue(!_.isPlainObject(doc))
        });
      };
      validateData(data);
      //alternative:
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('regex', function(done) {
    const req = {q:'{"title": {"$regex": "/^testa/"}, "i": { "$lt": 20}}'};
    TestModel.query(req, function(error, data){
      assert.equal( error, undefined );
      const validateData = (obj) => {
        assert.equal( obj.length, 10 );
        assert.isTrue( (obj[0].orig+'').match(/([0-9a-z]{24})/) != null );
      };
      validateData(data);
      //alternative
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('findOne & sort', function(done) {
    const req = {q:'{}', t: 'findOne', s: '{"msg": 1}'};
    TestModel.query(req, function(error, data){
      assert.equal( error, undefined );
      const validateData = (obj) => {
        assert.typeOf(obj, 'Object');
        assert.equal(obj.title, 'testa');
        assert.equal(obj.msg, 'i#0');
      };
      validateData(data);
      //alternative
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('exact', function(done) {
    const req = {q:'{"msg":"i#3"}'};
    TestModel.query(req, function(error, data){
      assert.equal( error, undefined );
      const validateData = (obj) => {
        assert.equal(obj.length, 1);
        assert.equal(obj[0].msg, "i#3");
      };
      validateData(data);
      //alternative
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('populate', function(done) {
    const req = {q:'{"msg":"i#3"}', p: 'orig'};
    TestModel.query(req, function(error, data){
      assert.equal( error, undefined );
      const validateData = (obj) => {
        assert.equal(obj.length, 1);
        assert.equal(obj[0].msg, "i#3");
        assert.equal(obj[0].orig.value, "original");
      };
      validateData(data);
      //alternative
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('limit & select', function(done) {
    const req = {q:'{}', f: 'title', l:'3', s: '{"title": -1}'};
    TestModel.query(req, function(error, data){
      assert.equal( error, undefined );
      const validateData = (obj) => {
        assert.equal(obj.length, 3);
        assert.equal(obj[0].msg, undefined);
        assert.equal(obj[0].title, "testb");
        assert.equal(obj[1].msg, undefined);
        assert.equal(obj[1].title, "testb");
        assert.equal(obj[2].msg, undefined);
        assert.equal(obj[2].title, "testb");
      };
      validateData(data);
      //alternative
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });

  it('skip', function(done) {
    const req = {q:'{}', sk:'3'};
    TestModel.query(req, function(error, data){
      assert.equal( error, undefined );
      const validateData = (obj) => {
        assert.equal( obj.length, defaultLimit );
      };
      validateData(data);
      //alternative
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });

  it('count', function(done) {
    const req = {q:'{"$or": [ {"msg":"i#1"}, {"msg":"i#2"}]}', t:'count'};
    TestModel.query(req, function(error, data){
      assert.equal( error, undefined );
      const validateData = (obj) => {
        assert.typeOf(obj, 'object');
        assert.equal(obj.count, 2);
      };
      validateData(data);
      //alternative
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });

  it('distinct', function(done) {
    const req = {f:'title', t:'distinct'};
    TestModel.query(req, function(error, data){
      assert.equal( error, undefined );
      assert.equal( data.length, 2 );
      //alternative
      assertPromise(TestModel.query(req));
      done();
    });
  });
  it('flatten', function(done) {
    const req = {q:'{}', fl: 'true', l:'1'};
    TestModel.query(req, function(error, data){
      assert.equal(error, undefined);
      const validateData = (obj) => {
        assert.typeOf(obj, 'array');
        obj.forEach(function (item) {
          assert.typeOf(item, 'object');
          assert.equal(item['nest.ed'], 'value')
        });
      };
      validateData(data);
      //this is not supported when no callback is used
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('!empty', function(done){
    //Field exists and is not empty
    const req = {'nest.ed': '{!empty}-'};
    TestModel.query(req, function(error, data){
      assert.equal(error, undefined);
      const validateData = (obj) => {
        assert.equal(obj[0].nest.ed, 'value');
      };
      validateData(data);
      //this is not supported when no callback is used
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('!empty', function(done){
    //Field exists and is not empty
    const req = {'empty': '{!empty}-'};
    TestModel.query(req, function(error, data){
      assert.equal(error, undefined);
      const validateData = (obj) => {
        assert.equal(obj.length, 0);
      };
      validateData(data);
      //this is not supported when no callback is used
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('empty', function(done){
    //Field is empty or not exists
    const req = {'empty': '{empty}-'};
    TestModel.query(req, function(error, data){
      assert.equal(error, undefined);
      const validateData = (obj) => {
        assert.equal(obj.length, defaultLimit);
      };
      validateData(data);
      //this is not supported when no callback is used
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('limit more than default', function(done){
    //Field is empty or not exists
    const req = {'l': '2000'};
    TestModel.query(req, function(error, data){
      assert.equal(error, undefined);
      const validateData = (obj) => {
        assert.equal(obj.length, 2000);
      };
      validateData(data);
      //this is not supported when no callback is used
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('limit with skip', function(done){
    //Field is empty or not exists
    var req = {'l': '2000', 'sk': '2500'};
    TestModel.query(req, function(error, data) {
      assert.equal(error, undefined);
      const validateData = (obj) => {
        assert.equal(obj.length, 1500);
      };
      validateData(data);
      //this is not supported when no callback is used
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('limit with filter', function(done){
    //Field is empty or not exists
    const req = {'l': '2000', 'q': '{ "title": "testa"}'};
    TestModel.query(req, function(error, data){
      assert.equal(error, undefined);
      const validateData = (obj) => {
        assert.equal(obj.length, 2000);
      };
      validateData(data);
      //this is not supported when no callback is used
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('limit with sort', function(done){
    //Field is empty or not exists
    var req = {'l': '2000', 's': '{ "i": -1 }'};
    TestModel.query(req, function(error, data){
      assert.equal(error, undefined);
      const validateData = (obj) => {
        assert.equal(obj.length, 2000);
      };
      validateData(data);
      //this is not supported when no callback is used
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('oid wildcard', function(done) {
    var req = {q:'{"_id": "oid:57ae125aaf1b792c1768982b"}'};
    TestModel.query(req, function(error, data){
      assert.equal( error, undefined );
      const validateData = (obj) => {
        assert.equal( obj.length, 1);
        assert.equal( obj[0]._id, "57ae125aaf1b792c1768982b" );
      };
      validateData(data);
      //this is not supported when no callback is used
      const promise = TestModel.query(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('leanQuery', function(done) {
    const req = {};
    TestModel.leanQuery(req, function(error, data) {
      assert.equal( error, undefined );
      const validateData = (obj) => {
        assert.equal( obj.length, defaultLimit );
        _.each(obj, (json) => {
          assert.isTrue(_.isPlainObject(json))
        });
      };
      validateData(data);
      //this is not supported when no callback is used
      const promise = TestModel.leanQuery(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('leanQuery with flatten', function(done) {
    const req = {fl: 1};
    TestModel.leanQuery(req, function(error, data) {
      assert.equal( error, undefined );
      const validateData = (obj) => {
        assert.equal(obj.length, defaultLimit);
        _.each(obj, (json) => {
          assert.isTrue(_.isPlainObject(json))
        });
      };
      validateData(data);
      //this is not supported when no callback is used
      const promise = TestModel.leanQuery(req);
      assertPromise(promise);
      promise.then(validateData).then(done);
    });
  });
  it('number search', function (done) {
    const req = {i: '1'};
    TestModel.leanQuery(req, function(error, data) {
      assert.equal( error, undefined );
      assert.equal( data.length, 1);
      assert.equal( data[0].i, 1);
      done();
    });
  });
  it('match', function (done) {
    const req = {arr: "{m}ay,i#1"};
    TestModel.leanQuery(req, function(error, data) {
      assert.equal(error, undefined );
      assert.equal(data.length, 1);
      assert.equal(data[0].arr[0].ay, 'i#1');
      done();
    });
  })
});
