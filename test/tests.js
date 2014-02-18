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
  , orig   : {type: ObjectId, ref: 'originals' }
  , nest   : {
    ed: {type: String, default: 'value'}
  }
});
TestSchema.plugin(Query);
var origModel = mongoose.model('originals', OrigSchema);
var model = mongoose.model('test', TestSchema);


mongoose.connect(  "mongodb://localhost/Query-test", {} ); 
var _id = '123123';
describe('Query:basic', function() {
  before( function(done){
    this.timeout(10000);
    
    var create = function(i, max, callback){
      if( i<max){
        var obj = new model({title: (i<10?'testa':'testb'), msg: 'i#'+i, orig: _id});
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
            create(0, 20, done);
          });
        });
      });     
    });
  });
  
  it('all', function(done) {
    model.Query({q:'{}'}, function(error, data){
      assert.equal( error, undefined );
      assert.equal( data.length, 20 );
      assert.isTrue( (data[0].orig+'').match(/([0-9a-z]{24})/) != null );
      done();
    });
  });
  it('regex', function(done) {
    model.Query({q:'{"title": {"$regex": "/^testa/"}}'}, function(error, data){
      assert.equal( error, undefined );
      assert.equal( data.length, 10 );
      assert.isTrue( (data[0].orig+'').match(/([0-9a-z]{24})/) != null );
      done();
    });
  });
  it('findOne & sort', function(done) {
    model.Query({q:'{}', t: 'findOne', s: '{"msg": 1}'}, function(error, data){
      assert.equal( error, undefined );
      assert.typeOf( data, 'Object' );
      assert.equal( data.title, 'testa' );
      assert.equal( data.msg, 'i#0' );
      done();
    });
  });
  it('exact', function(done) {
    model.Query({q:'{"msg":"i#3"}'}, function(error, data){
      assert.equal( error, undefined );
      assert.equal( data.length, 1 );
      assert.equal( data[0].msg, "i#3" );
      done();
    });
  });
  it('populate', function(done) {
    model.Query({q:'{"msg":"i#3"}', p: 'orig'}, function(error, data){
      assert.equal( error, undefined );
      assert.equal( data.length, 1 );
      assert.equal( data[0].msg, "i#3" );
      assert.equal( data[0].orig.value, "original" );
      done();
    });
  });
  it('limit & select', function(done) {
    model.Query({q:'{}', f: 'title', l:'3', s: '{"title": -1}'}, function(error, data){
      assert.equal( error, undefined );
      assert.equal( data.length, 3 );
      assert.equal( data[0].msg, undefined );
      assert.equal( data[0].title, "testb" );
      assert.equal( data[1].msg, undefined );
      assert.equal( data[1].title, "testb" );
      assert.equal( data[2].msg, undefined );
      assert.equal( data[2].title, "testb" );
      done();
    });
  });
  
  it('skip', function(done) {
    model.Query({q:'{}', sk:'3'}, function(error, data){
      assert.equal( error, undefined );
      assert.equal( data.length, 17 );
      done();
    });
  });
  
  it('count', function(done) {
    model.Query({q:'{"$or": [ {"msg":"i#1"}, {"msg":"i#2"}]}', t:'count'}, function(error, data){
      assert.equal( error, undefined );
      assert.typeOf( data, 'object' );
      assert.equal( data.count, 2 );
      done();
    });
  });
  
  it('distinct', function(done) {
    model.Query({f:'title', t:'distinct'}, function(error, data){
      assert.equal( error, undefined );
      assert.equal( data.length, 2 );
      
      done();
    });
  });
  it('flatten', function(done) {
    model.Query({q:'{}', fl: 'true', l:'1'}, function(error, data){
      assert.equal(error, undefined);
      assert.typeOf(data, 'array');
      data.forEach( function(item){
        assert.typeOf(item, 'object');
        assert.equal(item['nest.ed'], 'value')
      });
      done();
    });
  });
});
