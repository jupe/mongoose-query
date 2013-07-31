mongoose-query
==============

mongoose query creator. Alternative for mongoose-api-query but without schema understanding.
This very simple library can be used for example expressjs+mongoose applications to help 
construct mongoose query model.

## Usage

http://www.myserver.com/query?[q=<query>][&c=true][&f=<fields>][&fo=true][&s=<order>][&sk=<skip>][&l=<limit>]
 * q=<query> - restrict results by the specified JSON query
 * c=true - return the result count for this query
 * f=<set of fields> - specify the set of fields to include or exclude in each document (1 - include; 0 - exclude)
 * fo=true - return a single document from the result set (same as findOne() using the mongo shell
 * s=<sort order> - specify the order in which to sort each specified field (1- ascending; -1 - descending)
 * p=<set of fields> - specify the set of fields to populate in each document
 * sk=<num results to skip> - specify the number of results to skip in the result set; useful for paging
 * l=<limit> - specify the limit for the number of results (default is 1000)

## Usage Example

"q={"group":"users"}&f=name&sk=1&l=5"
-->
returns:  model.find({group: "users"}).select("name").skip(1).limit(5)


## Code Example
```
var query = require(mongoose-query);

query(req.query, mymodel).exec(function(error, data){
  //do what ever...
});
```
