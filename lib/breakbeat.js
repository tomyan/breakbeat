
'use strict';

var sys     = require('sys'),
    spawn   = require('child_process').spawn,
    promise = require('promised-io/lib/promise'),
    fs      = require('fs');

function runPhp (code, args) {
    var php    = spawn('php', args),
        errors = '',
        output = '',
        done   = new promise.Promise();

    php.stderr.on('data', function (data) {
        errors += data;
    });

    php.stdout.on('data', function (data) {
        output += data;
    });

    php.on('exit', function (code) {
        if (code === 0) {
            done.resolve(output);
        }
        else {
            done.reject(errors);
        }
    });
    
    php.stdin.end(code);

    return done;
}

exports.parseString = function (code) {
    var done = new promise.Promise();

    runPhp(code, [ '-l' ]).then(
        function () {
            runPhp(code,  [ __dirname + '/../bin/breakbeat.php' ]).then(
                function (json) {
                    var data;
                    try {
                        data = JSON.parse(json);
                    }
                    catch (e) {
                        done.reject(new Error('invalid json: ' + e + '\n' + json));
                        return;
                    }
                    try {
                        var parser = new Parser(data);
                        done.resolve(parser.parse());
                    }
                    catch (e) {
                        done.reject(e);
                    }
                },
                function (e) {
                    done.reject(new Error('could not get tokens: ' + e));
                }
            );
        },
        function (e) {
            done.reject(e);
        }
    );

    return done;
};

exports.parseFile = function (file) {
    return exports.parseString(fs.readFileSync(file));
};
        
function extend (child, parent) {
    var proto = child.prototype,
        p     = function () {};
    p.prototype = parent.prototype;
    child.prototype = new p();
    for (var i in proto) {
        if (proto.hasOwnProperty(i)) {
            child.prototype[i] = proto[i];
        }
    }
    child.base = parent;
}

var ast = exports.ast = {};

var AST = function () {
    this.root = new ast.File();
    this.stack = [this.root];
    this.modifiers = {};
};

AST.prototype.addDoc = function (comment) {
    if (this.docComment) {
        throw new Error('unhandled doc comment');
    }
    this.docComment = comment;
};

AST.prototype.getDocComment = function () {
    var comment = this.docComment;
    delete this.docComment;
    return comment;
};

AST.prototype.addModifier = function (modifier) {
    this.modifiers[modifier] = true;
};

AST.prototype.getModifiers = function () {
    var modifiers = this.modifiers;
    this.modifiers = {};
    return modifiers;
};

AST.prototype.push = function (node) {
    this.stack[this.stack.length - 1].push(node);
};

AST.prototype.pushContainer = function (node) {
    this.push(node);
    this.stack.push(node);
};

AST.prototype.popContainer = function () {
    if (this.stack.length < 2) {
        throw new Error('attempt to pop file from AST stack');
    }
    return this.stack.pop();
};

ast.Container = function () {
    this.children = [];
};

ast.Container.prototype.push = function (node) {
    this.children.push(node);
};

ast.File = function (filename) {
    arguments.callee.base.call(this);
    this.filename = filename;
};

extend(ast.File, ast.Container);

ast.Class = function (name, modifiers) {
    arguments.callee.base.call(this);
    this.name = name;
    this.modifiers = modifiers;
};

extend(ast.Class, ast.Container);

ast.Function = function (name, modifiers) {
    arguments.callee.base.call(this);
    this.name = name;
    this.modifiers = modifiers;
    this.args = [];
};

extend(ast.Function, ast.Container);

ast.Function.prototype.pushArg = function (arg) {
    this.args.push(arg);
};

ast.Argument = function (name) {
    this.name = name;
};

ast.Argument.prototype.setDefault = function (defaultValue) {
    this.defaultValue = defaultValue;
};

ast.If = function () {
    arguments.callee.base.call(this);
};

extend(ast.If, ast.Container);

