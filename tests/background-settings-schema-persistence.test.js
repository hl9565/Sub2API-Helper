const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { readFlowRegistryBundle } = require('./helpers/script-bundles.js');

const flowRegistrySource = readFlowRegistryBundle();
const settingsSchemaSource = fs.readFileSync('core/flow-kernel/settings-schema.js', 'utf8');
const backgroundSource = fs.readFileSync('background.js', 'utf8');

function extractFunction(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => backgroundSource.indexOf(marker))
    .find((index) => index >= 0);
  if (start < 0) {
    throw new Error(`missing function ${name}`);
  }

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let i = start; i < backgroundSource.length; i += 1) {
    const ch = backgroundSource[i];
    if (ch === '(') parenDepth += 1;
    if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) signatureEnded = true;
    }
    if (ch === '{' && signatureEnded) {
      braceStart = i;
      break;
    }
  }
  if (braceStart < 0) {
    throw new Error(`missing body for function ${name}`);
  }

  let depth = 0;
  let end = braceStart;
  for (; end < backgroundSource.length; end += 1) {
    const ch = backgroundSource[end];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }
  return backgroundSource.slice(start, end);
}

function buildHarness(extra = '') {
  return new Function(`
const self = {};
${flowRegistrySource}
${settingsSchemaSource}
const DEFAULT_ACTIVE_FLOW_ID = 'openai';
const DEFAULT_SUB2API_GROUP_NAMES = ['codex', 'openai-plus'];
const DEFAULT_VERIFICATION_RESEND_COUNT = 4;
const DEFAULT_PHONE_VERIFICATION_REPLACEMENT_LIMIT = 3;
const DEFAULT_PHONE_CODE_WAIT_SECONDS = 60;
const DEFAULT_PHONE_CODE_TIMEOUT_WINDOWS = 2;
const DEFAULT_PHONE_CODE_POLL_INTERVAL_SECONDS = 5;
const DEFAULT_PHONE_CODE_POLL_ROUNDS = 4;
const DEFAULT_FIVE_SIM_PRODUCT = 'openai';
const FIVE_SIM_COUNTRY_ID = 'thailand';
const FIVE_SIM_COUNTRY_LABEL = '泰国 (Thailand)';
const FIVE_SIM_OPERATOR = 'any';
const DEFAULT_NEX_SMS_SERVICE_CODE = 'ot';
const SETTINGS_SCHEMA_VIEW_KEYS = Object.freeze([
  'activeFlowId',
  'targetId',
  'vpsUrl',
  'vpsPassword',
  'localCpaStep9Mode',
  'sub2apiUrl',
  'sub2apiEmail',
  'sub2apiPassword',
  'sub2apiGroupName',
  'sub2apiGroupNames',
  'sub2apiAccountPriority',
  'sub2apiDefaultProxyName',
  'sub2apiReauthMode',
  'sub2apiReauthEmailSuffix',
  'sub2apiReauthSkipEmails',
  'sub2apiReauthPageSize',
  'codex2apiUrl',
  'codex2apiAdminKey',
  'customPassword',
  'signupMethod',
  'phoneVerificationEnabled',
  'phoneSignupReloginAfterBindEmailEnabled',
  'phoneSmsProvider',
  'phoneSmsProviderOrder',
  'verificationResendCount',
  'phoneVerificationReplacementLimit',
  'phoneCodeWaitSeconds',
  'phoneCodeTimeoutWindows',
  'phoneCodePollIntervalSeconds',
  'phoneCodePollMaxRounds',
  'phoneSmsReuseEnabled',
  'freePhoneReuseEnabled',
  'freePhoneReuseAutoEnabled',
  'phonePreferredActivation',
  'heroSmsApiKey',
  'heroSmsReuseEnabled',
  'heroSmsAcquirePriority',
  'heroSmsMinPrice',
  'heroSmsMaxPrice',
  'heroSmsPreferredPrice',
  'heroSmsCountryId',
  'heroSmsCountryLabel',
  'heroSmsCountryFallback',
  'fiveSimApiKey',
  'fiveSimProduct',
  'fiveSimCountryId',
  'fiveSimCountryLabel',
  'fiveSimCountryFallback',
  'fiveSimCountryOrder',
  'fiveSimMinPrice',
  'fiveSimMaxPrice',
  'fiveSimOperator',
  'nexSmsApiKey',
  'nexSmsCountryOrder',
  'nexSmsServiceCode',
  'plusModeEnabled',
  'plusPaymentMethod',
  'plusAccountAccessStrategy',
  'mailProvider',
  'ipProxyEnabled',
  'ipProxyService',
  'ipProxyMode',
  'kiroRsUrl',
  'kiroRsKey',
  'stepExecutionRangeByFlow',
]);
const SETTINGS_SCHEMA_VIEW_KEY_SET = new Set(SETTINGS_SCHEMA_VIEW_KEYS);
const PERSISTED_SETTING_DEFAULTS = {
  activeFlowId: DEFAULT_ACTIVE_FLOW_ID,
  targetId: 'cpa',
  signupMethod: 'email',
  plusModeEnabled: false,
  plusPaymentMethod: 'paypal',
  plusAccountAccessStrategy: 'oauth',
  phoneVerificationEnabled: false,
  phoneSmsProvider: 'hero-sms',
  phoneSmsProviderOrder: [],
  verificationResendCount: 4,
  phoneVerificationReplacementLimit: 3,
  phoneCodeWaitSeconds: 60,
  phoneCodeTimeoutWindows: 2,
  phoneCodePollIntervalSeconds: 5,
  phoneCodePollMaxRounds: 4,
  phoneSmsReuseEnabled: true,
  freePhoneReuseEnabled: true,
  freePhoneReuseAutoEnabled: true,
  phonePreferredActivation: null,
  sub2apiReauthMode: false,
  sub2apiReauthEmailSuffix: '',
  sub2apiReauthSkipEmails: [],
  sub2apiReauthPageSize: 50,
  heroSmsApiKey: '',
  heroSmsReuseEnabled: true,
  heroSmsAcquirePriority: 'country',
  heroSmsMinPrice: '',
  heroSmsMaxPrice: '',
  heroSmsPreferredPrice: '',
  heroSmsCountryId: 52,
  heroSmsCountryLabel: '泰国 (Thailand)',
  heroSmsCountryFallback: [],
  fiveSimApiKey: '',
  fiveSimProduct: 'openai',
  fiveSimCountryId: 'thailand',
  fiveSimCountryLabel: '泰国 (Thailand)',
  fiveSimCountryFallback: [],
  fiveSimCountryOrder: [],
  fiveSimMinPrice: '',
  fiveSimMaxPrice: '',
  fiveSimOperator: 'any',
  nexSmsApiKey: '',
  nexSmsCountryOrder: [],
  nexSmsServiceCode: 'ot',
  mailProvider: '163',
  ipProxyEnabled: false,
  ipProxyService: '711proxy',
  ipProxyMode: 'account',
  kiroRsUrl: '',
  kiroRsKey: '',
  stepExecutionRangeByFlow: {},
};
const PERSISTED_SETTING_KEYS = Object.keys(PERSISTED_SETTING_DEFAULTS);
const PERSISTED_SETTINGS_SCHEMA_KEYS = ['settingsSchemaVersion', 'settingsState'];
const LEGACY_AUTO_STEP_DELAY_KEYS = [];
const LEGACY_VERIFICATION_RESEND_COUNT_KEYS = [];
const PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH = 'oauth';
const PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION = 'sub2api_codex_session';
const PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION = 'cpa_codex_session';
const DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY = PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH;
function isPlainObjectValue(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function normalizePanelMode(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'sub2api' || normalized === 'codex2api' ? normalized : 'cpa';
}
function normalizeSignupMethod(value = '') {
  return String(value || '').trim().toLowerCase() === 'phone' ? 'phone' : 'email';
}
function normalizePlusPaymentMethod(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'gopay' || normalized === 'gpc-helper' ? normalized : 'paypal';
}
${extractFunction('normalizePlusAccountAccessStrategy')}
function normalizeSub2ApiGroupNames(value) {
  return Array.isArray(value) ? value.map((entry) => String(entry || '').trim()).filter(Boolean) : [];
}
function normalizeCloudflareDomains(value) { return Array.isArray(value) ? value : []; }
function normalizeCloudflareTempEmailDomains(value) { return Array.isArray(value) ? value : []; }
function normalizeCloudMailDomains(value) { return Array.isArray(value) ? value : []; }
function normalizeMailProvider(value = '') { return String(value || '163').trim().toLowerCase() || '163'; }
function normalizePhoneSmsProvider(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '5sim' || normalized === 'nexsms' ? normalized : 'hero-sms';
}
function normalizePhoneSmsProviderOrder(value = []) {
  const source = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(source.map((entry) => normalizePhoneSmsProvider(entry)).filter(Boolean))];
}
function normalizeBoundedIntegerSetting(value, fallback, min, max) {
  const rawValue = String(value ?? '').trim();
  const numeric = Number(rawValue);
  const fallbackNumeric = Number(fallback);
  const normalizedFallback = Number.isFinite(fallbackNumeric)
    ? Math.min(max, Math.max(min, Math.floor(fallbackNumeric)))
    : min;
  if (!rawValue || !Number.isFinite(numeric)) {
    return normalizedFallback;
  }
  return Math.min(max, Math.max(min, Math.floor(numeric)));
}
function normalizeVerificationResendCount(value, fallback = DEFAULT_VERIFICATION_RESEND_COUNT) {
  return normalizeBoundedIntegerSetting(value, fallback, 0, 20);
}
function normalizePhoneVerificationReplacementLimit(value, fallback = DEFAULT_PHONE_VERIFICATION_REPLACEMENT_LIMIT) {
  return normalizeBoundedIntegerSetting(value, fallback, 1, 20);
}
function normalizePhoneCodeWaitSeconds(value, fallback = DEFAULT_PHONE_CODE_WAIT_SECONDS) {
  return normalizeBoundedIntegerSetting(value, fallback, 15, 300);
}
function normalizePhoneCodeTimeoutWindows(value, fallback = DEFAULT_PHONE_CODE_TIMEOUT_WINDOWS) {
  return normalizeBoundedIntegerSetting(value, fallback, 1, 10);
}
function normalizePhoneCodePollIntervalSeconds(value, fallback = DEFAULT_PHONE_CODE_POLL_INTERVAL_SECONDS) {
  return normalizeBoundedIntegerSetting(value, fallback, 1, 30);
}
function normalizePhoneCodePollMaxRounds(value, fallback = DEFAULT_PHONE_CODE_POLL_ROUNDS) {
  return normalizeBoundedIntegerSetting(value, fallback, 1, 120);
}
function normalizePhonePreferredActivation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const activationId = String(value.activationId ?? value.id ?? value.activation ?? '').trim();
  const phoneNumber = String(value.phoneNumber ?? value.number ?? value.phone ?? '').trim();
  if (!activationId || !phoneNumber) {
    return null;
  }
  return {
    ...value,
    provider: normalizePhoneSmsProvider(value.provider || value.smsProvider || 'hero-sms'),
    activationId,
    phoneNumber,
    countryId: value.countryId ?? value.country ?? value.countryCode ?? null,
    countryLabel: String(value.countryLabel || value.label || '').trim(),
    successfulUses: Math.max(0, Math.floor(Number(value.successfulUses) || 0)),
    maxUses: Math.max(1, Math.floor(Number(value.maxUses) || 1)),
  };
}
function normalizeEmailListSetting(value = []) {
  const source = Array.isArray(value) ? value : String(value || '').split(',');
  const seen = new Set();
  return source
    .map((item) => String(item || '').trim().toLowerCase())
    .filter((item) => /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(item))
    .filter((item) => {
      if (seen.has(item)) {
        return false;
      }
      seen.add(item);
      return true;
    });
}
function normalizeHeroSmsMaxPrice(value = '') {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    return '';
  }
  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '';
  }
  return String(Math.round(numeric * 10000) / 10000);
}
function normalizeHeroSmsAcquirePriority(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'price' || normalized === 'price_high') {
    return normalized;
  }
  return 'country';
}
function normalizeHeroSmsCountryFallback(value = []) {
  const source = Array.isArray(value) ? value : String(value || '').split(',');
  const seenIds = new Set();
  return source.map((entry) => {
    const id = Math.floor(Number(entry?.id ?? entry?.countryId ?? entry) || 0);
    const label = String(entry?.label ?? entry?.countryLabel ?? '').trim();
    return { id, label: label || ('Country #' + id) };
  }).filter((entry) => {
    if (!entry.id || seenIds.has(entry.id)) {
      return false;
    }
    seenIds.add(entry.id);
    return true;
  });
}
function normalizeFiveSimCountryCode(value = '', fallback = 'thailand') {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '') || fallback;
}
function normalizeFiveSimCountryId(value, fallback = FIVE_SIM_COUNTRY_ID) {
  return normalizeFiveSimCountryCode(value, fallback);
}
function normalizeFiveSimCountryLabel(value = '', fallback = FIVE_SIM_COUNTRY_LABEL) {
  return String(value || '').trim() || fallback;
}
function normalizeFiveSimCountryOrder(value = []) {
  const source = Array.isArray(value) ? value : String(value || '').split(',');
  const seen = new Set();
  return source.map((entry) => normalizeFiveSimCountryCode(entry?.code || entry?.country || entry?.id || entry, ''))
    .filter((entry) => {
      if (!entry || seen.has(entry)) {
        return false;
      }
      seen.add(entry);
      return true;
    });
}
function normalizeFiveSimCountryFallback(value = []) {
  return normalizeFiveSimCountryOrder(value).map((id) => ({ id, label: normalizeFiveSimCountryLabel('', id) }));
}
function normalizeFiveSimMaxPrice(value = '') {
  return normalizeHeroSmsMaxPrice(value);
}
function normalizeFiveSimOperator(value = '', fallback = FIVE_SIM_OPERATOR) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '') || fallback;
}
function normalizeNexSmsCountryOrder(value = []) {
  const source = Array.isArray(value) ? value : String(value || '').split(',');
  const seen = new Set();
  return source.map((entry) => Math.floor(Number(entry?.id || entry?.countryId || entry) || 0))
    .filter((entry) => {
      if (entry < 0 || seen.has(entry)) {
        return false;
      }
      seen.add(entry);
      return true;
    });
}
function normalizeNexSmsServiceCode(value = '', fallback = DEFAULT_NEX_SMS_SERVICE_CODE) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || fallback;
}
function normalizeStepExecutionRangeByFlow(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function normalizeIpProxyProviderValue(value) { return String(value || '711proxy').trim() || '711proxy'; }
function normalizeIpProxyMode(value) { return String(value || 'account').trim() || 'account'; }
function normalizeIpProxyServiceProfiles(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function buildIpProxyServiceProfileFromState() {
  return {
    mode: 'account',
    apiUrl: '',
    accountList: '',
    accountSessionPrefix: '',
    accountLifeMinutes: '',
    poolTargetCount: '20',
    host: '',
    port: '',
    protocol: 'http',
    username: '',
    password: '',
    region: '',
  };
}
function normalizeIpProxyAccountList(value) { return String(value || ''); }
function normalizeIpProxyAccountSessionPrefix(value) { return String(value || ''); }
function normalizeIpProxyAccountLifeMinutes(value) { return String(value || ''); }
function normalizeIpProxyPoolTargetCount(value) { return String(value || '20'); }
function normalizeIpProxyPort(value) { return String(value || '').trim(); }
function normalizeIpProxyProtocol(value) { return String(value || 'http').trim() || 'http'; }
function resolveSignupMethod(state = {}) {
  const activeFlowId = String(state?.activeFlowId || DEFAULT_ACTIVE_FLOW_ID).trim().toLowerCase() || DEFAULT_ACTIVE_FLOW_ID;
  if (activeFlowId === 'kiro') {
    return 'email';
  }
  return String(state?.signupMethod || '').trim().toLowerCase() === 'phone' ? 'phone' : 'email';
}
function resolveLegacyAutoStepDelaySeconds() { return undefined; }
${extractFunction('normalizePersistentSettingValue')}
${extractFunction('getSettingsSchemaApi')}
${extractFunction('projectSettingsSchemaView')}
${extractFunction('setSettingsStatePatchValue')}
${extractFunction('mergeSettingsStatePatch')}
${extractFunction('buildSettingsStatePatchFromFlatUpdates')}
${extractFunction('buildPersistedSettingsStoragePayload')}
${extractFunction('buildPersistentSettingsPayload')}
${extractFunction('getPersistedSettings')}
${extractFunction('setPersistentSettings')}
${extra}
return {
  buildPersistentSettingsPayload,
  getPersistedSettings,
  setPersistentSettings,
  getRequestedKeys: typeof getRequestedKeys === 'function' ? getRequestedKeys : () => [],
  getPersistedWrites: typeof getPersistedWrites === 'function' ? getPersistedWrites : () => [],
  getRemovedKeys: typeof getRemovedKeys === 'function' ? getRemovedKeys : () => [],
};
`)();
}

