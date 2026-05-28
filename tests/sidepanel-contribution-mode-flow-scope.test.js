const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { readFlowRegistryBundle } = require('./helpers/script-bundles.js');

const source = fs.readFileSync('sidepanel/contribution-mode.js', 'utf8');
const flowRegistrySource = readFlowRegistryBundle();
const contributionRegistrySource = fs.readFileSync('shared/contribution-registry.js', 'utf8');

function createElement() {
  return {
    hidden: false,
    disabled: false,
    title: '',
    textContent: '',
    value: '',
    classList: {
      hiddenState: false,
      toggle(_className, hidden) {
        this.hiddenState = Boolean(hidden);
      },
    },
    setAttribute() {},
    listeners: {},
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
  };
}

test('contribution mode manager does not project openai-only ui state into kiro flow', () => {
  const context = {
    window: {},
    document: { activeElement: null },
    console,
    setTimeout,
    clearTimeout,
  };
  vm.runInNewContext(source, context);

  const createContributionModeManager = context.window.SidepanelContributionMode.createContributionModeManager;
  const rowVpsUrl = createElement();
  const dom = {
    btnContributionMode: createElement(),
    accountContributionPanel: createElement(),
    accountContributionText: createElement(),
    accountContributionBadge: createElement(),
    contributionPrimaryStatusLabel: createElement(),
    contributionSecondaryStatusLabel: createElement(),
    contributionOauthStatus: createElement(),
    contributionCallbackStatus: createElement(),
    accountContributionSummary: createElement(),
    inputContributionNickname: createElement(),
    inputContributionQq: createElement(),
    btnStartContribution: createElement(),
    btnOpenContributionUpload: createElement(),
    btnExitContributionMode: createElement(),
    btnOpenAccountRecords: createElement(),
    selectPanelMode: createElement(),
    rowVpsUrl,
  };
  const manager = createContributionModeManager({
    state: {
      getLatestState: () => ({
        activeFlowId: 'kiro',
        flowId: 'kiro',
        accountContributionEnabled: true,
        supportsAccountContribution: true,
        contributionAdapterId: 'kiro-builder-id',
        contributionSource: 'cpa',
      }),
    },
    dom,
    helpers: {
      updatePanelModeUI() {},
      updateAccountRunHistorySettingsUI() {},
      updateConfigMenuControls() {},
      closeConfigMenu() {},
      closeAccountRecordsPanel() {},
      getSelectedFlowId() {
        return 'kiro';
      },
      getSelectedTargetId() {
        return 'kiro-rs';
      },
      isModeSwitchBlocked() {
        return false;
      },
    },
    runtime: {
      sendMessage: async () => ({}),
    },
    constants: {},
  });

  manager.render();

  assert.equal(dom.accountContributionPanel.hidden, false);
  assert.equal(dom.contributionPrimaryStatusLabel.textContent, '账号产物');
  assert.equal(dom.contributionSecondaryStatusLabel.textContent, '提交');
  assert.equal(dom.contributionOauthStatus.textContent, '等待账号产物');
  assert.equal(dom.selectPanelMode.disabled, false);
  assert.equal(dom.selectPanelMode.value, '');
  assert.equal(dom.btnContributionMode.disabled, false);
  assert.equal(dom.btnContributionMode.title, '打开当前 flow 教程；当前已在贡献模式');
  assert.equal(dom.btnStartContribution.disabled, false);
  assert.equal(dom.btnOpenContributionUpload.hidden, false);
  assert.equal(dom.btnOpenContributionUpload.disabled, false);
  assert.equal(dom.btnOpenContributionUpload.textContent, '已有认证文件？前往上传');
  assert.equal(rowVpsUrl.classList.hiddenState, false);
});

test('combined contribution tutorial button opens current flow page and enables current flow adapter', async () => {
  const windowObject = {};
  const api = new Function(
    'self',
    'window',
    'setTimeout',
    'clearTimeout',
    `${flowRegistrySource}; ${contributionRegistrySource}; ${source}; return window.SidepanelContributionMode;`
  )(windowObject, windowObject, setTimeout, clearTimeout);

  let latestState = {
    activeFlowId: 'openai',
    flowId: 'openai',
    accountContributionEnabled: false,
    supportsAccountContribution: true,
    contributionAdapterId: '',
    panelMode: 'sub2api',
  };
  const openedUrls = [];
  const sentMessages = [];
  let persistCount = 0;
  const dom = {
    btnContributionMode: createElement(),
    accountContributionPanel: createElement(),
    accountContributionText: createElement(),
    accountContributionBadge: createElement(),
    contributionPrimaryStatusLabel: createElement(),
    contributionSecondaryStatusLabel: createElement(),
    contributionOauthStatus: createElement(),
    contributionCallbackStatus: createElement(),
    accountContributionSummary: createElement(),
    inputContributionNickname: createElement(),
    inputContributionQq: createElement(),
    btnStartContribution: createElement(),
    btnOpenContributionUpload: createElement(),
    btnExitContributionMode: createElement(),
    btnOpenAccountRecords: createElement(),
    selectPanelMode: createElement(),
  };
  const manager = api.createContributionModeManager({
    state: {
      getLatestState: () => latestState,
    },
    dom,
    helpers: {
      applySettingsState(nextState) {
        latestState = nextState;
      },
      updatePanelModeUI() {},
      updateAccountRunHistorySettingsUI() {},
      updateConfigMenuControls() {},
      closeConfigMenu() {},
      closeAccountRecordsPanel() {},
      getSelectedFlowId() {
        return 'kiro';
      },
      getSelectedTargetId() {
        return 'kiro-rs';
      },
      isModeSwitchBlocked() {
        return false;
      },
      openExternalUrl(url) {
        openedUrls.push(url);
      },
      async persistCurrentSettingsForAction() {
        persistCount += 1;
        latestState = {
          ...latestState,
          activeFlowId: 'kiro',
          flowId: 'kiro',
          kiroTargetId: 'kiro-rs',
        };
      },
      showToast() {},
    },
    runtime: {
      sendMessage: async (message) => {
        sentMessages.push(message);
        return {
          state: {
            ...latestState,
            activeFlowId: 'openai',
            flowId: 'openai',
            accountContributionEnabled: true,
            contributionAdapterId: message.payload.adapterId,
          },
        };
      },
    },
    constants: {
      contributionPortalUrl: 'https://flowpilot.qlhazycoder.top',
    },
  });

  manager.bindEvents();
  await dom.btnContributionMode.listeners.click();

  assert.deepEqual(openedUrls, ['https://flowpilot.qlhazycoder.top/tutorial?flow=kiro&target=kiro-rs']);
  assert.equal(sentMessages[0].type, 'SET_ACCOUNT_CONTRIBUTION_MODE');
  assert.deepEqual(sentMessages[0].payload, {
    enabled: true,
    flowId: 'kiro',
    adapterId: 'kiro-builder-id',
  });
  assert.equal(persistCount, 1);
  assert.equal(latestState.accountContributionEnabled, true);
  assert.equal(latestState.contributionAdapterId, 'kiro-builder-id');
  assert.equal(latestState.activeFlowId, 'kiro');
  assert.equal(latestState.flowId, 'kiro');
  assert.equal(latestState.kiroTargetId, 'kiro-rs');
});
