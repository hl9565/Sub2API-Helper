const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background.js', 'utf8');
const match = source.match(/function generatePassword\(\)\s*\{[\s\S]*?return passwordChars\.join\(''\);\r?\n\}/);

assert.ok(match, 'generatePassword definition should exist in background.js');

const generatePassword = new Function(`${match[0]}; return generatePassword;`)();

test('generatePassword produces shared account passwords within the required policy', () => {
  for (let index = 0; index < 100; index += 1) {
    const password = String(generatePassword() || '');

    assert.ok(password.length >= 8, `password should be at least 8 characters: ${password}`);
    assert.ok(password.length <= 64, `password should be at most 64 characters: ${password}`);
    assert.match(password, /[A-Z]/, `password should include an uppercase letter: ${password}`);
    assert.match(password, /[a-z]/, `password should include a lowercase letter: ${password}`);
    assert.match(password, /[0-9]/, `password should include a digit: ${password}`);
    assert.match(password, /[^A-Za-z0-9]/, `password should include a symbol: ${password}`);
  }
});
