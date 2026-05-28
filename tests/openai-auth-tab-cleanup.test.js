const assert = require('assert');
const fs = require('fs');

const helperSource = fs.readFileSync('background.js', 'utf8');
const tabRuntimeSource = fs.readFileSync('core/flow-kernel/tab-runtime.js', 'utf8');

function extractFunction(source, name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map(marker => source.indexOf(marker))
    .find(index => index >= 0);
  if (start < 0) throw new Error(`missing function ${name}`);

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '(') parenDepth += 1;
    else if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) signatureEnded = true;
    } else if (ch === '{' && signatureEnded) {
      braceStart = i;
      break;
    }
  }
  if (braceStart < 0) throw new Error(`missing body for function ${name}`);

  let depth = 0;
  let end = braceStart;
  for (; end < source.length; end += 1) {
    const ch = source[end];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }

  return source.slice(start, end);
}

const helperBundle = [
  extractFunction(helperSource, 'parseUrlSafely'),
  extractFunction(helperSource, 'isSignupPageHost'),
  extractFunction(helperSource, 'isSignupEntryHost'),
  extractFunction(helperSource, 'is163MailHost'),
  extractFunction(helperSource, 'matchesSourceUrlFamily'),
].join('\n');

const api = new Function('tabRuntimeSource', `
const self = {};
let currentState = {
  sourceLastUrls: {},
  tabRegistry: {},
};
let currentTabs = [];
const removedBatches = [];
const logMessages = [];

const chrome = {
  tabs: {
    async query() {
      return currentTabs;
    },
    async remove(ids) {
      removedBatches.push(ids);
      currentTabs = currentTabs.filter((tab) => !ids.includes(tab.id));
    },
  },
};

async function getState() {
  return currentState;
}

async function setState(updates) {
  currentState = { ...currentState, ...updates };
}

async function addLog(message, level = 'info') {
  logMessages.push({ message, level });
}

function getSourceLabel(source) {
  return source;
}

function isLocalhostOAuthCallbackUrl() {
  return false;
}

function isRetryableContentScriptTransportError() {
  return false;
}

function throwIfStopped() {}
const LOG_PREFIX = '[test:bg]';
const STOP_ERROR_MESSAGE = 'Flow stopped.';

${helperBundle}
${tabRuntimeSource}

const runtime = self.MultiPageBackgroundTabRuntime.createTabRuntime({
  addLog,
  chrome,
  getSourceLabel,
  getState,
  isLocalhostOAuthCallbackUrl,
  isRetryableContentScriptTransportError,
  LOG_PREFIX,
  matchesSourceUrlFamily,
  setState,
  STOP_ERROR_MESSAGE,
  throwIfStopped,
});

return {
  matchesSourceUrlFamily,
  closeConflictingTabsForSource: runtime.closeConflictingTabsForSource,
  reset({ tabs, state }) {
    currentTabs = tabs;
    removedBatches.length = 0;
    logMessages.length = 0;
    currentState = {
      sourceLastUrls: {},
      tabRegistry: {},
      ...(state || {}),
    };
  },
  snapshot() {
    return {
      currentState,
      currentTabs,
      removedBatches,
      logMessages,
    };
  },
};
`)(tabRuntimeSource);

(async () => {
  assert.strictEqual(
    api.matchesSourceUrlFamily('openai-auth', 'https://chatgpt.com/', 'https://chatgpt.com/'),
    true,
    'openai-auth family should include chatgpt.com'
  );
  assert.strictEqual(
    api.matchesSourceUrlFamily('openai-auth', 'https://chat.openai.com/', 'https://auth.openai.com/authorize'),
    true,
    'openai-auth family should include legacy chat.openai.com'
  );
  assert.strictEqual(
    api.matchesSourceUrlFamily('mail-163', 'https://mail.126.com/js6/main.jsp', 'https://mail.163.com/js6/main.jsp'),
    true,
    'mail-163 family should include mail.126.com'
  );

  api.reset({
    tabs: [
      { id: 1, url: 'https://chatgpt.com/' },
      { id: 2, url: 'https://chat.openai.com/' },
      { id: 3, url: 'https://auth.openai.com/authorize?client_id=test' },
      { id: 4, url: 'https://example.com/' },
    ],
    state: {
      sourceLastUrls: {
        'openai-auth': 'https://chatgpt.com/',
      },
      tabRegistry: {
        'openai-auth': { tabId: 3, ready: true },
      },
    },
  });

  await api.closeConflictingTabsForSource('openai-auth', 'https://auth.openai.com/authorize', {
    excludeTabIds: [3],
  });

  let snapshot = api.snapshot();
  assert.deepStrictEqual(snapshot.removedBatches, [[1, 2]]);
  assert.deepStrictEqual(snapshot.currentTabs, [
    { id: 3, url: 'https://auth.openai.com/authorize?client_id=test' },
    { id: 4, url: 'https://example.com/' },
  ]);

  api.reset({
    tabs: [
      { id: 11, url: 'https://chatgpt.com/' },
      { id: 12, url: 'https://auth.openai.com/authorize?client_id=test' },
    ],
    state: {
      sourceLastUrls: {
        'openai-auth': 'https://auth.openai.com/authorize?client_id=test',
      },
      tabRegistry: {
        'openai-auth': { tabId: 11, ready: true },
      },
    },
  });

  await api.closeConflictingTabsForSource('openai-auth', 'https://chatgpt.com/');

  snapshot = api.snapshot();
  assert.deepStrictEqual(snapshot.removedBatches, [[11, 12]]);
  assert.strictEqual(snapshot.currentState.tabRegistry['openai-auth'], null);

  api.reset({
    tabs: [
      { id: 21, active: true, url: 'https://chatgpt.com/' },
      { id: 22, active: false, url: 'https://auth.openai.com/authorize?client_id=test' },
    ],
    state: {
      sourceLastUrls: {
        'openai-auth': 'https://auth.openai.com/authorize?client_id=test',
      },
      tabRegistry: {},
    },
  });

  await api.closeConflictingTabsForSource('openai-auth', 'https://chatgpt.com/');

  snapshot = api.snapshot();
  assert.deepStrictEqual(snapshot.removedBatches, [[21, 22]]);
  assert.deepStrictEqual(snapshot.currentTabs, []);

  console.log('openai auth tab cleanup tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