test('buildPersistentSettingsPayload writes canonical settings schema into persisted payloads when defaults are materialized', () => {
  const api = buildHarness();

  const payload = api.buildPersistentSettingsPayload({
    activeFlowId: 'kiro',
    kiroRsUrl: 'https://kiro.example.com/admin',
    kiroRsKey: 'secret-key',
  }, { fillDefaults: true });

  assert.equal(payload.activeFlowId, 'kiro');
  assert.equal(payload.targetId, 'kiro-rs');
  assert.equal(payload.kiroRsUrl, 'https://kiro.example.com/admin');
  assert.equal(payload.kiroRsKey, 'secret-key');
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'kiroRegion'), false);
  assert.equal(payload.settingsSchemaVersion, 5);
  assert.equal(payload.settingsState.activeFlowId, 'kiro');
  assert.equal(payload.settingsState.flows.kiro.selectedTargetId, 'kiro-rs');
  assert.equal(
    payload.settingsState.flows.kiro.targets['kiro-rs'].baseUrl,
    'https://kiro.example.com/admin'
  );
});

test('buildPersistentSettingsPayload accepts schema-only input when requireKnownKeys is enabled', () => {
  const api = buildHarness();

  const payload = api.buildPersistentSettingsPayload({
    settingsSchemaVersion: 5,
    settingsState: {
      activeFlowId: 'kiro',
      services: {
        account: { customPassword: '' },
        email: { provider: '163' },
        proxy: { enabled: false, provider: '711proxy', mode: 'account' },
      },
      flows: {
        openai: {
          selectedTargetId: 'cpa',
          targets: {
            cpa: {
              vpsUrl: '',
              vpsPassword: '',
              localCpaStep9Mode: 'submit',
            },
            sub2api: {
              sub2apiUrl: '',
              sub2apiEmail: '',
              sub2apiPassword: '',
              sub2apiGroupName: 'codex',
              sub2apiGroupNames: ['codex', 'openai-plus'],
              sub2apiAccountPriority: 1,
              sub2apiDefaultProxyName: '',
            },
            codex2api: {
              codex2apiUrl: '',
              codex2apiAdminKey: '',
            },
          },
          signup: {
            signupMethod: 'email',
            phoneVerificationEnabled: false,
            phoneSignupReloginAfterBindEmailEnabled: false,
          },
          plus: {
            plusModeEnabled: false,
            plusPaymentMethod: 'paypal',
            plusAccountAccessStrategy: 'oauth',
          },
          autoRun: {
            stepExecutionRange: { enabled: false, fromStep: 1, toStep: 11 },
          },
        },
        kiro: {
          selectedTargetId: 'kiro-rs',
          targets: {
            'kiro-rs': {
              baseUrl: 'https://kiro.example.com/admin',
              apiKey: 'schema-only-key',
            },
          },
          autoRun: {
            stepExecutionRange: { enabled: true, fromStep: 1, toStep: 9 },
          },
        },
      },
    },
  }, { requireKnownKeys: true });

  assert.equal(payload.activeFlowId, 'kiro');
  assert.equal(payload.targetId, 'kiro-rs');
  assert.equal(payload.kiroRsUrl, 'https://kiro.example.com/admin');
  assert.equal(payload.kiroRsKey, 'schema-only-key');
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'kiroRegion'), false);
  assert.equal(payload.settingsSchemaVersion, 5);
  assert.equal(payload.settingsState.flows.openai.plus.plusAccountAccessStrategy, 'oauth');
});

