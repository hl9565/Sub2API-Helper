const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('phone-sms/providers/registry.js', 'utf8');

function loadRegistry(root = {}) {
  return new Function('self', `${source}; return self.PhoneSmsProviderRegistry;`)(root);
}

test('phone sms provider registry normalizes ids, order and labels consistently', () => {
  const registry = loadRegistry({
    PhoneSmsHeroSmsProvider: {
      createProvider: (deps = {}) => ({ provider: 'hero-sms', deps }),
    },
    PhoneSmsFiveSimProvider: {
      createProvider: (deps = {}) => ({ provider: '5sim', deps }),
    },
  });

  assert.deepStrictEqual(registry.getProviderIds(), ['hero-sms', '5sim', 'nexsms']);
  assert.equal(registry.normalizeProviderId(' NEXSMS '), 'nexsms');
  assert.equal(registry.normalizeProviderId('unknown-provider'), 'hero-sms');
  assert.equal(registry.getProviderLabel('nexsms'), 'NexSMS');
  assert.equal(registry.getProviderDefinition('nexsms').moduleKey, 'PhoneSmsNexSmsProvider');
  assert.deepStrictEqual(
    registry.normalizeProviderOrder([
      { provider: 'nexsms' },
      { id: '5sim' },
      { value: 'hero-sms' },
      'NEXSMS',
    ]),
    ['nexsms', '5sim', 'hero-sms']
  );
  assert.deepStrictEqual(
    registry.normalizeProviderOrder([], ['nexsms', '5sim', 'nexsms']),
    ['nexsms', '5sim']
  );
  assert.deepStrictEqual(
    registry.createProvider('5sim', { foo: 1 }),
    { provider: '5sim', deps: { foo: 1 } }
  );
  assert.throws(() => registry.createProvider('nexsms'), /接码平台模块未加载：nexsms/);
});
