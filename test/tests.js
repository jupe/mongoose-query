/* Node.js official modules */
var fs = require('fs')
/* 3rd party modules */
  , mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , assert = require('chai').assert
/* QueryPlugin itself */  
  , Query = require('../');
  
var ObjectId = Schema.ObjectId;
  
var OrigSchema = new mongoose.Schema({
  value: {type: String, default: 'original'}
});
var TestSchema = new mongoose.Schema({
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
var origModel = mongoose.model('originals', OrigSchema);
var model = mongoose.model('test', TestSchema);


mongoose.connect(  "mongodb://localhost/mongoose-query-tests", {} ); 
var _id = '123123';
var docCount = 4000;
var defaultLimit = 1000;
describe('Query:basic', function() {
  before( function(done){
    this.timeout(10000);
    
    var create = function(i, max, callback){
      if( i<max){
        var obj = new model({title: (i%2===0?'testa':'testb'), msg: 'i#'+i, orig: _id, i: i});
        obj.save( function(error, doc){
          create(i+1, max, callback);
        });
      } else {
        callback();
      }
    }
    mongoose.connection.on('connected', function(){
      origModel.remove({}, function(){
        var obj = new origModel();
        obj.save( function(error, doc){
           _id = doc._id;
           model.remove({}, function(){
            create(0, docCount, done);
          });
        });
      });     
    });
  });
  
  it('all', function(done) {
    var req = {q:'{}'};
    model.Query(req, function(error, data){
      assert.equal( error, undefined );
      assert.equal( data.length, defaultLimit );
      assert.isTrue( (data[0].orig+'').match(/([0-9a-z]{24})/) != null );
      //alternative:
      assert.instanceOf(model.Query(req), mongoose.Promise);
      done();
    });
  });
  it('regex', function(done) {
    var req = {q:'{"title": {"$regex": "/^testa/"}, "i": { "$lt": 20}}'};
    model.Query(req, function(error, data){
      assert.equal( error, undefined );
      assert.equal( data.length, 10 );
      assert.isTrue( (data[0].orig+'').match(/([0-9a-z]{24})/) != null );
      //alternative
      assert.instanceOf(model.Query(req), mongoose.Promise);
      done();
    });
  });
  it('findOne & sort', function(done) {
    var req = {q:'{}', t: 'findOne', s: '{"msg": 1}'};
    model.Query(req, function(error, data){
      assert.equal( error, undefined );
      assert.typeOf( data, 'Object' );
      assert.equal( data.title, 'testa' );
      assert.equal( data.msg, 'i#0' );
      //alternative
      assert.instanceOf(model.Query(req), mongoose.Query);
      done();
    });
  });
  it('exact', function(done) {
    var req = {q:'{"msg":"i#3"}'};
    model.Query(req, function(error, data){
      assert.equal( error, undefined );
      assert.equal( data.length, 1 );
      assert.equal( data[0].msg, "i#3" );
      //alternative
      assert.instanceOf(model.Query(req), mongoose.Promise);
      done();
    });
  });
  it('populate', function(done) {
    var req = {q:'{"msg":"i#3"}', p: 'orig'};
    model.Query(req, function(error, data){
      assert.equal( error, undefined );
      assert.equal( data.length, 1 );
      assert.equal( data[0].msg, "i#3" );
      assert.equal( data[0].orig.value, "original" );
      //alternative
      assert.instanceOf(model.Query(req), mongoose.Promise);
      done();
    });
  });
  it('limit & select', function(done) {
    var req = {q:'{}', f: 'title', l:'3', s: '{"title": -1}'};
    model.Query(req, function(error, data){
      assert.equal( error, undefined );
      assert.equal( data.length, 3 );
      assert.equal( data[0].msg, undefined );
      assert.equal( data[0].title, "testb" );
      assert.equal( data[1].msg, undefined );
      assert.equal( data[1].title, "testb" );
      assert.equal( data[2].msg, undefined );
      assert.equal( data[2].title, "testb" );
      //alternative
      assert.instanceOf(model.Query(req), mongoose.Promise);
      done();
    });
  });
  
  it('skip', function(done) {
    var req = {q:'{}', sk:'3'};
    model.Query(req, function(error, data){
      assert.equal( error, undefined );
      assert.equal( data.length, defaultLimit );
      //alternative
      assert.instanceOf(model.Query(req), mongoose.Promise);
      done();
    });
  });
  
  it('count', function(done) {
    var req = {q:'{"$or": [ {"msg":"i#1"}, {"msg":"i#2"}]}', t:'count'};
    model.Query(req, function(error, data){
      assert.equal( error, undefined );
      assert.typeOf( data, 'object' );
      assert.equal( data.count, 2 );
      //alternative
      assert.instanceOf(model.Query(req), mongoose.Query);
      done();
    });
  });
  
  it('distinct', function(done) {
    var req = {f:'title', t:'distinct'};
    model.Query(req, function(error, data){
      assert.equal( error, undefined );
      assert.equal( data.length, 2 );
      //alternative
      assert.instanceOf(model.Query(req), mongoose.Query);
      done();
    });
  });
  it('flatten', function(done) {
    var req = {q:'{}', fl: 'true', l:'1'};
    model.Query(req, function(error, data){
      assert.equal(error, undefined);
      assert.typeOf(data, 'array');
      data.forEach( function(item){
        assert.typeOf(item, 'object');
        assert.equal(item['nest.ed'], 'value')
      });
      //this is not supported when no callback is used
      assert.instanceOf(model.Query(req), Error);
      done();
    });
  });
  it('!empty', function(done){
    //Field exists and is not empty
    var req = {'nest.ed': '{!empty}-'};
    model.Query(req, function(error, data){
      assert.equal(error, undefined);
      assert.equal(data[0].nest.ed, 'value');
      //alternative
      assert.instanceOf(model.Query(req), mongoose.Promise);
      done();
    });
  });
  it('!empty', function(done){
    //Field exists and is not empty 
    var req = {'empty': '{!empty}-'};
    model.Query(req, function(error, data){
      assert.equal(error, undefined);
      assert.equal(data.length, 0);
      //alternative
      assert.instanceOf(model.Query(req), mongoose.Promise);
      done();
    });
  });
  it('empty', function(done){
    //Field is empty or not exists
    var req = {'empty': '{empty}-'};
    model.Query(req, function(error, data){
      assert.equal(error, undefined);
      assert.equal(data.length, defaultLimit);
      //alternative
      assert.instanceOf(model.Query(req), mongoose.Promise);
      done();
    });
  });
  it('limit more than default', function(done){
    //Field is empty or not exists
    var req = {'l': '2000'};
    model.Query(req, function(error, data){
      assert.equal(error, undefined);
      assert.equal(data.length, 2000);
      //alternative
      assert.instanceOf(model.Query(req), mongoose.Promise);
      done();
    });
  });
  it('limit with skip', function(done){
    //Field is empty or not exists
    var req = {'l': '2000', 'sk': '2500'};
    model.Query(req, function(error, data){
      assert.equal(error, undefined);
      assert.equal(data.length, 1500);
      //alternative
      assert.instanceOf(model.Query(req), mongoose.Promise);
      done();
    });
  });
  it('limit with filter', function(done){
    //Field is empty or not exists
    var req = {'l': '2000', 'q': '{ "title": "testa"}'};
    model.Query(req, function(error, data){
      assert.equal(error, undefined);
      assert.equal(data.length, 2000);
      //alternative
      assert.instanceOf(model.Query(req), mongoose.Promise);
      done();
    });
  });
  it('limit with sort', function(done){
    //Field is empty or not exists
    var req = {'l': '2000', 's': '{ "i": -1 }'};
    model.Query(req, function(error, data){
      assert.equal(error, undefined);
      assert.equal(data.length, 2000);
      //alternative
      assert.instanceOf(model.Query(req), mongoose.Promise);
      done();
    });
  });
});