test('getPersistedSettings reads schema keys alongside legacy flat settings keys', async () => {
  const api = buildHarness(`
let requestedKeys = [];
const chrome = {
  storage: {
    local: {
      async get(keys) {
        requestedKeys = Array.isArray(keys) ? [...keys] : [];
        return {};
      },
    },
  },
};
function getRequestedKeys() {
  return requestedKeys;
}
`);

  const state = await api.getPersistedSettings();

  assert.ok(api.getRequestedKeys().includes('settingsSchemaVersion'));
  assert.ok(api.getRequestedKeys().includes('settingsState'));
  assert.ok(api.getRequestedKeys().includes('plusAccountAccessStrategy'));
  assert.equal(state.settingsSchemaVersion, 5);
  assert.equal(state.settingsState.activeFlowId, 'openai');
});

test('getPersistedSettings can project schema-only storage back into legacy flat settings', async () => {
  const api = buildHarness(`
const chrome = {
  storage: {
    local: {
      async get() {
        return {
          settingsSchemaVersion: 5,
          settingsState: {
            activeFlowId: 'kiro',
            services: {
              account: { customPassword: '' },
              email: { provider: 'hotmail' },
              proxy: { enabled: true, provider: '711proxy', mode: 'account' },
            },
            flows: {
              openai: {
                selectedTargetId: 'sub2api',
                targets: {
                  cpa: {
                    vpsUrl: '',
                    vpsPassword: '',
                    localCpaStep9Mode: 'submit',
                  },
                  sub2api: {
                    sub2apiUrl: '',
                    sub2apiEmail: '',
                    sub2apiPassword: '',
                    sub2apiGroupName: 'codex',
                    sub2apiGroupNames: ['codex', 'openai-plus'],
                    sub2apiAccountPriority: 1,
                    sub2apiDefaultProxyName: '',
                  },
                  codex2api: {
                    codex2apiUrl: '',
                    codex2apiAdminKey: '',
                  },
                },
                signup: {
                  signupMethod: 'email',
                  phoneVerificationEnabled: false,
                  phoneSignupReloginAfterBindEmailEnabled: false,
                },
                plus: {
                  plusModeEnabled: false,
                  plusPaymentMethod: 'paypal',
                  plusAccountAccessStrategy: 'sub2api_codex_session',
                },
                autoRun: {
                  stepExecutionRange: { enabled: false, fromStep: 1, toStep: 11 },
                },
              },
              kiro: {
                selectedTargetId: 'kiro-rs',
                targets: {
                  'kiro-rs': {
                    baseUrl: 'https://kiro.example.com/admin',
                    apiKey: 'stored-key',
                  },
                },
                autoRun: {
                  stepExecutionRange: { enabled: true, fromStep: 1, toStep: 9 },
                },
              },
            },
          },
        };
      },
    },
  },
};
`);

  const state = await api.getPersistedSettings();

  assert.equal(state.activeFlowId, 'kiro');
  assert.equal(state.targetId, 'kiro-rs');
  assert.equal(state.settingsState.flows.openai.selectedTargetId, 'sub2api');
  assert.equal(state.mailProvider, 'hotmail');
  assert.equal(state.ipProxyEnabled, true);
  assert.equal(state.kiroRsUrl, 'https://kiro.example.com/admin');
  assert.equal(state.kiroRsKey, 'stored-key');
  assert.equal(state.plusAccountAccessStrategy, 'sub2api_codex_session');
  assert.equal(Object.prototype.hasOwnProperty.call(state, 'kiroRegion'), false);
  assert.deepEqual(state.stepExecutionRangeByFlow.kiro, {
    enabled: true,
    fromStep: 1,
    toStep: 9,
  });
});

