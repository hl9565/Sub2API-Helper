const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

function loadCpaSessionImportModule() {
  const source = fs.readFileSync('flows/openai/background/steps/cpa-session-import.js', 'utf8');
  return new Function('self', `${source}; return self.MultiPageBackgroundCpaSessionImport;`)({});
}

test('CPA session import step reads current ChatGPT session and completes node', async () => {
  const moduleApi = loadCpaSessionImportModule();
  const completed = [];
  const logs = [];
  const ensureCalls = [];
  const sentMessages = [];
  const importedPayloads = [];

  const executor = moduleApi.createCpaSessionImportExecutor({
    addLog: async (message, level = 'info', options = {}) => {
      logs.push({ message, level, step: options.step, stepKey: options.stepKey });
    },
    chrome: {
      tabs: {
        get: async (tabId) => ({
          id: tabId,
          url: 'https://chatgpt.com/?model=gpt-4o',
        }),
        update: async () => {},
      },
    },
    completeNodeFromBackground: async (nodeId, payload) => {
      completed.push({ nodeId, payload });
    },
    createCpaApi: () => ({
      importCurrentChatGptSession: async (state, options) => {
        importedPayloads.push({ state, options });
        return {
          verifiedStatus: 'CPA 会话导入完成：flow@example.com',
          cpaImportedFileName: 'codex-flow@example.com-plus.json',
          cpaImportedEmail: 'flow@example.com',
        };
      },
    }),
    ensureContentScriptReadyOnTabUntilStopped: async (source, tabId, options = {}) => {
      ensureCalls.push({ source, tabId, options });
    },
    getTabId: async () => null,
    isTabAlive: async () => false,
    registerTab: async () => {},
    sendTabMessageUntilStopped: async (tabId, source, message) => {
      sentMessages.push({ tabId, source, message });
      return {
        session: {
          accessToken: 'session-access-token',
          expires: '2026-05-20T12:34:56.000Z',
          user: {
            email: 'flow@example.com',
          },
        },
        accessToken: 'session-access-token',
      };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    waitForTabCompleteUntilStopped: async () => {},
  });

  await executor.executeCpaSessionImport({
    nodeId: 'cpa-session-import',
    visibleStep: 10,
    plusCheckoutTabId: 91,
    vpsUrl: 'https://cpa.example.com/management.html#/oauth',
    vpsPassword: 'management-key',
  });

  assert.equal(ensureCalls.length, 1);
  assert.equal(ensureCalls[0].source, 'plus-checkout');
  assert.deepStrictEqual(ensureCalls[0].options.inject, [
    'content/utils.js',
    'content/operation-delay.js',
    'flows/openai/content/plus-checkout.js',
  ]);
  assert.deepStrictEqual(sentMessages, [{
    tabId: 91,
    source: 'plus-checkout',
    message: {
      type: 'PLUS_CHECKOUT_GET_STATE',
      source: 'background',
      payload: {
        includeSession: true,
        includeAccessToken: true,
      },
    },
  }]);
  assert.equal(importedPayloads.length, 1);
  assert.equal(importedPayloads[0].state.accessToken, 'session-access-token');
  assert.equal(importedPayloads[0].state.session.user.email, 'flow@example.com');
  assert.equal(completed.length, 1);
  assert.deepStrictEqual(completed[0], {
    nodeId: 'cpa-session-import',
    payload: {
      verifiedStatus: 'CPA 会话导入完成：flow@example.com',
      cpaImportedFileName: 'codex-flow@example.com-plus.json',
      cpaImportedEmail: 'flow@example.com',
    },
  });
  assert.equal(
    logs.some((entry) => entry.stepKey === 'cpa-session-import' && /ChatGPT/.test(entry.message)),
    true
  );
});

test('CPA session import step falls back to an active ChatGPT tab when no checkout tab is tracked', async () => {
  const moduleApi = loadCpaSessionImportModule();
  const completed = [];
  const importedPayloads = [];
  const queryCalls = [];
  const registerCalls = [];

  const sessionTab = {
    id: 77,
    url: 'https://chatgpt.com/?model=gpt-4o',
    active: true,
    currentWindow: true,
    lastAccessed: 1234,
  };

  const executor = moduleApi.createCpaSessionImportExecutor({
    addLog: async () => {},
    chrome: {
      tabs: {
        get: async (tabId) => ({
          ...sessionTab,
          id: tabId,
        }),
        query: async (queryInfo = {}) => {
          queryCalls.push(queryInfo);
          if (queryInfo.active && queryInfo.currentWindow) {
            return [sessionTab];
          }
          return [sessionTab];
        },
        update: async () => {},
      },
    },
    completeNodeFromBackground: async (nodeId, payload) => {
      completed.push({ nodeId, payload });
    },
    createCpaApi: () => ({
      importCurrentChatGptSession: async (state) => {
        importedPayloads.push(state);
        return {
          verifiedStatus: 'CPA 会话导入完成：fallback@example.com',
        };
      },
    }),
    ensureContentScriptReadyOnTabUntilStopped: async () => {},
    getTabId: async () => null,
    isTabAlive: async () => false,
    registerTab: async (source, tabId) => {
      registerCalls.push({ source, tabId });
    },
    sendTabMessageUntilStopped: async () => ({
      session: {
        accessToken: 'session-access-token',
        user: {
          email: 'fallback@example.com',
        },
      },
      accessToken: 'session-access-token',
    }),
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    waitForTabCompleteUntilStopped: async () => {},
  });

  await executor.executeCpaSessionImport({
    nodeId: 'cpa-session-import',
    visibleStep: 10,
    vpsUrl: 'https://cpa.example.com/management.html#/oauth',
    vpsPassword: 'management-key',
  });

  assert.deepStrictEqual(queryCalls, [
    { active: true, currentWindow: true },
    {},
  ]);
  assert.deepStrictEqual(registerCalls, [{
    source: 'plus-checkout',
    tabId: 77,
  }]);
  assert.equal(importedPayloads.length, 1);
  assert.equal(importedPayloads[0].session.user.email, 'fallback@example.com');
  assert.equal(completed.length, 1);
});

test('CPA session import step reports missing readable session tab when tracked tabs are unusable', async () => {
  const moduleApi = loadCpaSessionImportModule();
  let sendCalled = false;

  const executor = moduleApi.createCpaSessionImportExecutor({
    addLog: async () => {},
    chrome: {
      tabs: {
        get: async (tabId) => ({
          id: tabId,
          url: 'https://example.com/not-chatgpt',
        }),
        update: async () => {},
      },
    },
    completeNodeFromBackground: async () => {},
    createCpaApi: () => ({
      importCurrentChatGptSession: async () => ({}),
    }),
    ensureContentScriptReadyOnTabUntilStopped: async () => {},
    getTabId: async () => 91,
    isTabAlive: async () => true,
    sendTabMessageUntilStopped: async () => {
      sendCalled = true;
      return {};
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    waitForTabCompleteUntilStopped: async () => {},
  });

  await assert.rejects(
    () => executor.executeCpaSessionImport({
      nodeId: 'cpa-session-import',
      visibleStep: 10,
      vpsUrl: 'https://cpa.example.com/management.html#/oauth',
      vpsPassword: 'management-key',
    }),
    /未找到可读取 ChatGPT 会话的标签页/
  );

  assert.equal(sendCalled, false);
});

test('background wires CPA session import executor into the workflow runtime', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  assert.match(source, /background\/cpa-api\.js/);
  assert.match(source, /background\/steps\/cpa-session-import\.js/);
  assert.match(source, /'cpa-session-import': \(state\) => cpaSessionImportExecutor\.executeCpaSessionImport\(state\)/);
  assert.match(source, /'cpa-session-import',[\s\S]*'oauth-login'/);
});
