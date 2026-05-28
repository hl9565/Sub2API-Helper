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

test('sidepanel html exposes header repo and releases entry points', () => {
  const html = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');

  assert.match(
    html,
    /id="extension-update-status"[\s\S]*role="link"[\s\S]*title="打开 GitHub 仓库"/
  );
});

test('header link helper resolves repo url', () => {
  const bundle = [
    extractFunction('getRepositoryHomeUrl'),
    extractFunction('openRepositoryHomePage'),
  ].join('\n');

  const api = new Function(`
const opened = [];
const sidepanelUpdateService = {
  releasesPageUrl: 'https://github.com/example/project/releases',
};
let currentReleaseSnapshot = null;
function openExternalUrl(url) {
  opened.push(url);
}
${bundle}
return {
  getRepositoryHomeUrl,
  openRepositoryHomePage,
  setSnapshot(snapshot) {
    currentReleaseSnapshot = snapshot;
  },
  getOpened() {
    return opened;
  },
};
`)();

  assert.equal(
    api.getRepositoryHomeUrl(),
    'https://github.com/hl9565/Sub2API-Helper'
  );
  api.openRepositoryHomePage();

  assert.deepEqual(api.getOpened(), [
    'https://github.com/hl9565/Sub2API-Helper',
  ]);
});
