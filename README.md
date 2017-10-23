# mongoose-query
[![Build Status](https://travis-ci.org/jupe/mongoose-query.png?branch=master)](https://travis-ci.org/jupe/mongoose-query)
[![Greenkeeper badge](https://badges.greenkeeper.io/jupe/mongoose-query.svg)](https://greenkeeper.io/)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
<br>
[![License badge](https://img.shields.io/badge/license-MIT-blue.svg)](https://img.shields.io)
[![release](http://github-release-version.herokuapp.com/github/jupe/mongoose-query/release.svg?style=flat)](https://github.com/jupe/mongoose-query/releases/latest)
[![npm version](https://badge.fury.io/js/mongoose-query.svg)](https://badge.fury.io/js/mongoose-query)
<br/>
[![Stars badge](https://img.shields.io/github/stars/jupe/mongoose-query.svg)](https://img.shields.io)

This library is usefull example with `expressjs` + `mongoose` applications to help construct mongoose query model directly from url parameters. Example:

```
http://localhost/model?q={"group":"users"}&f=name&sk=1&l=5&p=name
```
Converted to:
```
model.find({group: "users"}).select("name").skip(1).limit(5).populate('name')
```

### Tested with node.js versions
6.x, 7.x, 8.x, LTS, latest release

## Changes log

See [releases page](https://github.com/jupe/mongoose-query/releases).

## Installation

Use [npm](https://www.npmjs.org/package/mongoose-query):
```
npm install mongoose-query
```

## Test
```
npm test && npm run lint
```

## Usage Example

```
var QueryPlugin = require(mongoose-query);
var TestSchema = new mongoose.Schema({});
TestSchema.plugin(QueryPlugin);
var testmodel = mongoose.model('test', TestSchema);

//express route
module.exports = function query(req, res) {
  testmodel.query(req.query, function(error, data){
    res.json(error?{error: error}:data);
  });
}
```

## doc

```
var QueryPlugin = require(mongoose-query);
schema.plugin( QueryPlugin(, <options>) )
```
optional `options`:
* `logger`: custom logger, e.g. winston logger, default: "dummy logger"
* `allowEval`: <boolean> Allow to use eval or not, default: true
* `includeAllParams`: <boolean> Parse also other values. e.g. `?name=me`. default: true
* `ignoreKeys` : <array{String}> keys to be ignored. Default: []

Model static methods:

`model.query( <query>(, <callback>) )`

`model.leanQuery(<query>(, <callback>) )`: gives plain objects ([lean](http://mongoosejs.com/docs/api.html#query_Query-lean))

**Note:** without `<callback>` you get Promise.

**URL API:**
```
http://www.myserver.com/query?[q=<query>][&t=<type>][&f=<fields>][&s=<order>][&sk=<skip>]
[&l=<limit>][&p=<populate>][&fl=<boolean>][&map=<mapFunction>][&reduce=<reduceFunction>]

q=<query>                   restrict results by the specified JSON query
                            regex e.g. q='{"field":{"$regex":"/mygrep/", "$options":"i"}}'
t=<type>                    find|findOne|count|aggregate|distinct|aggregate|mapReduce
f=<set of fields>           specify the set of fields to include or exclude in each document
                            (1 - include; 0 - exclude)
s=<sort order>              specify the order in which to sort each specified field
                            (1- ascending; -1 - descending), JSON
sk=<num results to skip>    specify the number of results to skip in the result set;
                            useful for paging
l=<limit>                   specify the limit for the number of results (default is 1000)
p=<populate>                specify the fields for populate, also more complex json object is supported.
map=<mapFunction>           mongodb map function as string
                            http://docs.mongodb.org/manual/reference/command/mapReduce/#mapreduce-map-cmd'
                            e.g. "function(){if (this.status == 'A') emit(this.cust_id, 1);)}"
reduce=<reduceFunction>     mongodb reduce function as string
                            http://docs.mongodb.org/manual/reference/command/mapReduce/#mapreduce-reduce-cmd
                            e.g. "function(key, values) {return result;}"
fl=<boolean>                Flat results or not

Special values:
"oid:<string>"              string is converted to ObjectId
"/regex/(options)"          converted to regex
{ $regex: /<string>/,       regex match with optional regex options
 ($options: "") }        

Alternative search conditions:
"key={i}a"                  case insensitive
"key={e}a"                  ends with a
"key={b}a"                  begins with a
"key={in}a,b"               At least one of these is in array
"key={nin}a,b"              Any of these values is not in array
"key={all}a,b"              All of these contains in array
"key={empty}"               Field is empty or not exists
"key={!empty}"              Field exists and is not empty
"key={mod}a,b"              Docs where key mod a is b
"key={gt}a"                 value is greater than a
"key={gte}a"                value is greater or equal than a
"key={lt}a"                 value is lower than a
"key={lte}a"                value is lower or equal
"key={ne}a"                 value is not equal
"key={size}a"               value is array, and array size is a
"key={sort_by}"             sort by asc
"key={sort_by}-1"           sort by desc

**References to mongo:**
- [elemMatch](https://docs.mongodb.com/manual/reference/operator/query/elemMatch/)
- [size](https://docs.mongodb.com/manual/reference/operator/query/size/)

Results with `fl=false`:
```
[
 {
 	nest: {
 		ed: {
 			data: 'value',
        	data2':'value'
    	}
  	}
}
]
```

Results with `fl=true`:
```
[
 {'nest.ed.data': 'value',
  'nest.ed.data2':'value'},
]
```


#### Date

Allowed date formats:
- `2010/10/1` (y/m/d)
- `31/2/2010` (d/m/y)
- `2011-10-10T14:48:00` (ISO 8601)

**Note:**
Only valid format is ISO when using date inside `q` -parameter.
