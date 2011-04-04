
var sys = require('sys'),
    spawn = require('child_process').spawn;

var php    = spawn('php', ['-d', 'extension=parsekit.so', __dirname + '/../bin/php2js.php', process.argv[2]]),
    json   = '',
    errors = '';

php.stdout.on('data', function (data) {
    json += data;
});

php.stderr.on('data', function (data) {
    errors += data;
});

php.on('exit', function (code) {
    if (code !== 0) {
        sys.error(errors);
        process.exit(code);
    }
    var processor = new Processor(JSON.parse(json));
    sys.debug(processor.generate());
});

function noop () {}

function cat (token) {
    this.emit(token.text);
}

function todo (token) {
    this.emit('TODO: ' + token.type + '\n\n' + token.text + '\n\n');
}

function modifier (token) {
    this.addModifier(token);
}

var Class = function () {};

var Func = function () {};

var IfCond = function () {};

var contexts = {
    STATEMENT: 1,
    EXPRESSION: 2,
    OPERATOR: 3
};

var Processor = function (tokens) {
    this.tokens = tokens;
    this.current = 0;
    this.content = [];
    this.stack = [this];
    this.modifiers = {};
    this.indent = 0;
    this.contextStack = [ contexts.STATEMENT ];
    this.expressionTerminators = [];
    this.continueStack = [];
};

var handlers = {};

handlers.T_OPEN_TAG = noop;

handlers.T_DOC_COMMENT = function (token) {
    this.emit(token.text.replace(/\n +\*/g, '\n *') + '\n');
};

handlers.T_WHITESPACE = noop;

handlers.T_STATIC    = modifier;
handlers.T_PUBLIC    = modifier;
handlers.T_PROTECTED = modifier;
handlers.T_PRIVATE   = modifier;

handlers.T_CLASS = function (token) {
    var aClass = new Class();
    this.enter(aClass);
    aClass.modifiers = this.getModifiers();
    this.get('T_WHITESPACE');
    aClass.name = this.get('T_STRING').text;
    this.get('T_WHITESPACE');
    this.get('OPENING_CURLY');
    this.emit('var ' + aClass.name + ' = ');
    this.emit(function () {
        return 'function (todo) { TODO }';
    });
    this.emit(';\n\n');
};

handlers.T_FUNCTION = function (token) {
    var func = new Func();
    this.enter(func);
    func.modifiers = this.getModifiers();
    this.get('T_WHITESPACE');
    func.name = this.get('T_STRING').text;
    this.get('T_WHITESPACE');
    this.get('OPENING_PAREN');
    func.args = [];
    while (true) {
        this.getOptional('T_WHITESPACE');
        var variable = this.getOptional('T_VARIABLE');
        if (! variable) {
            break;
        }
        var arg = { name: variable.text.replace(/^\$/, '') };
        func.args.push(arg);
        this.getOptional('T_WHITESPACE');
        var assign = this.getOptional('BINARY_ASSIGNMENT');
        if (! assign) {
            if (this.getOptional('COMMA')) {
                continue;
            }
            else {
                break;
            }
        }
        this.getOptional('T_WHITESPACE');
        var defaultValue;
        if (defaultValue = this.getOptional('T_STRING')) {
            if (defaultValue.text === 'true' || defaultValue.text === 'false') {
                arg.defaultValue = defaultValue.text;
            }
            else {
                throw new Error('unknown type for T_STRING default value: ' + defaultValue.text);
            }
        }
        else if (defaultValue = this.getOptional('T_CONSTANT_ENCAPSED_STRING')) {
            arg.defaultValue = defaultValue.text;
            // TODO parse and restringify
        }
        else {
            defaultValue = this.get();
            throw new Error('unknown type for default value: ' + defaultValue.type);
        }
        if (! this.getOptional('COMMA')) {
            break;
        }
    }
    this.get('CLOSING_PAREN');
    this.getOptional('T_WHITESPACE');
    this.get('OPENING_CURLY');
    var container = this.stack[this.stack.lenth - 2];
    this.emit(this.getFunctionContainerName(func.modifiers) + '.prototype.' + func.name + ' = function (');
    for (var i = 0, l = func.args.length; i < l; i++) {
        if (i !== 0) {
            this.emit(', ');
        }
        this.emit(func.args[i].name);
    }
    this.emit(') {\n');
    this.indent++;
};

handlers.T_IF = function (token) {
    this.getOptional('T_WHITESPACE');
    this.get('OPENING_PAREN');
    this.emitIndent();
    this.emit('if (');
    var ifCond = new IfCond();
    this.enter(ifCond);
    this.pushContext(contexts.EXPRESSION, 'CLOSING_PAREN');
    this.pushContinue(function () {
        this.getOptional('T_WHITESPACE');
        this.get('OPENING_CURLY');
        this.emit(') {\n');
        this.indent++;
        this.emitIndent();
        this.pushContext(contexts.STATEMENT, '}');
        var handleElse = function () {
            this.leave();            
            this.getOptional('T_WHITESPACE');
            var elseToken = this.getOptional('T_ELSE');
            if (elseToken) {
                TODO
            }
        };
        this.pushContinue(handleElse);
    });
};

