const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('flows/openai/content/openai-auth.js', 'utf8');

function extractFunction(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => source.indexOf(marker))
    .find((index) => index >= 0);
  if (start < 0) {
    throw new Error(`missing function ${name}`);
  }

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
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
  if (braceStart < 0) {
    throw new Error(`missing body for function ${name}`);
  }

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

function extractConst(name) {
  const pattern = new RegExp(`const\\s+${name}\\s*=\\s*[\\s\\S]*?;`);
  const match = source.match(pattern);
  if (!match) {
    throw new Error(`missing const ${name}`);
  }
  return match[0];
}

test('login step recognizes Japanese email and phone entry actions', () => {
  const api = new Function(`
const emailButton = {
  textContent: 'メールアドレスで続行',
  disabled: false,
  getAttribute(name) {
    if (name === 'aria-disabled') return 'false';
    return '';
  },
};
const phoneButton = {
  textContent: '電話番号で続行',
  disabled: false,
  getAttribute(name) {
    if (name === 'aria-disabled') return 'false';
    return '';
  },
};
const codeButton = {
  textContent: 'コードでサインイン',
  disabled: false,
  getAttribute(name) {
    if (name === 'aria-disabled') return 'false';
    return '';
  },
};
const document = {
  querySelectorAll(selector) {
    if (selector === 'button, a, [role="button"], [role="link"], input[type="button"], input[type="submit"]') {
      return [codeButton, phoneButton, emailButton];
    }
    return [];
  },
};

${extractConst('ONE_TIME_CODE_LOGIN_PATTERN')}
${extractConst('LOGIN_ENTRY_ACTION_PATTERN')}
${extractConst('LOGIN_SWITCH_TO_PHONE_PATTERN')}
${extractConst('LOGIN_PHONE_ACTION_PATTERN')}
${extractConst('LOGIN_EXTERNAL_IDP_PATTERN')}
${extractConst('LOGIN_CODE_ONLY_ACTION_PATTERN')}

function isVisibleElement(el) { return Boolean(el); }
function isActionEnabled(el) { return Boolean(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true'; }
function getActionText(el) { return [el?.textContent, el?.value, el?.getAttribute?.('aria-label'), el?.getAttribute?.('title')].filter(Boolean).join(' ').replace(/\\s+/g, ' ').trim(); }

${extractFunction('findLoginEntryTrigger')}
${extractFunction('findLoginPhoneEntryTrigger')}
${extractFunction('findOneTimeCodeLoginTrigger')}

return {
  email() { return getActionText(findLoginEntryTrigger()); },
  phone() { return getActionText(findLoginPhoneEntryTrigger()); },
  code() { return getActionText(findOneTimeCodeLoginTrigger()); },
};
`)();

  assert.equal(api.email(), 'メールアドレスで続行');
  assert.equal(api.phone(), '電話番号で続行');
  assert.equal(api.code(), 'コードでサインイン');
});

test('login submit button recognizes Japanese login and continue labels', () => {
  const api = new Function(`
const loginButton = {
  textContent: 'ログイン',
  disabled: false,
  getAttribute(name) {
    if (name === 'type') return 'button';
    if (name === 'aria-disabled') return 'false';
    return '';
  },
};
const document = {
  querySelector() { return null; },
  querySelectorAll(selector) {
    if (selector === 'button, a, [role="button"], [role="link"], input[type="button"], input[type="submit"]') {
      return [loginButton];
    }
    return [];
  },
};

${extractConst('ONE_TIME_CODE_LOGIN_PATTERN')}

function isVisibleElement(el) { return Boolean(el); }
function isActionEnabled(el) { return Boolean(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true'; }
function getActionText(el) { return [el?.textContent, el?.value, el?.getAttribute?.('aria-label'), el?.getAttribute?.('title')].filter(Boolean).join(' ').replace(/\\s+/g, ' ').trim(); }

${extractFunction('getLoginSubmitButton')}

return {
  run() { return getActionText(getLoginSubmitButton()); },
};
`)();

  assert.equal(api.run(), 'ログイン');
});

