const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('flows/kiro/content/register-page.js', 'utf8');

function createTextNode(textContent = '') {
  return { textContent };
}

function createInputElement({
  id = '',
  type = 'text',
  placeholder = '',
  label = '',
  value = '',
} = {}) {
  const attributes = {
    id,
    type,
    placeholder,
    autocomplete: 'off',
  };
  return {
    tagName: 'INPUT',
    id,
    type,
    value,
    labels: label ? [createTextNode(label)] : [],
    disabled: false,
    readOnly: false,
    form: null,
    getAttribute(name) {
      return attributes[name] || '';
    },
    getBoundingClientRect() {
      return { width: 455, height: 32 };
    },
    closest(selector) {
      if (selector === 'label') {
        return null;
      }
      return null;
    },
  };
}

function createButtonElement({ text = 'Continue', testId = 'test-primary-button' } = {}) {
  return {
    tagName: 'BUTTON',
    textContent: text,
    value: '',
    disabled: false,
    form: null,
    getAttribute(name) {
      if (name === 'data-testid') return testId;
      if (name === 'type') return 'submit';
      return '';
    },
    getBoundingClientRect() {
      return { width: 455, height: 32 };
    },
    closest() {
      return null;
    },
  };
}

function createHarness({ href, hostname, title = '', bodyText = '' }) {
  return createDomHarness({ href, hostname, title, bodyText });
}

