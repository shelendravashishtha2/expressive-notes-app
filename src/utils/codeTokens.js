const JS_KEYWORDS = [
  'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'from', 'function', 'if', 'import',
  'in', 'instanceof', 'let', 'new', 'of', 'return', 'static', 'super', 'switch', 'this', 'throw',
  'try', 'typeof', 'undefined', 'var', 'void', 'while', 'with', 'yield', 'true', 'false', 'null'
];
const PY_KEYWORDS = [
  'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else',
  'except', 'False', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'None',
  'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'True', 'try', 'while', 'with', 'yield'
];
const SQL_KEYWORDS = [
  'select', 'from', 'where', 'join', 'left', 'right', 'inner', 'outer', 'full', 'on', 'group', 'by',
  'order', 'having', 'insert', 'into', 'values', 'update', 'set', 'delete', 'create', 'alter', 'drop',
  'table', 'view', 'index', 'primary', 'key', 'foreign', 'references', 'constraint', 'and', 'or', 'not',
  'null', 'is', 'as', 'case', 'when', 'then', 'else', 'end', 'limit', 'offset', 'distinct', 'union'
];
const SHELL_KEYWORDS = ['if', 'then', 'else', 'elif', 'fi', 'for', 'in', 'do', 'done', 'case', 'esac', 'while', 'function', 'sudo', 'export'];
const YAML_KEYWORDS = ['true', 'false', 'null', 'yes', 'no', 'on', 'off'];
const HCL_KEYWORDS = ['resource', 'variable', 'provider', 'module', 'output', 'locals', 'data', 'terraform', 'true', 'false', 'null'];
const DOCKER_KEYWORDS = ['from', 'run', 'cmd', 'label', 'maintainer', 'expose', 'env', 'add', 'copy', 'entrypoint', 'volume', 'user', 'workdir', 'arg', 'onbuild', 'stopsignal', 'healthcheck', 'shell'];

const KEYWORDS_BY_LANG = {
  javascript: JS_KEYWORDS,
  js: JS_KEYWORDS,
  jsx: JS_KEYWORDS,
  typescript: JS_KEYWORDS,
  ts: JS_KEYWORDS,
  tsx: JS_KEYWORDS,
  python: PY_KEYWORDS,
  py: PY_KEYWORDS,
  sql: SQL_KEYWORDS,
  bash: SHELL_KEYWORDS,
  shell: SHELL_KEYWORDS,
  sh: SHELL_KEYWORDS,
  yaml: YAML_KEYWORDS,
  yml: YAML_KEYWORDS,
  terraform: HCL_KEYWORDS,
  hcl: HCL_KEYWORDS,
  dockerfile: DOCKER_KEYWORDS,
  docker: DOCKER_KEYWORDS,
  json: ['true', 'false', 'null']
};

export function normalizeCodeLanguage(language = '') {
  const lang = String(language).toLowerCase().replace('language-', '').trim();
  const aliases = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    shellscript: 'shell',
    yml: 'yaml',
    tf: 'hcl',
    terraform: 'hcl',
    hcl: 'hcl',
    txt: 'text',
    plain: 'text',
    plaintext: 'text',
    docker: 'dockerfile'
  };
  return aliases[lang] || lang || 'text';
}

function keywordRegexFor(language) {
  const words = KEYWORDS_BY_LANG[normalizeCodeLanguage(language)] || [];
  if (!words.length) return null;
  return new RegExp(`(?:${words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'iy');
}

export function tokenizeCodeLine(line = '', language = 'text') {
  const lang = normalizeCodeLanguage(language);
  const keywordPattern = keywordRegexFor(lang);
  const patterns = [];

  if (['javascript', 'jsx', 'typescript', 'ts', 'tsx', 'java', 'csharp', 'css', 'terraform', 'hcl'].includes(lang)) {
    patterns.push(['comment', /\/\/.*|\/\*[\s\S]*?\*\//iy]);
  }
  if (['python', 'bash', 'shell', 'yaml', 'yml', 'dockerfile', 'terraform', 'hcl'].includes(lang)) {
    patterns.push(['comment', /#.*/iy]);
  }
  if (lang === 'sql') patterns.push(['comment', /--.*|\/\*[\s\S]*?\*\//iy]);

  patterns.push(['string', /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/iy]);
  if (keywordPattern) patterns.push(['keyword', keywordPattern]);
  if (lang === 'json' || lang === 'yaml' || lang === 'yml') patterns.push(['property', /[A-Za-z_$][\w$-]*(?=\s*:)/iy]);
  patterns.push(['function', /[A-Za-z_$][\w$]*(?=\s*\()/iy]);
  patterns.push(['number', /\b(?:0x[a-f\d]+|\d+(?:\.\d+)?)(?:e[+-]?\d+)?\b/iy]);
  patterns.push(['operator', /=>|===|!==|==|!=|<=|>=|&&|\|\||[+\-*/%=<>!&|?:]+/iy]);
  patterns.push(['punctuation', /[{}()[\].,;]/iy]);
  patterns.push(['space', /\s+/iy]);
  patterns.push(['text', /[^\s{}()[\].,;:+\-*/%=<>!&|?"'`#]+/iy]);

  const tokens = [];
  let index = 0;

  while (index < line.length) {
    let matched = null;
    for (const [type, regex] of patterns) {
      regex.lastIndex = index;
      const match = regex.exec(line);
      if (match && match.index === index && match[0]) {
        matched = { type, text: match[0] };
        break;
      }
    }

    if (!matched) matched = { type: 'text', text: line[index] };
    tokens.push(matched);
    index += matched.text.length;
  }

  return tokens;
}
