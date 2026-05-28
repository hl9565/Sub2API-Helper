const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { readFlowRegistryBundle } = require('./helpers/script-bundles.js');

const flowRegistrySource = readFlowRegistryBundle();
const settingsSchemaSource = fs.readFileSync('core/flow-kernel/settings-schema.js', 'utf8');
const settingsImporterSource = fs.readFileSync('imports/legacy/settings-importer.js', 'utf8');

function loadImporterApi() {
  const scope = {};
  return new Function('self', `
${flowRegistrySource}
${settingsSchemaSource}
${settingsImporterSource}
return {
  flowRegistry: self.MultiPageFlowRegistry,
  settingsSchema: self.MultiPageSettingsSchema,
  importer: self.MultiPageLegacySettingsImporter,
};
`)(scope);
}

test('legacy settings importer converts flat legacy keys into canonical settingsState', () => {
  const { flowRegistry, settingsSchema, importer } = loadImporterApi();
  const importerApi = importer.createSettingsImporter({
    flowRegistry,
    settingsSchemaApi: settingsSchema.createSettingsSchema({ flowRegistry }),
  });

  const imported = importerApi.importSettings({
    activeFlowId: 'kiro',
    panelMode: 'sub2api',
    kiroTargetId: 'kiro-rs',
    kiroRsUrl: 'https://kiro.example.com/admin',
    kiroRsKey: 'secret-key',
    mailProvider: 'hotmail',
    stepExecutionRangeByFlow: {
      kiro: { enabled: true, fromStep: 2, toStep: 9 },
    },
    kiroRuntime: {
      upload: {
        status: 'uploaded',
      },
    },
  });

  assert.equal(imported.settingsSchemaVersion, 5);
  assert.equal(imported.settingsState.activeFlowId, 'kiro');
  assert.equal(imported.settingsState.flows.openai.selectedTargetId, 'sub2api');
  assert.equal(imported.settingsState.flows.kiro.selectedTargetId, 'kiro-rs');
  assert.equal(imported.settingsState.flows.kiro.targets['kiro-rs'].baseUrl, 'https://kiro.example.com/admin');
  assert.equal(imported.settingsState.flows.kiro.targets['kiro-rs'].apiKey, 'secret-key');
  assert.deepEqual(imported.settingsState.flows.kiro.autoRun.stepExecutionRange, {
    enabled: true,
    fromStep: 2,
    toStep: 9,
  });
  assert.equal(Object.prototype.hasOwnProperty.call(imported, 'kiroRuntime'), false);
  assert.deepEqual(imported.legacyFieldHits.sort(), [
    'kiroRuntime',
    'kiroTargetId',
    'panelMode',
    'stepExecutionRangeByFlow',
  ]);
});

test('legacy settings importer preserves canonical settingsState without reintroducing old fields', () => {
  const { flowRegistry, settingsSchema, importer } = loadImporterApi();
  const schema = settingsSchema.createSettingsSchema({ flowRegistry });
  const importerApi = importer.createSettingsImporter({
    flowRegistry,
    settingsSchemaApi: schema,
  });
  const canonicalState = schema.normalizeSettingsState({
    settingsState: schema.buildDefaultSettingsState(),
  });

  const imported = importerApi.importSettings({
    settingsSchemaVersion: 5,
    settingsState: canonicalState,
  });

  assert.deepEqual(imported.settingsState, canonicalState);
  assert.deepEqual(imported.legacyFieldHits, []);
});