handlers.T_VARIABLE = function (token) {
    this.emit(token.text.replace(/^\$/, ''));
    this.pushContext(contexts.OPERATOR);
};

handlers.T_BOOLEAN_AND = function (token) {
    this.popContext(contexts.OPERATOR);
    this.emit(' && ');
};

handlers.BINARY_ASSIGNMENT = function (token) {
    this.popContext(contexts.OPERATOR);
    this.emit(' = ');
};

handlers.T_LNUMBER = function (token) {
    this.emit(token.text.replace(/\s+/g, ''));
    this.pushContext(contexts.OPERATOR);
};

handlers.STATEMENT_TERMINATOR = function (token) {
    this.emit(';\n');
    this.emitIndent();
};

handlers.CLOSING_PAREN = function (token) {
    this.popContext(contexts.OPERATOR, 'CLOSING_PAREN');
    this.popContext(contexts.EXPRESSION);
    var next = this.popContinue();
    if (next) {
        next.apply(this);
    }
    else {
        this.emit('TODO expecting continue');
    }
};

handlers.CLOSING_CURLY = function (token) {
    this.popContext(contexts.STATEMENT, 'CLOSING_CURLY');
    TODO
};

Processor.prototype.addIndent = function () {
    if (this.context() === contexts.STATEMENT) {
        this.emitIndent(); 
    }
};

Processor.prototype.pushContext = function (context, terminator) {
    this.contextStack.push(context);
    if (context !== contexts.OPERATOR) {
        this.expressionTerminators.push(terminator);
    }
};

Processor.prototype.popContext = function (context, terminator) {
    var actual = this.contextStack.pop();
    if (context !== actual) {
        this.emit('TODO unexpected context in popContext: ' + actual + ' (expected: ' + context + ')');
    }
    if (context === contexts.OPERATOR && terminator) {
        var actualTerminator = this.expressionTerminators.pop();
        if (terminator !== actualTerminator) {
            this.emit('TODO wrong terminator: ' + actualTerminator + ' (expecting ' + terminator + ')');
        }
    }
};

Processor.prototype.context = function () {
    return this.contextStack[this.contextStack.length - 1];
};

Processor.prototype.checkContext = function (context) {
    if (this.context() !== context) {
        throw new Error('not in correct context');
    }
};

Processor.prototype.pushContinue = function (cont) {
    this.continueStack.push(cont);
};

Processor.prototype.popContinue = function () {
    return this.continueStack.pop();
};

Processor.prototype.emitIndent = function () {
    var indent = '';
    for (var i = 0, l = 4 * this.indent; i < l; i++) {
        indent += ' ';
    }
    this.emit(indent);
};

Processor.prototype.getFunctionContainerName = function (modifiers) {
    if (modifiers.static) {
        return 'exports';
    }
    for (var i = this.stack.length - 2; i >= 0; i--) {
        if (this.stack[i] instanceof Class) {
            return this.stack[i].name;
        }
    }
};

Processor.prototype.enter = function (container) {
    container.content = [];
    this.emit(container);
    this.stack.push(container);
};

Processor.prototype.leave = function () {
    if (this.stack.length < 2) {
        throw new Error('cannot leave top level context');
    }
    this.stack.pop();
};

Processor.prototype.addModifier = function (token) {
    this.modifiers[token.text.toLowerCase()] = true;
};

Processor.prototype.getModifiers = function () {
    var modifiers = this.modifiers;
    this.modifiers = {};
    return modifiers;
}

Processor.prototype.get = function (expect) {
    var token = this.tokens[this.current++];
    if (expect && token.type !== expect) {
        throw new Error('got ' + token.type + ' when expecting ' + expect);
    }
    return token;
};

Processor.prototype.getOptional = function (expect) {
    var token = this.get();
    if (token.type !== expect) {
        this.rewind();
        return;
    }
    return token;
};

Processor.prototype.rewind = function (n) {
    if (! arguments.length) {
        n = 1;
    }
    this.current -= n;
};

Processor.prototype.emit = function (content) {
    this.stack[this.stack.length - 1].content.push(content);
};

Processor.prototype.process = function (expect) {
    var token = this.get(expect);
    if (! token) {
        return;
    }
    var handler = handlers[token.type];
    if (! handler) {
        handler = todo;
    }
    handler.call(this, token); 
    return true;
};

Processor.prototype.processOptional = function (expect) {
    var token = this.get();
    this.rewind();
    if (token.type === expect) {
        this.process();
        return true;
    }
    return false;
};

Processor.prototype.collectOutput = function (from) {
    var output = '';
    for (var i = 0, l = from.length; i < l; i++) {
        if (typeof(from[i]) === 'function') {
            output += from[i].call(this);
        }
        else if (typeof(from[i]) === 'object') {
            output += this.collectOutput(from[i].content);
        }
        else {
            output += from[i];
        }
    }
    return output;
};

Processor.prototype.generate = function () {
    var token,
        handler;
    while (this.process()) {
        ;
    }
    if (this.stack.length !== 1) {
        //throw new Error('stack not empty');
    }
    return this.collectOutput(this.content);
}



