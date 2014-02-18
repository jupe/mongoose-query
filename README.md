mongoose-query
==============

mongoose query creator. Alternative for mongoose-api-query but without schema understanding.
This very simple library can be used for example expressjs+mongoose applications to help 
construct mongoose query model.

[![Build Status](https://travis-ci.org/jupe/mongoose-query.png?branch=master)](https://travis-ci.org/jupe/mongoose-query)

## Usage Example

"q={"group":"users"}&f=name&sk=1&l=5&p=name"
-->
model.find({group: "users"}).select("name").skip(1).limit(5).populate('name')


## Code Example

```
var query = require(mongoose-query);

query(req.query, mymodel, function(error, data){
  //do what ever...
});
```

## doc

```
http://www.myserver.com/query?[q=<query>][&t=<type>][&f=<fields>][&s=<order>][&sk=<skip>][&l=<limit>][&p=<populate>]

[q=<query>][&t=<type>][&f=<fields>][&s=<order>][&sk=<skip>][&l=<limit>][&p=<populate>][&fl=<boolean>]


q=<query> - restrict results by the specified JSON query
   regex e.g. q='{"field":{"$regex":"/mygrep/", "$options":"i"}}'
t=<type> - find|findOne|count|aggregate|distinct..
f=<set of fields> - specify the set of fields to include or exclude in each document 
                    (1 - include; 0 - exclude)
s=<sort order> - specify the order in which to sort each specified field 
                 (1- ascending; -1 - descending), JSON
sk=<num results to skip> - specify the number of results to skip in the result set; 
                            useful for paging
l=<limit> - specify the limit for the number of results (default is 1000)
p=<populate> - specify the fields for populate
fl=<boolean> - Flat results or not

  
alternative search conditions:
"key={in}a,b"       "At least one of these is in array"
"key={nin}a,b"      "Any of these values is not in array"
"key={all}a,b"      "All of these contains in array"
"key={empty}-"      "Field is empty or not exists"
"key={mod}a,b"      "Docs where key mod a is b"
"key={gt}a"         "Docs key is greater than a"
"key={lt}a"         "Docs key is lower than a"
"key=a|b|c"         "Docs where type of key is Array and contains at least one of given value


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




