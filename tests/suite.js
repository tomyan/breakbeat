
var litmus = require('litmus');

exports.test = new litmus.Suite('PHP2JS Test Suite', [
    require('./tree').test
]);