function createDomHarness({
  href,
  hostname,
  title = '',
  bodyText = '',
  inputs = [],
  buttons = [],
} = {}) {
  const elementsById = new Map();
  for (const element of [...inputs, ...buttons]) {
    if (element.id) {
      elementsById.set(element.id, element);
    }
  }
  const context = {
    console: { log() {}, warn() {}, error() {}, info() {} },
    URL,
    location: { href, hostname },
    document: {
      title,
      body: {
        textContent: bodyText,
      },
      documentElement: {
        getAttribute() {
          return '1';
        },
        setAttribute() {},
      },
      getElementById(id) {
        return elementsById.get(id) || null;
      },
      querySelector() {
        return null;
      },
      querySelectorAll(selector) {
        if (String(selector).startsWith('label[for=')) {
          return [];
        }
        const testIdMatch = String(selector).match(/\[data-testid="([^"]+)"\]/);
        if (testIdMatch) {
          return [...inputs, ...buttons].filter((element) => element.getAttribute?.('data-testid') === testIdMatch[1]);
        }
        if (String(selector).trim().startsWith('input')) {
          return inputs;
        }
        if (String(selector).includes('button') || String(selector).includes('[role="button"]')) {
          return buttons;
        }
        return [];
      },
    },
    window: {},
    globalThis: null,
    resetStopState() {},
    isStopError() {
      return false;
    },
    throwIfStopped() {},
    sleep() {
      return Promise.resolve();
    },
    fillInput(element, value) {
      element.value = value;
    },
    MouseEvent: class {},
    PointerEvent: class {},
    KeyboardEvent: class {},
    Event: class {},
  };
  context.window = context;
  context.globalThis = context;
  context.window.getComputedStyle = () => ({ display: 'block', visibility: 'visible' });
  context.CSS = { escape: (value) => String(value) };

  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

test('kiro register content detects aws request error page as a proxy failure', () => {
  const harness = createHarness({
    href: 'https://profile.aws.amazon.com/signup',
    hostname: 'profile.aws.amazon.com',
    title: '错误',
    bodyText: '抱歉，处理您的请求时出错。请重试。',
  });

  const detected = harness.detectKiroRegisterPageState();

  assert.equal(detected.state, 'proxy_error_page');
  assert.match(detected.fatalMessage, /切换代理/);
});

test('kiro register content does not misclassify the normal name page as a proxy failure', () => {
  const harness = createHarness({
    href: 'https://profile.aws.amazon.com/signup',
    hostname: 'profile.aws.amazon.com',
    title: 'Enter your name',
    bodyText: '输入您的姓名 继续',
  });

  const fatal = harness.detectKiroFatalPageState('输入您的姓名 继续', harness.location.href, harness.document.title);

  assert.equal(fatal, null);
});

test('kiro register content treats Kiro web success callback as signed in', () => {
  const harness = createHarness({
    href: 'https://app.kiro.dev/signin?auth_status=success&redirect_from=KiroIDE',
    hostname: 'app.kiro.dev',
    title: 'Kiro',
    bodyText: 'Signed in',
  });

  const detected = harness.detectKiroRegisterPageState();

  assert.equal(detected.state, 'kiro_web_signed_in');
});

test('kiro register content extracts signed-in account email from Kiro account page text', () => {
  const harness = createHarness({
    href: 'https://app.kiro.dev/settings/account',
    hostname: 'app.kiro.dev',
    title: 'Account',
    bodyText: 'Account Email scrap-aged-quirk@duck.com support@kiro.dev',
  });

  const detected = harness.detectKiroRegisterPageState();

  assert.equal(detected.state, 'kiro_web_signed_in');
  assert.equal(detected.accountEmail, 'scrap-aged-quirk@duck.com');
  assert.equal(detected.email, 'scrap-aged-quirk@duck.com');
});

test('kiro register content fills primary and confirm password fields separately', async () => {
  const passwordInput = createInputElement({
    id: 'formField15-1779204320095-7559',
    type: 'text',
    placeholder: 'Enter password',
    label: '\u5bc6\u7801',
  });
  const confirmPasswordInput = createInputElement({
    id: 'formField16-1779204320096-1309',
    type: 'text',
    placeholder: 'Re-enter password',
    label: '\u786e\u8ba4\u5bc6\u7801',
  });
  const checkboxInput = createInputElement({
    id: '17-1779204320097-4334',
    type: 'checkbox',
    label: '\u663e\u793a\u5bc6\u7801',
    value: 'on',
  });
  const continueButton = createButtonElement();
  const clicks = [];

  const harness = createDomHarness({
    href: 'https://us-east-1.signin.aws/platform/d-9067642ac7/signup',
    hostname: 'us-east-1.signin.aws',
    title: 'Amazon Web Services',
    bodyText: 'Create your password',
    inputs: [passwordInput, confirmPasswordInput, checkboxInput],
    buttons: [continueButton],
  });
  harness.simulateClick = (element) => clicks.push(element);

  const detected = harness.detectKiroRegisterPageState();
  assert.equal(detected.state, 'create_password_page');
  assert.equal(detected.passwordInput, passwordInput);
  assert.equal(detected.confirmPasswordInput, confirmPasswordInput);

  const result = await harness.submitKiroPassword({ password: 'mdy8U9_rzqhw6D' });

  assert.equal(result.state, 'password_submitted');
  assert.equal(passwordInput.value, 'mdy8U9_rzqhw6D');
  assert.equal(confirmPasswordInput.value, 'mdy8U9_rzqhw6D');
  assert.deepEqual(clicks, [continueButton]);
});

test('kiro register content classifies AWS login password as an existing-account branch', () => {
  const passwordInput = createInputElement({
    id: 'formField15-1779237828927-4809',
    type: 'text',
    placeholder: 'Enter password',
    label: '\u5bc6\u7801',
  });
  const continueButton = createButtonElement({ text: '\u7ee7\u7eed' });

  const harness = createDomHarness({
    href: 'https://us-east-1.signin.aws/platform/d-9067642ac7/login?workflowStateHandle=abc',
    hostname: 'us-east-1.signin.aws',
    title: 'Amazon Web Services',
    bodyText: 'Sign in with your AWS Builder ID Email much-glance-avert@duck.com Change',
    inputs: [passwordInput],
    buttons: [continueButton],
  });

  const detected = harness.detectKiroRegisterPageState();

  assert.equal(detected.state, 'login_password_page');
  assert.equal(detected.email, 'much-glance-avert@duck.com');
  assert.equal(detected.passwordInput, passwordInput);
});

test('kiro register content classifies signup verification separately from login verification', () => {
  const registerOtpInput = createInputElement({
    id: 'formField38-1779237828927-4809',
    type: 'text',
    placeholder: '6-digit',
    label: '\u9a8c\u8bc1\u7801',
  });
  const loginOtpInput = createInputElement({
    id: 'formField38-1779237828927-4810',
    type: 'text',
    placeholder: '6-digit',
    label: '\u9a8c\u8bc1\u7801',
  });

  const registerHarness = createDomHarness({
    href: 'https://us-east-1.signin.aws/platform/d-9067642ac7/signup?state=abc',
    hostname: 'us-east-1.signin.aws',
    title: 'Amazon Web Services',
    bodyText: 'Verify your identity Email new-user@duck.com',
    inputs: [registerOtpInput],
    buttons: [createButtonElement()],
  });
  const loginHarness = createDomHarness({
    href: 'https://us-east-1.signin.aws/platform/d-9067642ac7/login?workflowStateHandle=abc',
    hostname: 'us-east-1.signin.aws',
    title: 'Amazon Web Services',
    bodyText: 'Verify your identity Email existing-user@duck.com',
    inputs: [loginOtpInput],
    buttons: [createButtonElement()],
  });

  const registerDetected = registerHarness.detectKiroRegisterPageState();
  const loginDetected = loginHarness.detectKiroRegisterPageState();

  assert.equal(registerDetected.state, 'register_otp_page');
  assert.equal(registerDetected.email, 'new-user@duck.com');
  assert.equal(loginDetected.state, 'login_otp_page');
  assert.equal(loginDetected.email, 'existing-user@duck.com');
});

test('kiro register content classifies AWS signup hash verify route as register OTP page', () => {
  const harness = createHarness({
    href: 'https://profile.aws.amazon.com/?workflowID=abc#/signup/verify-otp',
    hostname: 'profile.aws.amazon.com',
    title: 'Amazon Web Services',
    bodyText: 'Verify your email Verification code 6 digits Continue hash-user@duck.com',
  });

  const detected = harness.detectKiroRegisterPageState();

  assert.equal(detected.state, 'register_otp_page');
  assert.equal(detected.email, 'hash-user@duck.com');
  assert.equal(detected.otpInput, null);
  assert.equal(detected.verifyButton, null);
});

test('kiro register content keeps AWS login hash verify route out of register OTP branch', () => {
  const harness = createHarness({
    href: 'https://profile.aws.amazon.com/?workflowID=abc#/login/verify-otp',
    hostname: 'profile.aws.amazon.com',
    title: 'Amazon Web Services',
    bodyText: 'Verify your identity Verification code 6 digits Continue existing-hash-user@duck.com',
  });

  const detected = harness.detectKiroRegisterPageState();

  assert.equal(detected.state, 'login_otp_page');
  assert.equal(detected.email, 'existing-hash-user@duck.com');
});
