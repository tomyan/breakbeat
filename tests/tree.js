
'use strict';

var litmus = require('litmus'),
    breakbeat = require('breakbeat'),
    sys    = require('sys');

exports.test = new litmus.Test('ast tests', function () {
    this.plan(61);

    var test = this;
    
    function checkNode (node, against) {
        if ('children' in against) {
            test.is(
                node.children.length,
                against.children.length,
                against.name + ' has ' + against.children.length + (against.children.length === 1 ? ' child' : ' children')
            );
            for (var i = 0, l = node.children.length; i < l; i++) {
                checkNode(node.children[i], against.children[i]);
            }
        }
        if ('leftOperand' in against) {
            test.ok(node.leftOperand, against.name + ' has left operand');
            checkNode(node.leftOperand, against.leftOperand);
        }
        if ('rightOperand' in against) {
            test.ok(node.rightOperand, against.name + ' has right operand');
            checkNode(node.rightOperand, against.rightOperand);
        }
        if ('type' in against) {
            test.isa(node, against.type, against.name + ' type');
        }
        if ('props' in against) {
            for (var i in against.props) {
                test.ok(i in node, against.name + ' has property ' + i);
                test.is(node[i], against.props[i], against.name + ' property ' + i + ' value');
            }
        }
    }

    function testAst (code, against) {
        var handle = test.async(against.name);
        breakbeat.parseString(code).then(function (ast) {
            checkNode(ast, against);
            handle.finish();
        });
    }

    testAst('<?php class Class_Name { }', {
        'name' : 'empty class ast',
        'children' : [
            {
                'name'     : 'empty class',
                'type'     : breakbeat.ast.Class,
                'children' : [],
                'props'    : {
                    'name'      : 'Class_Name',
                    'modifiers' : {}
                }
            }
        ]
    });

    testAst('<?php public class Public_Class_Name { }', {
        'name' : 'empty public class ast',
        'children' : [
            {
                'name'     : 'empty public class',
                'type'     : breakbeat.ast.Class,
                'children' : [],
                'props'    : {
                    'name'      : 'Public_Class_Name',
                    'modifiers' : { 'public' : true }
                }
            }
        ]
    });

    testAst('<?php class Class_Name { function methodName () { } }', {
        'name' : 'class with method ast',
        'children' : [
            {
                'name'     : 'class with method',
                'type'     : breakbeat.ast.Class,
                'children' : [
                    {
                        'name'     : 'method',
                        'type'     : breakbeat.ast.Function,
                        'children' : [],
                        'props'    : {
                            'name'      : 'methodName',
                            'modifiers' : {}
                        }
                    }
                ],
                'props'    : {
                    'name'      : 'Class_Name',
                    'modifiers' : {}
                }
            }
        ]
    });

    testAst('<?php function functionName ($param1, $param2 = true) { }', {
        'name'     : 'function with parameters ast',
        'children' : [
            {
                'name'     : 'function with paramters',
                'children' : [],
                'props'    : {
                    'args' : [
                        {
                            'name' : '$param1'
                        },
                        {
                            'name'         : '$param2',
                            'defaultValue' : true
                        }
                    ] 
                }
            }
        ]
    });

    testAst('<?php 1;', {
        'name'     : 'simple literal expression ast',
        'children' : [
            {
                'name'  : 'simple literal expression',
                'type'  : breakbeat.ast.NumericLiteral,
                'props' : {
                    'value' : 1
                }
            }
        ] 
    });

    testAst('<?php 1 + 1;', {
        'name'     : 'addition ast',
        'children' : [
            {
                'name'     : 'addition',
                'type'     : breakbeat.ast.Addition,
                'leftOperand' : {
                    'name'  : 'addition left operand',
                    'type'  : breakbeat.ast.NumericLiteral,
                    'props' : {
                        'value' : 1
                    }
                },
                'rightOperand' : {
                    'name'  : 'addition right operand',
                    'type'  : breakbeat.ast.NumericLiteral,
                    'props' : {
                        'value' : 1
                    }
                }
            }
        ] 
    });

    testAst('<?php 1 + 1 * 1;', {
        'name'     : 'addition with multiplication ast',
        'children' : [
            {
                'name'     : 'addition with multiplication - multiplication',
                'type'     : breakbeat.ast.Addition,
                'leftOperand' : {
                    'name'  : 'addition with multiplication - multiplication left operand',
                    'type'  : breakbeat.ast.NumericLiteral,
                    'props' : {
                        'value' : 1
                    }
                },
                'rightOperand' : {
                    'name'     : 'addition with multiplication - addition',
                    'type'     : breakbeat.ast.Multiplication,
                    'leftOperand' : {
                        'name'  : 'addition with multiplication - addition left operand',
                        'type'  : breakbeat.ast.NumericLiteral,
                        'props' : {
                            'value' : 1
                        }
                    },
                    'rightOperand' : {
                        'name'  : 'addition with multiplication - addition right operand',
                        'type'  : breakbeat.ast.NumericLiteral,
                        'props' : {
                            'value' : 1
                        }
                    }
                }
            }
        ] 
    });
});


