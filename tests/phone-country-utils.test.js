const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function loadPhoneCountryUtils() {
  const source = fs.readFileSync('flows/openai/content/phone-country-utils.js', 'utf8');
  const root = {};
  return new Function('self', `${source}; return self.MultiPagePhoneCountryUtils;`)(root);
}

test('phone country utils extracts dial codes from current OpenAI country labels', () => {
  const utils = loadPhoneCountryUtils();

  assert.equal(utils.extractDialCodeFromText('United Kingdom (+44)'), '44');
  assert.equal(utils.extractDialCodeFromText('United Kingdom +(44)'), '44');
  assert.equal(utils.extractDialCodeFromText('United Kingdom +44'), '44');
});

test('phone country utils resolves country dial code from provider phone numbers', () => {
  const utils = loadPhoneCountryUtils();

  assert.equal(utils.resolveDialCodeFromPhoneNumber('447423278610'), '44');
  assert.equal(utils.resolveDialCodeFromPhoneNumber('+8613800138000'), '86');
  assert.equal(utils.resolveDialCodeFromPhoneNumber('12461234567'), '1246');
});

test('phone country utils finds country options by phone dial code and country aliases', () => {
  const utils = loadPhoneCountryUtils();
  const options = [
    { value: 'ID', textContent: 'Indonesia +(62)' },
    { value: 'GB', textContent: 'United Kingdom +(44)' },
  ];

  assert.equal(utils.findOptionByPhoneNumber(options, '447423278610'), options[1]);
  assert.equal(utils.findOptionByCountryLabel(options, 'England'), options[1]);
});

test('phone country utils is loaded before phone auth content scripts', () => {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  const authScript = manifest.content_scripts.find((entry) => (
    Array.isArray(entry.matches)
    && entry.matches.some((match) => match.includes('auth.openai.com'))
  ));

  assert.ok(authScript, 'missing auth content script');
  assert.ok(authScript.js.includes('flows/openai/content/phone-country-utils.js'));
  assert.ok(
    authScript.js.indexOf('flows/openai/content/phone-country-utils.js') < authScript.js.indexOf('flows/openai/content/phone-auth.js'),
    'phone-country-utils.js must load before phone-auth.js'
  );
  assert.ok(
    authScript.js.indexOf('flows/openai/content/phone-country-utils.js') < authScript.js.indexOf('flows/openai/content/openai-auth.js'),
    'phone-country-utils.js must load before openai-auth.js'
  );

  const background = fs.readFileSync('background.js', 'utf8');
  const injectLine = background.match(/const\s+OPENAI_AUTH_INJECT_FILES\s*=\s*\[[^\n]+\]/)?.[0] || '';
  assert.ok(injectLine.includes("'flows/openai/content/phone-country-utils.js'"));
  assert.ok(
    injectLine.indexOf("'flows/openai/content/phone-country-utils.js'") < injectLine.indexOf("'flows/openai/content/phone-auth.js'"),
    'dynamic signup injection must load phone-country-utils.js before phone-auth.js'
  );
});
