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

test('step 9 auto-fills profile when phone verification lands on signup profile page', async () => {
  const api = new Function(`
const profilePayloads = [];
const logs = [];
let consentReady = false;

const location = {
  href: 'https://auth.openai.com/create-account/profile',
};

function log(message, level = 'info') {
  logs.push({ message, level });
}

function isStep5Ready() {
  return !consentReady;
}

function isSignupProfilePageUrl(url = location.href) {
  return /\\/create-account\\/profile(?:[/?#]|$)/i.test(String(url || ''));
}

function isStep8Ready() {
  return consentReady;
}

function isAddPhonePageReady() {
  return false;
}

async function sleep() {}
function throwIfStopped() {}

const phoneAuthHelpers = {
  async submitPhoneVerificationCode() {
    return {
      success: true,
      assumed: true,
      url: location.href,
    };
  },
};

async function step5_fillNameBirthday(payload) {
  profilePayloads.push(payload);
  consentReady = true;
  location.href = 'https://auth.openai.com/authorize';
  return {
    skippedPostSubmitCheck: true,
    directProceedToStep6: true,
  };
}

${extractFunction('waitForPhoneVerificationProfileCompletion')}
${extractFunction('submitPhoneVerificationCodeWithProfileFallback')}

return {
  run(payload) {
    return submitPhoneVerificationCodeWithProfileFallback(payload);
  },
  snapshot() {
    return {
      profilePayloads,
      logs,
    };
  },
};
`)();

  const result = await api.run({
    code: '123456',
    signupProfile: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      year: 2003,
      month: 6,
      day: 19,
    },
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    profileCompleted: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.deepStrictEqual(api.snapshot().profilePayloads, [{
    firstName: 'Ada',
    lastName: 'Lovelace',
    year: 2003,
    month: 6,
    day: 19,
  }]);
});

test('step 9 leaves the existing consent flow untouched when no profile page appears', async () => {
  const api = new Function(`
const profilePayloads = [];
const location = {
  href: 'https://auth.openai.com/authorize',
};

function isStep5Ready() {
  return false;
}

function isSignupProfilePageUrl(url = location.href) {
  return /\\/create-account\\/profile(?:[/?#]|$)/i.test(String(url || ''));
}

function isStep8Ready() {
  return true;
}

function isAddPhonePageReady() {
  return false;
}

function throwIfStopped() {}
async function sleep() {}

const phoneAuthHelpers = {
  async submitPhoneVerificationCode() {
    return {
      success: true,
      consentReady: true,
      url: location.href,
    };
  },
};

async function step5_fillNameBirthday(payload) {
  profilePayloads.push(payload);
}

${extractFunction('waitForPhoneVerificationProfileCompletion')}
${extractFunction('submitPhoneVerificationCodeWithProfileFallback')}

return {
  run(payload) {
    return submitPhoneVerificationCodeWithProfileFallback(payload);
  },
  snapshot() {
    return {
      profilePayloads,
    };
  },
};
`)();

  const result = await api.run({
    code: '123456',
    signupProfile: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      year: 2003,
      month: 6,
      day: 19,
    },
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.deepStrictEqual(api.snapshot().profilePayloads, []);
});
