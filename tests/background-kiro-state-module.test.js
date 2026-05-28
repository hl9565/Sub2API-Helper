const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function loadKiroStateApi() {
  const source = fs.readFileSync('flows/kiro/background/state.js', 'utf8');
  const globalScope = {};
  return new Function('self', `${source}; return self.MultiPageBackgroundKiroState;`)(globalScope);
}

function getKiroRuntime(state = {}) {
  return state?.runtimeState?.flowState?.kiro || {};
}

test('background imports kiro state module for Kiro runtime projection and reset helpers', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  assert.match(source, /flows\/kiro\/background\/state\.js/);
  assert.match(source, /const kiroStateHelpers = self\.MultiPageBackgroundKiroState/);
  assert.match(source, /kiroStateHelpers\?\.buildStateView/);
  assert.match(source, /kiroStateHelpers\?\.buildDownstreamResetPatch/);
  assert.match(source, /kiroStateHelpers\?\.applyNodeCompletionPayload/);
  assert.doesNotMatch(source, /migrateLegacyKiroRuntimeState/);
  assert.equal(/kiroStateHelpers\?\.buildSessionStatePatch/.test(source), false);
  assert.equal(/kiroRuntime:\s*kiroStateHelpers\?\.buildDefaultRuntimeState/.test(source), false);
});

test('kiro state module exposes canonical nested runtimeState view', () => {
  const api = loadKiroStateApi();
  const runtimeState = api.buildRuntimeStatePatch({}, {
    session: {
      currentStage: 'desktop-authorize',
      registerTabId: 88,
      pageState: 'name_entry',
      pageUrl: 'https://view.awsapps.com/start',
    },
    register: {
      email: 'aws-user@example.com',
      fullName: 'Ada Lovelace',
      loginUrl: 'https://app.kiro.dev/signin',
      status: 'waiting_name',
    },
    webAuth: {
      status: 'signin_started',
      hasAccessToken: false,
      hasSessionToken: false,
    },
    desktopAuth: {
      clientId: 'client-001',
      clientSecret: 'secret-001',
      refreshToken: 'refresh-001',
      status: 'authorized',
    },
    upload: {
      targetId: 'kiro-rs',
      status: 'ready_to_upload',
      credentialId: 321,
    },
  }).runtimeState;
  const view = api.buildStateView({
    targetId: 'kiro-rs',
    runtimeState,
  });

  assert.equal(view.targetId, 'kiro-rs');
  assert.equal(Object.prototype.hasOwnProperty.call(view, 'kiroRuntime'), false);
  assert.equal(getKiroRuntime(view).session.currentStage, 'desktop-authorize');
  assert.equal(getKiroRuntime(view).session.registerTabId, 88);
  assert.equal(getKiroRuntime(view).register.email, 'aws-user@example.com');
  assert.equal(getKiroRuntime(view).register.loginUrl, 'https://app.kiro.dev/signin');
  assert.equal(getKiroRuntime(view).webAuth.status, 'signin_started');
  assert.equal(getKiroRuntime(view).desktopAuth.clientId, 'client-001');
  assert.equal(getKiroRuntime(view).desktopAuth.refreshToken, 'refresh-001');
  assert.equal(getKiroRuntime(view).upload.status, 'ready_to_upload');
  assert.equal(getKiroRuntime(view).upload.credentialId, 321);
  assert.equal(view.runtimeState.flowState.kiro.session.currentStage, 'desktop-authorize');
  assert.equal(view.runtimeState.flowState.kiro.register.email, 'aws-user@example.com');
  assert.equal(view.runtimeState.flowState.kiro.upload.credentialId, 321);
});

