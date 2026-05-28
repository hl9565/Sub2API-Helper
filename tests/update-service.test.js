const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('sidepanel/update-service.js', 'utf8');
const CACHE_KEY = 'flowpilot-release-snapshot-v1';
const LEGACY_CACHE_KEY = 'multipage-release-snapshot-v1';

function createUpdateService(options = {}) {
  const manifest = options.manifest || {
    version: '1.0',
    version_name: 'FlowPilot1.0',
  };
  const cache = new Map();
  const windowObject = {};
  let fetchCalls = 0;

  const localStorage = {
    getItem(key) {
      return cache.has(key) ? cache.get(key) : null;
    },
    setItem(key, value) {
      cache.set(key, String(value));
    },
    removeItem(key) {
      cache.delete(key);
    },
  };

  if (options.cachedSnapshot) {
    cache.set(
      CACHE_KEY,
      JSON.stringify(options.cachedSnapshot)
    );
  }
  if (options.legacyCachedSnapshot) {
    cache.set(
      LEGACY_CACHE_KEY,
      JSON.stringify(options.legacyCachedSnapshot)
    );
  }

  const fetchImpl = options.fetchImpl || (async () => ({
    ok: true,
    async json() {
      return [];
    },
  }));

  const wrappedFetch = async (...args) => {
    fetchCalls += 1;
    return fetchImpl(...args);
  };

  const api = new Function(
    'window',
    'localStorage',
    'fetch',
    'chrome',
    'AbortController',
    'setTimeout',
    'clearTimeout',
    `${source}; return window.SidepanelUpdateService;`
  )(
    windowObject,
    localStorage,
    wrappedFetch,
    {
      runtime: {
        getManifest() {
          return manifest;
        },
      },
    },
    AbortController,
    setTimeout,
    clearTimeout
  );

  return {
    api,
    getFetchCalls() {
      return fetchCalls;
    },
  };
}

test('getReleaseSnapshot keeps FlowPilot releases ahead of historical Ultra, Pro, and legacy v releases', async () => {
  const { api } = createUpdateService({
    manifest: {
      version: '9.99',
      version_name: 'Ultra9.99',
    },
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return [
          {
            tag_name: 'v11.0.0',
            name: 'v11.0.0',
            html_url: 'https://example.com/v11.0.0',
            published_at: '2026-04-17T00:00:00.000Z',
            body: '- legacy release',
            draft: false,
            prerelease: false,
          },
          {
            tag_name: 'Pro2.4',
            name: 'Pro2.4',
            html_url: 'https://example.com/Pro2.4',
            published_at: '2026-04-18T00:00:00.000Z',
            body: '- historical pro release',
            draft: false,
            prerelease: false,
          },
          {
            tag_name: 'Ultra9.99',
            name: 'Ultra9.99',
            html_url: 'https://example.com/Ultra9.99',
            published_at: '2026-04-19T00:00:00.000Z',
            body: '- historical ultra release',
            draft: false,
            prerelease: false,
          },
          {
            tag_name: 'FlowPilot1.0',
            name: 'FlowPilot1.0',
            html_url: 'https://example.com/FlowPilot1.0',
            published_at: '2026-04-20T00:00:00.000Z',
            body: '- current release',
            draft: false,
            prerelease: false,
          },
        ];
      },
    }),
  });

  const snapshot = await api.getReleaseSnapshot({ force: true });

  assert.equal(snapshot.status, 'update-available');
  assert.equal(snapshot.localVersion, 'Ultra9.99');
  assert.equal(snapshot.latestVersion, 'FlowPilot1.0');
  assert.deepEqual(
    snapshot.newerReleases.map((release) => release.displayVersion),
    ['FlowPilot1.0']
  );
});

