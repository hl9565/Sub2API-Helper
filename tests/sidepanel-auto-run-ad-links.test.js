const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const sidepanelSource = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');

function extractFunction(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => sidepanelSource.indexOf(marker))
    .find((index) => index >= 0);
  if (start < 0) {
    throw new Error(`missing function ${name}`);
  }

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let i = start; i < sidepanelSource.length; i += 1) {
    const ch = sidepanelSource[i];
    if (ch === '(') {
      parenDepth += 1;
    } else if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        signatureEnded = true;
      }
    } else if (ch === '{' && signatureEnded) {
      braceStart = i;
      break;
    }
  }

  let depth = 0;
  let end = braceStart;
  for (; end < sidepanelSource.length; end += 1) {
    const ch = sidepanelSource[end];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }

  return sidepanelSource.slice(start, end);
}

const bundle = [
  extractFunction('sanitizeAutoRunAdUrl'),
  extractFunction('parseAutoRunAdSegments'),
  extractFunction('getAutoRunAdPlainText'),
].join('\n');

const api = new Function(`
${bundle}
return {
  sanitizeAutoRunAdUrl,
  parseAutoRunAdSegments,
  getAutoRunAdPlainText,
};
`)();

test('sanitizeAutoRunAdUrl only allows http and https links', () => {
  assert.equal(api.sanitizeAutoRunAdUrl('https://example.com/docs'), 'https://example.com/docs');
  assert.equal(api.sanitizeAutoRunAdUrl('http://example.com/docs'), 'http://example.com/docs');
  assert.equal(api.sanitizeAutoRunAdUrl('javascript:alert(1)'), '');
  assert.equal(api.sanitizeAutoRunAdUrl('data:text/html,hello'), '');
});

test('parseAutoRunAdSegments converts markdown links into safe link segments', () => {
  const segments = api.parseAutoRunAdSegments('查看 [教程](https://example.com/tutorial) 和 [频道](https://example.com/channel)');

  assert.deepEqual(segments, [
    { type: 'text', text: '查看 ' },
    { type: 'link', text: '教程', url: 'https://example.com/tutorial' },
    { type: 'text', text: ' 和 ' },
    { type: 'link', text: '频道', url: 'https://example.com/channel' },
  ]);
  assert.equal(api.getAutoRunAdPlainText(segments), '查看 教程 和 频道');
});

test('parseAutoRunAdSegments keeps unsafe markdown links as plain text', () => {
  const segments = api.parseAutoRunAdSegments('危险链接 [不要点](javascript:alert(1))');

  assert.deepEqual(segments, [
    { type: 'text', text: '危险链接 ' },
    { type: 'text', text: '[不要点](javascript:alert(1))' },
  ]);
});
