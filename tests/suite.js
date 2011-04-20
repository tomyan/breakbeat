
var litmus = require('litmus');

exports.test = new litmus.Suite('Breakbeat Test Suite', [
    require('./tree').test,
    require('./file').test
]);