test('verification helpers recognize Japanese resend and submit actions', () => {
  const api = new Function(`
const resendButton = {
  textContent: 'コードを再送信',
  disabled: false,
  getAttribute(name) {
    if (name === 'aria-disabled') return 'false';
    return '';
  },
};
const verifyButton = {
  textContent: '確認',
  disabled: false,
  getAttribute(name) {
    if (name === 'aria-disabled') return 'false';
    return '';
  },
};
const codeInput = {
  form: {
    querySelectorAll(selector) {
      if (selector === 'button[type="submit"], input[type="submit"]') return [];
      if (selector === 'button, [role="button"], input[type="button"], input[type="submit"]') return [verifyButton];
      return [];
    },
  },
  closest() { return null; },
};
const document = {
  querySelectorAll(selector) {
    if (selector === 'button, a, [role="button"], [role="link"], input[type="button"], input[type="submit"]') {
      return [resendButton];
    }
    return [];
  },
};

${extractConst('RESEND_VERIFICATION_CODE_PATTERN')}

function isVisibleElement(el) { return Boolean(el); }
function isActionEnabled(el) { return Boolean(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true'; }
function getActionText(el) { return [el?.textContent, el?.value, el?.getAttribute?.('aria-label'), el?.getAttribute?.('title')].filter(Boolean).join(' ').replace(/\\s+/g, ' ').trim(); }

${extractFunction('findResendVerificationCodeTrigger')}
${extractFunction('getVerificationSubmitButtonForTarget')}

return {
  resend() { return getActionText(findResendVerificationCodeTrigger()); },
  submit() { return getActionText(getVerificationSubmitButtonForTarget(codeInput)); },
};
`)();

  assert.equal(api.resend(), 'コードを再送信');
  assert.equal(api.submit(), '確認');
});

test('OAuth consent detection recognizes Japanese consent copy and continue button', () => {
  const api = new Function(`
const continueButton = {
  textContent: '続行',
  disabled: false,
  getAttribute(name) {
    if (name === 'data-dd-action-name') return '';
    if (name === 'aria-disabled') return 'false';
    return '';
  },
};
const consentForm = {
  querySelectorAll(selector) {
    if (selector === 'button[type="submit"], input[type="submit"], [role="button"]') {
      return [continueButton];
    }
    return [];
  },
};
const document = {
  body: {
    innerText: 'ChatGPTを使用してCodexにサインイン',
    textContent: 'ChatGPTを使用してCodexにサインイン',
  },
  querySelector(selector) {
    if (selector === OAUTH_CONSENT_FORM_SELECTOR) return consentForm;
    return null;
  },
  querySelectorAll(selector) {
    if (selector === 'button, [role="button"]') return [continueButton];
    return [];
  },
};

${extractConst('OAUTH_CONSENT_PAGE_PATTERN')}
${extractConst('OAUTH_CONSENT_FORM_SELECTOR')}
${extractConst('CONTINUE_ACTION_PATTERN')}

function isVisibleElement(el) { return Boolean(el); }
function getActionText(el) { return [el?.textContent, el?.value, el?.getAttribute?.('aria-label'), el?.getAttribute?.('title')].filter(Boolean).join(' ').replace(/\\s+/g, ' ').trim(); }

${extractFunction('getPageTextSnapshot')}
${extractFunction('getOAuthConsentForm')}
${extractFunction('getPrimaryContinueButton')}
${extractFunction('isOAuthConsentPage')}

return {
  consent() { return isOAuthConsentPage(); },
  button() { return getActionText(getPrimaryContinueButton()); },
};
`)();

  assert.equal(api.consent(), true);
  assert.equal(api.button(), '続行');
});

test('profile step recognizes Japanese account creation and day label', () => {
  const api = new Function(`
const submitButton = {
  textContent: 'アカウントを作成',
  getAttribute(name) {
    if (name === 'type') return 'button';
    return '';
  },
};
const dayLabel = { textContent: '日' };
const dayRoot = {
  querySelectorAll(selector) {
    if (selector === 'span') return [dayLabel];
    return [];
  },
  querySelector(selector) {
    if (selector === 'button[aria-haspopup="listbox"]') return { id: 'day-button' };
    if (selector === '.react-aria-SelectValue') return { textContent: '' };
    return null;
  },
  closest() { return null; },
  parentElement: {
    querySelector(selector) {
      if (selector === '[data-testid="hidden-select-container"] select') return { id: 'day-select' };
      return null;
    },
  },
};
const document = {
  querySelector(selector) {
    if (selector === 'button[type="submit"], input[type="submit"]') return null;
    return null;
  },
  querySelectorAll(selector) {
    if (selector === 'button, [role="button"], input[type="button"], input[type="submit"]') return [submitButton];
    if (selector === '.react-aria-Select') return [dayRoot];
    return [];
  },
};

function isVisibleElement(el) { return Boolean(el); }
function getActionText(el) { return [el?.textContent, el?.value, el?.getAttribute?.('aria-label'), el?.getAttribute?.('title')].filter(Boolean).join(' ').replace(/\\s+/g, ' ').trim(); }

${extractFunction('normalizeInlineText')}
${extractFunction('getStep5SubmitButton')}
${extractFunction('findBirthdayReactAriaSelect')}

return {
  submit() { return getActionText(getStep5SubmitButton()); },
  day() { return findBirthdayReactAriaSelect('日')?.nativeSelect?.id || ''; },
};
`)();

  assert.equal(api.submit(), 'アカウントを作成');
  assert.equal(api.day(), 'day-select');
});
