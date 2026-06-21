export function slugify(value = '') {
  return value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[`~!@#$%^&*()+=\[\]{};:'"\\|,.<>/?]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function createScopedHeadingId(topicId = '', sectionId = 'overview', namespace = 'topic') {
  const topic = slugify(topicId) || 'topic';
  const section = slugify(sectionId) || 'overview';
  return `${namespace}-${topic}-${section}`;
}

export function stripMarkdown(markdown = '') {
  return markdown
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[a-zA-Z0-9_-]*\n?|```/g, ' '))
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`|~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getLeadingSpaceCount(line = '') {
  const match = /^ */.exec(line);
  return match ? match[0].length : 0;
}

function normalizeFenceLines(code = '') {
  const lines = String(code)
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '    ')
    .split('\n');

  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();

  if (!lines.length) return [];

  const nonBlankIndents = lines
    .filter((line) => line.trim())
    .map((line) => getLeadingSpaceCount(line));
  const sharedIndent = nonBlankIndents.length ? Math.min(...nonBlankIndents) : 0;

  if (sharedIndent > 0) {
    return lines.map((line) => (
      line.trim() ? line.slice(Math.min(sharedIndent, getLeadingSpaceCount(line))) : line
    ));
  }

  return lines;
}

function opensPythonBlock(line = '') {
  return /^(?:async\s+def|def|class|if|elif|else|for|while|with|try|except|finally|match|case)\b.*:\s*(?:#.*)?$/.test(line.trim());
}

export function normalizeCodeFenceContent(code = '', language = '') {
  const lang = String(language).toLowerCase().replace(/^language-/, '').trim();
  const lines = normalizeFenceLines(code);
  if (!lines.length) return '';

  if (lines.length > 1) {
    const firstIndent = getLeadingSpaceCount(lines[0]);
    const laterIndents = lines
      .slice(1)
      .filter((line) => line.trim())
      .map((line) => getLeadingSpaceCount(line));

    if (firstIndent && laterIndents.length) {
      const minLaterIndent = Math.min(...laterIndents);
      if (minLaterIndent < firstIndent) {
        lines[0] = `${' '.repeat(minLaterIndent)}${lines[0].trimStart()}`;
      }
    }
  }

  if (lang === 'python' || lang === 'py') {
    const firstIndent = getLeadingSpaceCount(lines[0]);
    const nextLine = lines.find((line, index) => index > 0 && line.trim());
    const nextIndent = nextLine ? getLeadingSpaceCount(nextLine) : null;
    if (opensPythonBlock(lines[0]) && nextIndent !== null && nextIndent <= firstIndent) {
      return lines
        .map((line, index) => (index === 0 || !line.trim() ? line : `    ${line}`))
        .join('\n');
    }
  }

  return lines.join('\n');
}

export function normalizeMarkdownContent(markdown = '') {
  const source = String(markdown).replace(/\r\n?/g, '\n');
  const lines = source.split('\n');
  let inFence = false;
  const indentedHeadings = lines.filter((line) => /^\s{4,}#{1,4}\s/.test(line)).length;

  const normalized = indentedHeadings >= 2
    ? lines.map((line) => {
        if (/^\s*```/.test(line)) {
          inFence = !inFence;
          return line.startsWith('    ') ? line.slice(4) : line;
        }
        if (!inFence && line.startsWith('    ')) return line.slice(4);
        return line;
      }).join('\n')
    : source;

  return normalized.replace(/```([^\n`]*)\n([\s\S]*?)```/g, (_, info = '', body = '') => {
    const normalizedBody = normalizeCodeFenceContent(body, info);
    return `\`\`\`${info}\n${normalizedBody}\n\`\`\``;
  });
}

export function extractHeadingText(value = '') {
  return value.replace(/#+$/, '').trim();
}

export function getSections(markdown = '') {
  const lines = markdown.split('\n');
  const sections = [];
  const counters = new Map();
  let current = null;

  const nextId = (title) => {
    const base = slugify(title) || 'section';
    const count = counters.get(base) || 0;
    counters.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  };

  const pushCurrent = () => {
    if (!current) return;
    const raw = current.raw.join('\n').trim();
    if (!raw) return;
    current.rawText = raw;
    current.plainText = stripMarkdown(raw);
    sections.push(current);
  };

  for (const line of lines) {
    const match = /^(#{2,4})\s+(.+?)\s*$/.exec(line);
    if (match) {
      pushCurrent();
      const title = extractHeadingText(match[2]);
      current = {
        id: nextId(title),
        title,
        level: match[1].length,
        raw: [line]
      };
    } else if (current) {
      current.raw.push(line);
    }
  }

  pushCurrent();
  return sections;
}

export function getHeadingIdFactory(markdown = '') {
  const sections = getSections(markdown);
  const grouped = sections.reduce((acc, section) => {
    const key = `${section.level}:${section.title.toLowerCase()}`;
    acc[key] ||= [];
    acc[key].push(section.id);
    return acc;
  }, {});
  const used = new Map();

  return function getHeadingId(level, title) {
    const key = `${level}:${String(title).toLowerCase()}`;
    const count = used.get(key) || 0;
    used.set(key, count + 1);
    return grouped[key]?.[count] || slugify(title);
  };
}

export function flattenText(topic) {
  return `${topic.group || ''} ${topic.domain || ''} ${topic.title || ''} ${topic.summary || ''} ${topic.content || ''} ${(topic.sourceFiles || []).join(' ')}`
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function buildSectionIndex(topics = []) {
  return topics.flatMap((topic) => {
    const sections = getSections(topic.content || '');
    if (!sections.length) {
      return [{
        topicId: topic.id,
        topicTitle: topic.title,
        group: topic.group || topic.domain,
        domain: topic.domain,
        sectionId: 'overview',
        sectionTitle: topic.title,
        sectionPath: [topic.group || topic.domain, topic.title],
        plainText: flattenText(topic),
      }];
    }
    return sections.map((section) => ({
      topicId: topic.id,
      topicTitle: topic.title,
      group: topic.group || topic.domain,
      domain: topic.domain,
      sectionId: section.id,
      sectionTitle: section.title,
      sectionLevel: section.level,
      sectionPath: [topic.group || topic.domain, topic.title, section.title].filter(Boolean),
      plainText: `${topic.title} ${topic.summary || ''} ${section.title} ${section.plainText}`.toLowerCase(),
    }));
  });
}