ast.If.prototype.setCondition = function (expression) {
    this.condition = expression;
};

ast.NumericLiteral = function (value) {
    this.value = value;
};

function binaryOperation (leftOperand, rightOperand) {
    this.leftOperand = leftOperand;
    this.rightOperand = rightOperand;
};

ast.Addition = function () {
    arguments.callee.base.apply(this, arguments);
    this.type = 'addition';
};

extend(ast.Addition, binaryOperation);

ast.Multiplication = function () {
    arguments.callee.base.apply(this, arguments);
    this.type = 'multiplication';
};

extend(ast.Multiplication, binaryOperation);

ast.Division = function () {
    arguments.callee.base.apply(this, arguments);
    this.type = 'division';
};

extend(ast.Division, binaryOperation);

ast.Modulus = function () {
    arguments.callee.base.apply(this, arguments);
    this.type = 'modulus';
};

extend(ast.Modulus, binaryOperation);

var Parser = function (tokens, filename) {
    this.tokens   = tokens;
    this.filename = filename;
};

Parser.prototype.parse = function () {
    this.ast = new AST(this.filename);
    this.i = 0;
    this.run();
    return this.ast.root;
};

Parser.prototype.isType = function (isType) {
    return this.tokens[this.i].type === isType;
};

Parser.prototype.take = function (checkType) {
    if (checkType && ! this.isType(checkType)) {
        throw new Error('expecting type "' + checkType + '", got "' + this.tokens[this.i].type + '"');
    }
    return this.tokens[this.i++];
};

Parser.prototype.takeIf = function (checkType) {
    if (this.isType(checkType)) {
        return this.take();
    }
};

Parser.prototype.next = function () {
    return this.tokens[this.i + 1];
};

Parser.prototype.rewind = function () {
    this.i--;
};

Parser.prototype.run = function (end) {
    var unknown = 0,
        token;
    while (this.i < this.tokens.length) {
        token = this.take();
        if (end && token.type === end) {
            return;
        }
        switch (token.type) {
            case 'T_OPEN_TAG':
                break;
            case 'T_DOC_COMMENT':
                // save the doc comment for the next structure
                this.ast.addDoc(token.text);
                break;
            case 'T_CLASS':
                this.parseClass();
                break;
            case 'T_WHITESPACE':
                break;
            case 'T_ABSTRACT':
                this.ast.addModifier('abstract');
                break;
            case 'T_PUBLIC':
                this.ast.addModifier('public');
                break;
            case 'T_STATIC':
                this.ast.addModifier('static');
                break;
            case 'T_FUNCTION':
                this.parseFunction();
                break;
            case 'T_IF':
                this.parseIf();
                break;
            case 'T_LNUMBER':
                this.rewind();
                this.parseExpression(';');
                break;
            default:
                sys.debug('TODO: ' + token.type + ' - ' + sys.inspect(token));
                if (unknown++ > 10) {
                    sys.debug('greater than 10 todos, exiting');
                    return;
                }
        }
    }
};

var binaryOperators = { 
    '+' : {
        'op'            : '+',
        'precedence'    : 2,
        'associativity' : 'left',
        'astType'       : ast.Addition
    },
    '*' : {
        'op'            : '*',
        'precedence'    : 1,
        'associativity' : 'left',
        'astType'       : ast.Multiplication
    },
    '/' : {
        'op'            : '/',
        'precedence'    : 1,
        'associativity' : 'left',
        'astType'       : ast.Division
    },
    '%' : {
        'op'            : '%',
        'precedence'    : 1,
        'associativity' : 'left',
        'astType'       : ast.Modulus
    }
};

