const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function loadStep1Module() {
  const source = fs.readFileSync('flows/openai/background/steps/open-chatgpt.js', 'utf8');
  const globalScope = {};
  return new Function('self', `${source}; return self.MultiPageBackgroundStep1;`)(globalScope);
}

test('step 1 cookie cleanup queries target domains and skips browsingData sweep when direct removals succeed', async () => {
  const api = loadStep1Module();
  const events = {
    getAllCalls: [],
    removedCookies: [],
    browsingDataCalls: [],
    openedSteps: [],
    completedNodes: [],
  };

  const chromeApi = {
    cookies: {
      getAllCookieStores: async () => [{ id: 'store-a' }],
      getAll: async (query) => {
        events.getAllCalls.push(query);
        if (query?.domain === 'chatgpt.com') {
          return [
            { domain: '.chatgpt.com', path: '/', name: 'session', storeId: 'store-a' },
          ];
        }
        if (query?.domain === 'openai.com') {
          return [
            {
              domain: '.openai.com',
              path: '/',
              name: 'shared',
              storeId: 'store-a',
              partitionKey: { topLevelSite: 'https://chatgpt.com' },
            },
          ];
        }
        return [];
      },
      remove: async (details) => {
        events.removedCookies.push(details);
        return details;
      },
    },
    browsingData: {
      removeCookies: async (details) => {
        events.browsingDataCalls.push(details);
      },
    },
  };

  const executor = api.createStep1Executor({
    addLog: async () => {},
    chrome: chromeApi,
    openSignupEntryTab: async (step) => {
      events.openedSteps.push(step);
    },
    completeNodeFromBackground: async (nodeId) => {
      events.completedNodes.push(nodeId);
    },
  });

  await executor.executeStep1();

  assert.ok(events.getAllCalls.length > 0, 'should query cookies at least once');
  assert.ok(events.getAllCalls.every((entry) => typeof entry?.domain === 'string' && entry.domain.length > 0));
  assert.deepStrictEqual(events.removedCookies, [
    {
      url: 'https://chatgpt.com/',
      name: 'session',
      storeId: 'store-a',
    },
    {
      url: 'https://openai.com/',
      name: 'shared',
      storeId: 'store-a',
      partitionKey: { topLevelSite: 'https://chatgpt.com' },
    },
  ]);
  assert.deepStrictEqual(events.browsingDataCalls, []);
  assert.deepStrictEqual(events.openedSteps, [1]);
  assert.deepStrictEqual(events.completedNodes, ['open-chatgpt']);
});

test('step 1 cookie cleanup skips browsingData sweep when no direct cookie is removed', async () => {
  const api = loadStep1Module();
  const events = {
    removedCookies: 0,
    browsingDataCalls: [],
  };

  const chromeApi = {
    cookies: {
      getAllCookieStores: async () => [{ id: 'store-a' }],
      getAll: async () => [],
      remove: async () => {
        events.removedCookies += 1;
        return null;
      },
    },
    browsingData: {
      removeCookies: async (details) => {
        events.browsingDataCalls.push(details);
      },
    },
  };

  const executor = api.createStep1Executor({
    addLog: async () => {},
    chrome: chromeApi,
    openSignupEntryTab: async () => {},
    completeNodeFromBackground: async () => {},
  });

  await executor.executeStep1();

  assert.equal(events.removedCookies, 0);
  assert.equal(events.browsingDataCalls.length, 0);
});
