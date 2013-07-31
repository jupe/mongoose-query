mongoose-query
==============

mongoose query creator. Alternative for mongoose-api-query but without schema understanding.
This very simple library can be used for example expressjs+mongoose applications to help 
construct mongoose query model.


e.g.
```
var query = require(mongoose-query);

query(req.query, mymodel).exec(function(error, data){
  //do what ever...
});
```