test('kiro state session patch accepts canonical nested runtime updates', () => {
  const api = loadKiroStateApi();
  const patch = api.buildSessionStatePatch({
    runtimeState: api.buildRuntimeStatePatch({}, api.buildDefaultRuntimeState()).runtimeState,
  }, {
    runtimeState: {
      flowState: {
        kiro: {
          session: {
            currentStage: 'register',
            pageState: 'register_otp_page',
            pageUrl: 'https://signin.aws/register',
          },
          register: {
            email: 'aws-user@example.com',
            fullName: 'Ada Lovelace',
            verificationRequestedAt: 1700000000000,
          },
          desktopAuth: {
            status: 'waiting_callback',
          },
          upload: {
            status: 'waiting_register',
          },
        },
      },
    },
  });

  assert.equal(Object.prototype.hasOwnProperty.call(patch, 'kiroRuntime'), false);
  assert.equal(getKiroRuntime(patch).session.currentStage, 'register');
  assert.equal(getKiroRuntime(patch).session.pageState, 'register_otp_page');
  assert.equal(getKiroRuntime(patch).session.pageUrl, 'https://signin.aws/register');
  assert.equal(getKiroRuntime(patch).register.email, 'aws-user@example.com');
  assert.equal(getKiroRuntime(patch).register.fullName, 'Ada Lovelace');
  assert.equal(getKiroRuntime(patch).register.verificationRequestedAt, 1700000000000);
  assert.equal(getKiroRuntime(patch).desktopAuth.status, 'waiting_callback');
  assert.equal(getKiroRuntime(patch).upload.status, 'waiting_register');
  assert.equal(patch.runtimeState.flowState.kiro.session.currentStage, 'register');
  assert.equal(patch.runtimeState.flowState.kiro.register.email, 'aws-user@example.com');
  assert.equal(patch.runtimeState.flowState.kiro.desktopAuth.status, 'waiting_callback');
});

test('kiro state reset helpers clear downstream runtime and fresh keep-state preserves only target selection', () => {
  const api = loadKiroStateApi();
  const currentState = {
    targetId: 'kiro-rs',
    runtimeState: api.buildRuntimeStatePatch({}, {
      session: {
        currentStage: 'upload',
        registerTabId: 88,
      },
      register: {
        email: 'aws-user@example.com',
        fullName: 'Ada Lovelace',
        status: 'completed',
      },
      desktopAuth: {
        clientId: 'client-001',
        clientSecret: 'secret-001',
        refreshToken: 'refresh-001',
        status: 'authorized',
      },
      upload: {
        targetId: 'kiro-rs',
        status: 'uploaded',
        credentialId: 321,
      },
    }).runtimeState,
  };

  const resetPatch = api.buildDownstreamResetPatch('kiro-submit-email', currentState);
  assert.equal(Object.prototype.hasOwnProperty.call(resetPatch, 'kiroRuntime'), false);
  assert.equal(getKiroRuntime(resetPatch).session.currentStage, 'register');
  assert.equal(getKiroRuntime(resetPatch).register.email, '');
  assert.equal(getKiroRuntime(resetPatch).register.fullName, '');
  assert.equal(getKiroRuntime(resetPatch).desktopAuth.refreshToken, '');
  assert.equal(getKiroRuntime(resetPatch).upload.status, '');
  assert.equal(getKiroRuntime(resetPatch).upload.credentialId, null);
  assert.equal(resetPatch.runtimeState.flowState.kiro.register.email, '');
  assert.equal(resetPatch.runtimeState.flowState.kiro.desktopAuth.refreshToken, '');

  const keepState = api.buildFreshKeepState(currentState);
  assert.equal(keepState.targetId, 'kiro-rs');
  assert.equal(Object.prototype.hasOwnProperty.call(keepState, 'kiroRuntime'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(keepState.runtimeState, 'nodeStatuses'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(keepState.runtimeState, 'currentNodeId'), false);
  assert.equal(getKiroRuntime(keepState).register.email, '');
  assert.equal(getKiroRuntime(keepState).desktopAuth.refreshToken, '');
  assert.equal(getKiroRuntime(keepState).upload.status, '');
  assert.equal(getKiroRuntime(keepState).upload.targetId, 'kiro-rs');
  assert.equal(keepState.runtimeState.flowState.kiro.upload.targetId, 'kiro-rs');
});