test('setPersistentSettings materializes canonical schema keys for schema-only updates', async () => {
  const api = buildHarness(`
const persistedWrites = [];
const removedKeys = [];
const chrome = {
  storage: {
    local: {
      async get() {
        return {};
      },
      async remove(keys) {
        removedKeys.push(...(Array.isArray(keys) ? keys : [keys]));
      },
      async set(payload) {
        persistedWrites.push(JSON.parse(JSON.stringify(payload)));
      },
    },
  },
};
function getPersistedWrites() {
  return persistedWrites;
}
function getRemovedKeys() {
  return removedKeys;
}
`);

  const persisted = await api.setPersistentSettings({
    settingsSchemaVersion: 5,
    settingsState: {
      activeFlowId: 'kiro',
      services: {
        account: { customPassword: '' },
        email: { provider: '163' },
        proxy: { enabled: false, provider: '711proxy', mode: 'account' },
      },
      flows: {
        openai: {
          selectedTargetId: 'cpa',
          targets: {
            cpa: {
              vpsUrl: '',
              vpsPassword: '',
              localCpaStep9Mode: 'submit',
            },
            sub2api: {
              sub2apiUrl: '',
              sub2apiEmail: '',
              sub2apiPassword: '',
              sub2apiGroupName: 'codex',
              sub2apiGroupNames: ['codex', 'openai-plus'],
              sub2apiAccountPriority: 1,
              sub2apiDefaultProxyName: '',
            },
            codex2api: {
              codex2apiUrl: '',
              codex2apiAdminKey: '',
            },
          },
          signup: {
            signupMethod: 'email',
            phoneVerificationEnabled: false,
            phoneSignupReloginAfterBindEmailEnabled: false,
          },
          plus: {
            plusModeEnabled: false,
            plusPaymentMethod: 'paypal',
            plusAccountAccessStrategy: 'sub2api_codex_session',
          },
          autoRun: {
            stepExecutionRange: { enabled: false, fromStep: 1, toStep: 11 },
          },
        },
        kiro: {
          selectedTargetId: 'kiro-rs',
          targets: {
            'kiro-rs': {
              baseUrl: 'https://kiro.example.com/admin',
              apiKey: 'nested-only-key',
            },
          },
          autoRun: {
            stepExecutionRange: { enabled: true, fromStep: 1, toStep: 9 },
          },
        },
      },
    },
  });

  const write = api.getPersistedWrites().at(-1);

  assert.equal(persisted.activeFlowId, 'kiro');
  assert.equal(persisted.targetId, 'kiro-rs');
  assert.equal(persisted.kiroRsUrl, 'https://kiro.example.com/admin');
  assert.equal(persisted.kiroRsKey, 'nested-only-key');
  assert.equal(persisted.plusAccountAccessStrategy, 'sub2api_codex_session');
  assert.equal(Object.prototype.hasOwnProperty.call(persisted, 'kiroRegion'), false);
  assert.equal(persisted.settingsSchemaVersion, 5);
  assert.equal(Object.prototype.hasOwnProperty.call(write, 'activeFlowId'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(write, 'kiroRsUrl'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(write, 'kiroRsKey'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(write, 'kiroRegion'), false);
  assert.equal(write.settingsSchemaVersion, 5);
  assert.equal(write.settingsState.activeFlowId, 'kiro');
  assert.equal(write.settingsState.flows.openai.plus.plusAccountAccessStrategy, 'sub2api_codex_session');
  assert.equal(write.settingsState.flows.kiro.selectedTargetId, 'kiro-rs');
  assert.ok(api.getRemovedKeys().includes('kiroRsUrl'));
});

test('setPersistentSettings mirrors flat mail provider updates into canonical settingsState', async () => {
  const api = buildHarness(`
const persistedWrites = [];
const removedKeys = [];
const chrome = {
  storage: {
    local: {
      async get() {
        return {
          settingsSchemaVersion: 5,
          settingsState: {
            activeFlowId: 'openai',
            services: {
              account: { customPassword: '' },
              email: { provider: '163' },
              proxy: { enabled: false, provider: '711proxy', mode: 'account' },
            },
            flows: {},
          },
        };
      },
      async remove(keys) {
        removedKeys.push(...(Array.isArray(keys) ? keys : [keys]));
      },
      async set(payload) {
        persistedWrites.push(JSON.parse(JSON.stringify(payload)));
      },
    },
  },
};
function getPersistedWrites() {
  return persistedWrites;
}
function getRemovedKeys() {
  return removedKeys;
}
`);

  const persisted = await api.setPersistentSettings({
    mailProvider: 'cloudflare-temp-email',
  });
  const write = api.getPersistedWrites().at(-1);

  assert.equal(persisted.mailProvider, 'cloudflare-temp-email');
  assert.equal(persisted.settingsState.services.email.provider, 'cloudflare-temp-email');
  assert.equal(write.settingsState.services.email.provider, 'cloudflare-temp-email');
  assert.equal(Object.prototype.hasOwnProperty.call(write, 'mailProvider'), false);
});

test('setPersistentSettings mirrors flat schema updates without resetting other canonical settings', async () => {
  const api = buildHarness(`
const persistedWrites = [];
const removedKeys = [];
const chrome = {
  storage: {
    local: {
      async get() {
        return {
          settingsSchemaVersion: 5,
          settingsState: {
            activeFlowId: 'openai',
            services: {
              account: { customPassword: 'old-password' },
              email: { provider: '163' },
              proxy: { enabled: false, provider: '711proxy', mode: 'account' },
            },
            flows: {
              openai: {
                selectedTargetId: 'cpa',
                targets: {
                  cpa: {
                    vpsUrl: 'https://old-cpa.example.com',
                    vpsPassword: 'old-vps-password',
                    localCpaStep9Mode: 'submit',
                  },
                  sub2api: {
                    sub2apiUrl: 'https://sub2api.example.com',
                    sub2apiEmail: 'owner@example.com',
                    sub2apiPassword: 'sub2api-secret',
                    sub2apiGroupName: 'kept-group',
                    sub2apiGroupNames: ['kept-group'],
                    sub2apiAccountPriority: 7,
                    sub2apiDefaultProxyName: 'proxy-a',
                  },
                  codex2api: {
                    codex2apiUrl: 'https://codex2api.example.com',
                    codex2apiAdminKey: 'codex-key',
                  },
                },
                signup: {
                  signupMethod: 'email',
                  phoneVerificationEnabled: false,
                  phoneSignupReloginAfterBindEmailEnabled: false,
                },
                plus: {
                  plusModeEnabled: false,
                  plusPaymentMethod: 'paypal',
                  plusAccountAccessStrategy: 'oauth',
                },
                autoRun: {
                  stepExecutionRange: { enabled: false, fromStep: 1, toStep: 11 },
                },
              },
              kiro: {
                selectedTargetId: 'kiro-rs',
                targets: {
                  'kiro-rs': {
                    baseUrl: 'https://kiro.example.com/admin',
                    apiKey: 'kiro-key',
                  },
                },
                autoRun: {
                  stepExecutionRange: { enabled: false, fromStep: 1, toStep: 9 },
                },
              },
            },
          },
        };
      },
      async remove(keys) {
        removedKeys.push(...(Array.isArray(keys) ? keys : [keys]));
      },
      async set(payload) {
        persistedWrites.push(JSON.parse(JSON.stringify(payload)));
      },
    },
  },
};
function getPersistedWrites() {
  return persistedWrites;
}
function getRemovedKeys() {
  return removedKeys;
}
`);

  const persisted = await api.setPersistentSettings({
    targetId: 'sub2api',
    mailProvider: 'cloudflare-temp-email',
    ipProxyEnabled: true,
    ipProxyMode: 'api',
    stepExecutionRangeByFlow: {
      openai: { enabled: true, fromStep: 2, toStep: 4 },
    },
  });
  const write = api.getPersistedWrites().at(-1);

  assert.equal(persisted.targetId, 'sub2api');
  assert.equal(persisted.mailProvider, 'cloudflare-temp-email');
  assert.equal(persisted.ipProxyEnabled, true);
  assert.equal(persisted.ipProxyMode, 'api');
  assert.deepEqual(persisted.stepExecutionRangeByFlow.openai, {
    enabled: true,
    fromStep: 2,
    toStep: 4,
  });
  assert.equal(write.settingsState.flows.openai.selectedTargetId, 'sub2api');
  assert.equal(write.settingsState.services.email.provider, 'cloudflare-temp-email');
  assert.equal(write.settingsState.services.proxy.enabled, true);
  assert.equal(write.settingsState.services.proxy.mode, 'api');
  assert.deepEqual(write.settingsState.flows.openai.autoRun.stepExecutionRange, {
    enabled: true,
    fromStep: 2,
    toStep: 4,
  });
  assert.equal(write.settingsState.flows.openai.targets.sub2api.sub2apiUrl, 'https://sub2api.example.com');
  assert.equal(write.settingsState.flows.openai.targets.sub2api.sub2apiEmail, 'owner@example.com');
  assert.equal(write.settingsState.flows.kiro.targets['kiro-rs'].apiKey, 'kiro-key');
  assert.equal(Object.prototype.hasOwnProperty.call(write, 'mailProvider'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(write, 'panelMode'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(write, 'ipProxyMode'), false);
});

test('setPersistentSettings mirrors hero sms settings into canonical settingsState', async () => {
  const api = buildHarness(`
const persistedWrites = [];
const removedKeys = [];
const chrome = {
  storage: {
    local: {
      async get() {
        return {};
      },
      async set(payload) {
        persistedWrites.push(JSON.parse(JSON.stringify(payload)));
      },
      async remove(keys) {
        removedKeys.push(...(Array.isArray(keys) ? keys : [keys]));
      },
    },
  },
};
function getPersistedWrites() { return persistedWrites; }
function getRemovedKeys() { return removedKeys; }
`);

  const persisted = await api.setPersistentSettings({
    phoneSmsProvider: 'hero-sms',
    phoneSmsProviderOrder: ['hero-sms', '5sim'],
    verificationResendCount: 6,
    heroSmsApiKey: 'hero-key',
    heroSmsReuseEnabled: false,
    heroSmsAcquirePriority: 'price',
    heroSmsPreferredPrice: '0.0332',
    heroSmsCountryId: 73,
    heroSmsCountryLabel: '巴西 (Brazil)',
    heroSmsCountryFallback: [{ id: 52, label: 'Thailand' }],
    fiveSimCountryOrder: ['vietnam'],
    nexSmsCountryOrder: [1],
  });
  const write = api.getPersistedWrites().at(-1);

  assert.equal(persisted.heroSmsApiKey, 'hero-key');
  assert.equal(write.settingsState.services.phone.provider, 'hero-sms');
  assert.deepEqual(write.settingsState.services.phone.providerOrder, ['hero-sms', '5sim']);
  assert.equal(write.settingsState.services.phone.verificationResendCount, 6);
  assert.equal(write.settingsState.services.phone.heroSms.apiKey, 'hero-key');
  assert.equal(write.settingsState.services.phone.heroSms.reuseEnabled, false);
  assert.equal(write.settingsState.services.phone.heroSms.acquirePriority, 'price');
  assert.equal(write.settingsState.services.phone.heroSms.preferredPrice, '0.0332');
  assert.equal(write.settingsState.services.phone.heroSms.countryId, 73);
  assert.equal(write.settingsState.services.phone.heroSms.countryLabel, '巴西 (Brazil)');
  assert.deepEqual(write.settingsState.services.phone.heroSms.countryFallback, [{ id: 52, label: 'Thailand' }]);
  assert.deepEqual(write.settingsState.services.phone.fiveSim.countryOrder, ['vietnam']);
  assert.deepEqual(write.settingsState.services.phone.nexSms.countryOrder, [1]);
});
