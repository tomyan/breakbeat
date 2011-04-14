<?php

$code = '';
while ($line = fgets(STDIN, 4096)) {
    $code .= $line;
}
$tokens = token_get_all($code);

echo "[\n    ";
foreach ($tokens as $i => $token) {
    if ($i !== 0) {
        echo ",\n    ";
    }
    if (is_string($token)) {
        $type = $token;
        $text = $token;
    }
    else {
        list($type, $text) = $token;
        $type = token_name($type);
    }
    echo '{"type":' . quoteString($type) . ',"text":' . quoteString($text) . '}';
}
echo "\n]\n";

function quoteString ($in) {
    return '"' . preg_replace('/php2js_backslash/', '\\', preg_replace('/\\t/', '\\t', preg_replace('/\\n/', '\\n', preg_replace('/([\\\"])/', 'php2js_backslash\\1', $in)))) . '"';
}

