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
  , parseQuery = require('../lib/parseQuery');

mongoose.Promise = Promise;

let isPromise = function (obj) {
  return !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.then === 'function';
}
let assertPromise = function(obj) {
  expect(isPromise(obj)).to.be.true;
}

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
    let obj = new TestModel({title: (i%2===0?'testa':'testb'), msg: 'i#'+i, orig: _id, i: i});
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
}


describe('Query:basic', function() {
  before( function(done){
    mongoose.connect(  "mongodb://localhost/mongoose-query-tests" );
    mongoose.connection.on('connected', done);
  });
  before( function(done) {
    OrigTestModel.remove({}, done);
  });
  before( function(done) {
    this.timeout(10000);
    let obj = new OrigTestModel();
    obj.save((error, doc) => {
       _id = doc._id;
       TestModel.remove({}, () => {
        create(0, docCount, done);
      });
    });
  })
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
                 _.defaults({q: {a: {$elemMatch: {key: 'k', value: 'v'}}}}, defaultResp));
     assert.deepEqual(parseQuery({a: '{empty}'}),
                 _.defaults({q: {$or: [{a: ''}, {a: {$exists: false}}]}}, defaultResp));
     assert.deepEqual(parseQuery({a: '{!empty}'}),
                 _.defaults({q: {$nor: [{a: ''}, {a: {$exists: false}}]}}, defaultResp));
     assert.deepEqual(parseQuery({a: 'b|c|d'}),
                 _.defaults({q: {$or: [{a: 'b'}, {a: 'c'}, {a: 'd'}]}}, defaultResp));

  });
  it('find', function(done) {
    var req = {q:'{}'};
    TestModel.query(req, function(error, data){
      assert.equal( error, undefined );
      assert.equal( data.length, defaultLimit );
      assert.isTrue( (data[0].orig+'').match(/([0-9a-z]{24})/) != null );
      //alternative:
      assertPromise(TestModel.query(req));
      done();
    });
  });
  it('regex', function(done) {
    var req = {q:'{"title": {"$regex": "/^testa/"}, "i": { "$lt": 20}}'};
    TestModel.query(req, function(error, data){
      assert.equal( error, undefined );
      assert.equal( data.length, 10 );
      assert.isTrue( (data[0].orig+'').match(/([0-9a-z]{24})/) != null );
      //alternative
      assertPromise(TestModel.query(req));
      done();
    });
  });
  it('findOne & sort', function(done) {
    var req = {q:'{}', t: 'findOne', s: '{"msg": 1}'};
    TestModel.query(req, function(error, data){
      assert.equal( error, undefined );
      assert.typeOf( data, 'Object' );
      assert.equal( data.title, 'testa' );
      assert.equal( data.msg, 'i#0' );
      //alternative
      assertPromise(TestModel.query(req));
      done();
    });
  });
  it('exact', function(done) {
    var req = {q:'{"msg":"i#3"}'};
    TestModel.query(req, function(error, data){
      assert.equal( error, undefined );
      assert.equal( data.length, 1 );
      assert.equal( data[0].msg, "i#3" );
      //alternative
      assertPromise(TestModel.query(req));
      done();
    });
  });
  it('populate', function(done) {
    var req = {q:'{"msg":"i#3"}', p: 'orig'};
    TestModel.query(req, function(error, data){
      assert.equal( error, undefined );
      assert.equal( data.length, 1 );
      assert.equal( data[0].msg, "i#3" );
      assert.equal( data[0].orig.value, "original" );
      //alternative
      assertPromise(TestModel.query(req));
      done();
    });
  });
  it('limit & select', function(done) {
    var req = {q:'{}', f: 'title', l:'3', s: '{"title": -1}'};
    TestModel.query(req, function(error, data){
      assert.equal( error, undefined );
      assert.equal( data.length, 3 );
      assert.equal( data[0].msg, undefined );
      assert.equal( data[0].title, "testb" );
      assert.equal( data[1].msg, undefined );
      assert.equal( data[1].title, "testb" );
      assert.equal( data[2].msg, undefined );
      assert.equal( data[2].title, "testb" );
      //alternative
      assertPromise(TestModel.query(req));
      done();
    });
  });

  it('skip', function(done) {
    var req = {q:'{}', sk:'3'};
    TestModel.query(req, function(error, data){
      assert.equal( error, undefined );
      assert.equal( data.length, defaultLimit );
      //alternative
      assertPromise(TestModel.query(req));
      done();
    });
  });

  it('count', function(done) {
    var req = {q:'{"$or": [ {"msg":"i#1"}, {"msg":"i#2"}]}', t:'count'};
    TestModel.query(req, function(error, data){
      assert.equal( error, undefined );
      assert.typeOf( data, 'object' );
      assert.equal( data.count, 2 );
      //alternative
      assertPromise(TestModel.query(req));
      done();
    });
  });

  it('distinct', function(done) {
    var req = {f:'title', t:'distinct'};
    TestModel.query(req, function(error, data){
      assert.equal( error, undefined );
      assert.equal( data.length, 2 );
      //alternative
      assertPromise(TestModel.query(req));
      done();
    });
  });
  it('flatten', function(done) {
    var req = {q:'{}', fl: 'true', l:'1'};
    TestModel.query(req, function(error, data){
      assert.equal(error, undefined);
      assert.typeOf(data, 'array');
      data.forEach( function(item){
        assert.typeOf(item, 'object');
        assert.equal(item['nest.ed'], 'value')
      });
      //this is not supported when no callback is used
      assert.instanceOf(TestModel.query(req), Promise);
      done();
    });
  });
  it('!empty', function(done){
    //Field exists and is not empty
    var req = {'nest.ed': '{!empty}-'};
    TestModel.query(req, function(error, data){
      assert.equal(error, undefined);
      assert.equal(data[0].nest.ed, 'value');
      //alternative
      assertPromise(TestModel.query(req));
      done();
    });
  });
  it('!empty', function(done){
    //Field exists and is not empty
    var req = {'empty': '{!empty}-'};
    TestModel.query(req, function(error, data){
      assert.equal(error, undefined);
      assert.equal(data.length, 0);
      //alternative
      assertPromise(TestModel.query(req));
      done();
    });
  });
  it('empty', function(done){
    //Field is empty or not exists
    var req = {'empty': '{empty}-'};
    TestModel.query(req, function(error, data){
      assert.equal(error, undefined);
      assert.equal(data.length, defaultLimit);
      //alternative
      assertPromise(TestModel.query(req));
      done();
    });
  });
  it('limit more than default', function(done){
    //Field is empty or not exists
    var req = {'l': '2000'};
    TestModel.query(req, function(error, data){
      assert.equal(error, undefined);
      assert.equal(data.length, 2000);
      //alternative
      assertPromise(TestModel.query(req));
      done();
    });
  });
  it('limit with skip', function(done){
    //Field is empty or not exists
    var req = {'l': '2000', 'sk': '2500'};
    TestModel.query(req, function(error, data){
      assert.equal(error, undefined);
      assert.equal(data.length, 1500);
      //alternative
      assertPromise(TestModel.query(req));
      done();
    });
  });
  it('limit with filter', function(done){
    //Field is empty or not exists
    var req = {'l': '2000', 'q': '{ "title": "testa"}'};
    TestModel.query(req, function(error, data){
      assert.equal(error, undefined);
      assert.equal(data.length, 2000);
      //alternative
      assertPromise(TestModel.query(req));
      done();
    });
  });
  it('limit with sort', function(done){
    //Field is empty or not exists
    var req = {'l': '2000', 's': '{ "i": -1 }'};
    TestModel.query(req, function(error, data){
      assert.equal(error, undefined);
      assert.equal(data.length, 2000);
      //alternative
      assertPromise(TestModel.query(req));
      done();
    });
  });
  it('oid wildcard', function(done) {
    var req = {q:'{"_id": "oid:57ae125aaf1b792c1768982b"}'};
    TestModel.query(req, function(error, data){
      assert.equal( error, undefined );
      assert.equal( data.length, 1);
      assert.equal( data[0]._id, "57ae125aaf1b792c1768982b" );

      //alternative
      assertPromise(TestModel.query(req));
      done();
    });
  });
});
