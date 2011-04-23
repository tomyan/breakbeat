
'use strict';

var litmus    = require('litmus'),
    breakbeat = require('breakbeat'),
    sys       = require('sys');

exports.test = new litmus.Test('ast tests', function () {
    this.plan(112);

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

    function checkOperatorNode (node, against, name) {
        test.isa(node, against[0], name + ' - type');
        var op;
        switch (against[0]) {
            case breakbeat.ast.NumericLiteral:
                test.is(node.value, against[1], name + ' - value');
                break;
            case breakbeat.ast.Addition:
            case breakbeat.ast.Subtraction:
            case breakbeat.ast.Concatenation:
            case breakbeat.ast.Multiplication:
            case breakbeat.ast.Division:
            case breakbeat.ast.Modulus:
                checkOperatorNode(node.leftOperand, against[1], name + ' - ' + node.type + ' left operand');
                checkOperatorNode(node.rightOperand, against[2], name + ' - ' + node.type + ' right operand');
                break;
                
            default:
                throw new Error('unhandled type in operator test');
        }
    }

    function testOperators (code, against, name) {
        var handle = test.async(name);
        breakbeat.parseString('<?php ' + code + ';').then(function (ast) {
            checkOperatorNode(ast.children[0], against, name);
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

    testAst('<?php abstract class Abstract_Class_Name { }', {
        'name' : 'empty abstract class ast',
        'children' : [
            {
                'name'     : 'empty abstract class',
                'type'     : breakbeat.ast.Class,
                'children' : [],
                'props'    : {
                    'name'      : 'Abstract_Class_Name',
                    'modifiers' : { 'abstract' : true }
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

    testOperators(
        '1 + 2 * 3',
        [
            breakbeat.ast.Addition,
            [ breakbeat.ast.NumericLiteral, 1 ],
            [
                breakbeat.ast.Multiplication,
                [ breakbeat.ast.NumericLiteral, 2 ],
                [ breakbeat.ast.NumericLiteral, 3 ]
            ]
        ],
        'muliplication has higher precedence than addition'
    );

    testOperators(
        '1 * 2 + 3',
        [
            breakbeat.ast.Addition,
            [
                breakbeat.ast.Multiplication,
                [ breakbeat.ast.NumericLiteral, 1 ],
                [ breakbeat.ast.NumericLiteral, 2 ]
            ],
            [ breakbeat.ast.NumericLiteral, 3 ]
        ],
        'muliplication has higher precedence than addition before'
    );

    testOperators(
        '1 * 2 / 3',
        [
            breakbeat.ast.Division,
            [
                breakbeat.ast.Multiplication,
                [ breakbeat.ast.NumericLiteral, 1 ],
                [ breakbeat.ast.NumericLiteral, 2 ]
            ],
            [ breakbeat.ast.NumericLiteral, 3 ]
        ],
        'division has same precedence as multiplication when after'
    );

    testOperators(
        '1 / 2 * 3',
        [
            breakbeat.ast.Multiplication,
            [
                breakbeat.ast.Division,
                [ breakbeat.ast.NumericLiteral, 1 ],
                [ breakbeat.ast.NumericLiteral, 2 ]
            ],
            [ breakbeat.ast.NumericLiteral, 3 ]
        ],
        'division has same precedence as multiplication when before'
    );

    testOperators(
        '1 / 2 + 3 / 4',
        [
            breakbeat.ast.Addition,
            [
                breakbeat.ast.Division,
                [ breakbeat.ast.NumericLiteral, 1 ],
                [ breakbeat.ast.NumericLiteral, 2 ]
            ],
            [
                breakbeat.ast.Division,
                [ breakbeat.ast.NumericLiteral, 3 ],
                [ breakbeat.ast.NumericLiteral, 4 ]
            ]
        ],
        'division has higher precedence than addition (before and after)'
    );

    testOperators(
        '1 - 2 + 3 - 4',
        [
            breakbeat.ast.Subtraction,
            [
                breakbeat.ast.Addition,
                [
                    breakbeat.ast.Subtraction,
                    [ breakbeat.ast.NumericLiteral, 1 ],
                    [ breakbeat.ast.NumericLiteral, 2 ]
                ],
                [ breakbeat.ast.NumericLiteral, 3 ]
            ],
            [ breakbeat.ast.NumericLiteral, 4 ]
        ],
        'subtraction has same precedence as addition (before and after)'
    );
    
    testOperators(
        '1 . 2 + 3 . 4',
        [
            breakbeat.ast.Concatenation,
            [
                breakbeat.ast.Addition,
                [
                    breakbeat.ast.Concatenation,
                    [ breakbeat.ast.NumericLiteral, 1 ],
                    [ breakbeat.ast.NumericLiteral, 2 ]
                ],
                [ breakbeat.ast.NumericLiteral, 3 ]
            ],
            [ breakbeat.ast.NumericLiteral, 4 ]
        ],
        'concatentation has same precedence as addition (before and after)'
    );
});