test('getReleaseSnapshot reorders cached releases before choosing latest version', async () => {
  const { api, getFetchCalls } = createUpdateService({
    manifest: {
      version: '1.0',
      version_name: 'FlowPilot1.0',
    },
    cachedSnapshot: {
      fetchedAt: Date.now(),
      releases: [
        {
          version: '11.0.0',
          displayVersion: 'v11.0.0',
          family: 'legacy',
          title: '',
          url: 'https://example.com/v11.0.0',
          publishedAt: '2026-04-17T00:00:00.000Z',
          notes: [],
        },
        {
          version: '2.4',
          displayVersion: 'Pro2.4',
          family: 'pro',
          title: '',
          url: 'https://example.com/Pro2.4',
          publishedAt: '2026-04-18T00:00:00.000Z',
          notes: [],
        },
        {
          version: '9.99',
          displayVersion: 'Ultra9.99',
          family: 'ultra',
          title: '',
          url: 'https://example.com/Ultra9.99',
          publishedAt: '2026-04-19T00:00:00.000Z',
          notes: [],
        },
        {
          version: '1.1',
          displayVersion: 'FlowPilot1.1',
          family: 'flowpilot',
          title: '',
          url: 'https://example.com/FlowPilot1.1',
          publishedAt: '2026-04-20T00:00:00.000Z',
          notes: [],
        },
      ],
    },
    fetchImpl: async () => {
      throw new Error('should not fetch when cache is fresh');
    },
  });

  const snapshot = await api.getReleaseSnapshot();

  assert.equal(getFetchCalls(), 0);
  assert.equal(snapshot.status, 'update-available');
  assert.equal(snapshot.latestVersion, 'FlowPilot1.1');
  assert.deepEqual(
    snapshot.newerReleases.map((release) => release.displayVersion),
    ['FlowPilot1.1']
  );
});

test('getReleaseSnapshot ignores legacy repository cache after FlowPilot rename', async () => {
  const { api, getFetchCalls } = createUpdateService({
    legacyCachedSnapshot: {
      fetchedAt: Date.now(),
      releases: [
        {
          version: '1.1',
          displayVersion: 'Ultra1.1',
          family: 'ultra',
          title: '',
          url: 'https://github.com/QLHazyCoder/codex-oauth-automation-extension/releases/tag/Ultra1.1',
          publishedAt: '2026-04-19T00:00:00.000Z',
          notes: [],
        },
      ],
    },
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return [
          {
            tag_name: 'FlowPilot1.1',
            name: 'FlowPilot1.1',
            html_url: 'https://github.com/QLHazyCoder/FlowPilot/releases/tag/FlowPilot1.1',
            published_at: '2026-04-20T00:00:00.000Z',
            body: '- current release',
            draft: false,
            prerelease: false,
          },
        ];
      },
    }),
  });

  const snapshot = await api.getReleaseSnapshot();

  assert.equal(getFetchCalls(), 1);
  assert.equal(snapshot.logUrl, 'https://github.com/QLHazyCoder/FlowPilot/releases/tag/FlowPilot1.1');
  assert.equal(api.releasesPageUrl, 'https://github.com/QLHazyCoder/FlowPilot/releases');
  assert.equal(api.repositoryUrl, 'https://github.com/QLHazyCoder/FlowPilot');
});

test('getReleaseSnapshot suppresses an ignored latest update until a newer release appears', async () => {
  let releases = [
    {
      tag_name: 'FlowPilot1.1',
      name: 'FlowPilot1.1',
      html_url: 'https://example.com/FlowPilot1.1',
      published_at: '2026-04-19T00:00:00.000Z',
      body: '- current release',
      draft: false,
      prerelease: false,
    },
  ];
  const { api } = createUpdateService({
    manifest: {
      version: '1.0',
      version_name: 'FlowPilot1.0',
    },
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return releases;
      },
    }),
  });

  const firstSnapshot = await api.getReleaseSnapshot({ force: true });
  assert.equal(firstSnapshot.status, 'update-available');
  assert.equal(api.ignoreReleaseSnapshot(firstSnapshot), 'FlowPilot1.1');

  const ignoredSnapshot = await api.getReleaseSnapshot({ force: true });
  assert.equal(ignoredSnapshot.status, 'ignored');
  assert.equal(ignoredSnapshot.ignoredVersion, 'FlowPilot1.1');

  releases = [
    {
      tag_name: 'FlowPilot1.2',
      name: 'FlowPilot1.2',
      html_url: 'https://example.com/FlowPilot1.2',
      published_at: '2026-04-20T00:00:00.000Z',
      body: '- next release',
      draft: false,
      prerelease: false,
    },
    ...releases,
  ];

  const newerSnapshot = await api.getReleaseSnapshot({ force: true });
  assert.equal(newerSnapshot.status, 'update-available');
  assert.equal(newerSnapshot.latestVersion, 'FlowPilot1.2');
});
