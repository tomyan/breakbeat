<?php
list($script, $phpFile) = $argv;

$code = file_get_contents($phpFile);

$tokens = token_get_all($code);

$string_types = array(
    '(' => 'OPENING_PAREN',
    ')' => 'CLOSING_PAREN',
    '{' => 'OPENING_CURLY',
    '}' => 'CLOSING_CURLY',
    '=' => 'BINARY_ASSIGNMENT',
    ',' => 'COMMA',
    ';' => 'STATEMENT_TERMINATOR',
);

echo "[\n    ";
foreach ($tokens as $i => $token) {
    if ($i !== 0) {
        echo ",\n    ";
    }
    if (is_string($token)) {
        if (! isset($string_types[$token])) {
            throw new Exception("no string type for $token");
        }
        $type = $string_types[$token];
        $text = $token;
    }
    else {
        list($type, $text) = $token;
        $type = token_name($type);
    }
    echo '{"type":' . quote_string($type) . ',"text":' . quote_string($text) . '}';
}
echo "\n]\n";

function quote_string ($in) {
    return '"' . preg_replace('/php2js_backslash/', '\\', preg_replace('/\\t/', '\\t', preg_replace('/\\n/', '\\n', preg_replace('/([\\\"])/', 'php2js_backslash\\1', $in)))) . '"';
}

