const dtgen = require('./dtgen');

//let result = dtgen.dtgen('express', 'module();', 'Express');

const functions = require('firebase-functions');

let result = dtgen.dtgen(functions, '', 'Functions');

console.log(result);