mongoose-query
==============

mongoose query creator. Alternative for mongoose-api-query but without schema understanding.
This very simple library can be used for example expressjs+mongoose applications to help 
construct mongoose query model directly from url parameters.

[![Build Status](https://travis-ci.org/jupe/mongoose-query.png?branch=master)](https://travis-ci.org/jupe/mongoose-query)

## History

|versio|Changes|
|------|-------|
|0.1.7|typo on mapReduce case, !empty keyword added|
|0.1.6|Support for complex populate query and mapReduce improvements|
|0.1.5|-|

## Installation

Use npm:
```
npm install mongoose-query
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

## Query string example

```
http://localhost/query.json?q={"group":"users"}&f=name&sk=1&l=5&p=name

Converted to:

model.find({group: "users"}).select("name").skip(1).limit(5).populate('name')
```

## doc

```
http://www.myserver.com/query?[q=<query>][&t=<type>][&f=<fields>][&s=<order>][&sk=<skip>][&l=<limit>][&p=<populate>][&fl=<boolean>][&map=<mapFunction>][&reduce=<reduceFunction>]

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

  
Alternative search conditions:
"key={in}a,b"               At least one of these is in array
"key={nin}a,b"              Any of these values is not in array
"key={all}a,b"              All of these contains in array
"key={empty}-"              Field is empty or not exists
"key={!empty}-"             Field exists and is not empty
"key={mod}a,b"              Docs where key mod a is b
"key={gt}a"                 Docs key is greater than a
"key={lt}a"                 Docs key is lower than a
"key=a|b|c"                 Docs where type of key is Array and contains at least one of given value


Results:

fl=false 
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

fl=true
[
 {'nest.ed.data': 'value',
  'nest.ed.data2':'value'},
]
```