Parser.prototype.parseExpression = function (end) {
    var unknown = 0,
        token,
        output = [],
        operand,
        operands = [],
        operatorText,
        operators = [];
    TOKEN: while (this.i < this.tokens.length) {
        token = this.take();
        if (end && token.type === end) {
            while (operators.length) {
                var top = operators.pop(),
                    rightOperand = operands.pop(),
                    leftOperand  = operands.pop();
                operands.push(new top.astType(leftOperand, rightOperand));
            }
            if (operands.length !== 1) {
                throw new Error('wrong number of operands');
            }
            this.ast.push(operands[0]);
            return;
        }
        operand = null;
        switch (token.type) {
            case 'T_WHITESPACE':
                continue;

            // operands
            case 'T_LNUMBER':
                operands.push(new ast.NumericLiteral(parseInt(token.text, 10)));
                continue TOKEN;

            // operators
            case '+':
            case '*':
            case '/':
            case '%':
                operatorText = token.type;
                break;

            default:
                throw new Error('unhandled token type in expression: ' + token.type);
        }
        var l,
            operator = binaryOperators[operatorText];
        if (! operator) {
            throw new Error('unknown operator ' + operatorText);
        }
        while (l = operators.length) {
            var top = operators[l - 1];
            if (operator.associativity === 'left' && top.precedence <= operator.precedence ||
                operator.associativity === 'right' && top.precedence < operator.precedence) {
                var rightOperand = operands.pop(),
                    leftOperand = operands.pop();
                operators.pop();
                operands.push(new top.astType(leftOperand, rightOperand));
            }
            else {
                break;
            }
        }
        operators.push(operator);
    }
    throw new Error('reached end of input while parsing expression');
};

Parser.prototype.parseClass = function (token) {
    this.take('T_WHITESPACE');
    var aClass = new ast.Class(this.take('T_STRING').text, this.ast.getModifiers(), this.ast.getDocComment());
    this.takeIf('T_WHITESPACE');
    this.take('{');
    this.ast.pushContainer(aClass);
    this.run('}');
    this.ast.popContainer();
};

Parser.prototype.parseFunction = function () {
    this.take('T_WHITESPACE');
    var aFunction = new ast.Function(this.take('T_STRING').text, this.ast.getModifiers(), this.ast.getDocComment());
    this.takeIf('T_WHITESPACE');
    this.take('(');
    this.takeIf('T_WHITESPACE');
    var argToken,
        arg;
    while (argToken = this.takeIf('T_VARIABLE')) {
        arg = new ast.Argument(argToken.text);
        this.takeIf('T_WHITESPACE');
        if (this.takeIf('=')) {
            this.takeIf('T_WHITESPACE');
            arg.setDefault(this.parseLiteral());
        }
        aFunction.pushArg(arg);
        if (! this.takeIf(',')) {
            break;
        }
        this.takeIf('T_WHITESPACE');
    }
    this.takeIf('T_WHITESPACE');
    this.take(')');
    this.takeIf('T_WHITESPACE');
    this.take('{');
    this.ast.pushContainer(aFunction);
    this.run('}');
    this.ast.popContainer();
};

Parser.prototype.parseLiteral = function () {
    var token = this.take();
    switch (token.type) {
        case 'T_STRING':
            if (token.text.toLowerCase() === 'true') {
                return true;
            }
            else if (token.text.toLowerCase() === 'false') {
                return false;
            }
            else {
                throw new Error('unknown literal string: ' + token.text);
            }
            break;
        case 'T_CONSTANT_ENCAPSED_STRING':
            return this.parseStringLiteral(token.text);
            break;
        default:
            throw new Error('unexpected literal type: ' + token.type);
    }
};

Parser.prototype.parseStringLiteral = function (text) {
    return 'TODO: ' + text;
};

Parser.prototype.parseIf = function () {
    this.takeIf('T_WHITESPACE');
    this.take('(');
    var oIf = new ast.If();
    oIf.setCondition(this.parseExpression(')'));
    this.takeIf('T_WHITESPACE');
    this.take('{');
    this.ast.pushContainer(oIf);
    this.run('}');
    this.ast.popContainer();
};



