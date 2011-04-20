
'use strict';

var litmus    = require('litmus'),
    breakbeat = require('breakbeat');

exports.test = new litmus.Test('file tests', function () {
    this.plan(3);

    var handle = this.async('parseFile'),
        test   = this;

    breakbeat.parseFile(__dirname + '/test.php').then(function (ast) {

        test.ok(ast, 'got an ast');
        test.isa(ast, breakbeat.ast.File, 'got a file');
        test.is(ast.children.length, 1, 'ast has one child');

        handle.finish();
    });
});



