const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const scriptPath = path.join(process.cwd(), 'scripts/gpc_sms_helper_macos.py');

function runPython(args, options = {}) {
  for (const command of ['python3', 'python']) {
    const result = spawnSync(command, args, {
      encoding: 'utf8',
      ...options,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        ...(options.env || {}),
      },
    });
    if (result.error && result.error.code === 'ENOENT') {
      continue;
    }
    if (process.platform === 'win32' && result.status === 9009) {
      continue;
    }
    return result;
  }
  return null;
}

test('GPC SMS helper shows macOS and iPhone forwarding guidance on non-macOS', () => {
  const help = runPython([scriptPath, '--help']);
  if (!help) {
    return;
  }
  assert.equal(help.status, 0);
  if (process.platform === 'darwin') {
    return;
  }
  const run = runPython([scriptPath, '--db', '/tmp/nonexistent-gpc-chat.db'], {
    timeout: 3000,
  });
  assert.ok(run);
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /仅支持 macOS/);
  assert.match(run.stderr, /iPhone 短信已转发|短信转发/);
});

test('GPC SMS helper filters cached OTP records by order timestamp', () => {
  const code = `
import importlib.util
import json

script_path = ${JSON.stringify(scriptPath)}
spec = importlib.util.spec_from_file_location("gpc_sms_helper_macos", script_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

old = {"otp": "111111", "code": "111111", "message_id": "old", "received_at": "2026-05-05T00:00:00+00:00"}
fresh = {"otp": "222222", "code": "222222", "message_id": "fresh", "received_at": "2026-05-05T00:00:10+00:00"}
state = {"last_otp": fresh, "otps": [fresh, old]}
payload = {
    "without_filter": module.select_otp_record(state, 0)["otp"],
    "fresh_only": module.select_otp_record(state, module.parse_timestamp_ms("2026-05-05T00:00:05+00:00"))["otp"],
    "none_after_fresh": module.select_otp_record(state, module.parse_timestamp_ms("2026-05-05T00:00:11+00:00")) is None,
}
print(json.dumps(payload))
`;
  const run = runPython(['-c', code], {
    timeout: 3000,
    env: { GPC_SMS_HELPER_ALLOW_NON_MAC: '1' },
  });
  if (!run) {
    return;
  }
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout.trim()), {
    without_filter: '222222',
    fresh_only: '222222',
    none_after_fresh: true,
  });
});

test('GPC SMS helper selects and consumes cached OTP records by phone', () => {
  const code = `
import importlib.util
import json

script_path = ${JSON.stringify(scriptPath)}
spec = importlib.util.spec_from_file_location("gpc_sms_helper_macos", script_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

record_a = {
    "otp": "111111",
    "code": "111111",
    "message_id": "a",
    "rowid": 1,
    "phone_e164": "+8615808505050",
    "account_phone": "+8615808505050",
    "received_at": "2026-05-05T00:00:00+00:00",
}
record_b = {
    "otp": "222222",
    "code": "222222",
    "message_id": "b",
    "rowid": 2,
    "phone_e164": "+8618984829950",
    "account_phone": "+8618984829950",
    "received_at": "2026-05-05T00:00:10+00:00",
}
module.STATE.update({"last_otp": record_b, "otps": [record_b, record_a]})
selected_a = module.select_otp_record(module.get_state(), phone="+8615808505050")
module.consume_otp_record(phone="+8615808505050", record=selected_a)
state_after = module.get_state()
payload = {
    "selected_a": selected_a["otp"],
    "selected_b_after": module.select_otp_record(state_after, phone="+8618984829950")["otp"],
    "selected_a_after": module.select_otp_record(state_after, phone="+8615808505050") is None,
    "global_after": module.select_otp_record(state_after)["otp"],
}
print(json.dumps(payload))
`;
  const run = runPython(['-c', code], {
    timeout: 3000,
    env: { GPC_SMS_HELPER_ALLOW_NON_MAC: '1' },
  });
  if (!run) {
    return;
  }
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout.trim()), {
    selected_a: '111111',
    selected_b_after: '222222',
    selected_a_after: true,
    global_after: '222222',
  });
});

test('GPC SMS helper consume keeps newer same-phone OTP when consuming an older record', () => {
  const code = `
import importlib.util
import json

script_path = ${JSON.stringify(scriptPath)}
spec = importlib.util.spec_from_file_location("gpc_sms_helper_macos", script_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

record_old = {
    "otp": "111111",
    "code": "111111",
    "message_id": "old",
    "rowid": 1,
    "phone_e164": "+8613800138000",
    "account_phone": "+8613800138000",
    "received_at": "2026-05-05T00:00:00+00:00",
}
record_new = {
    "otp": "222222",
    "code": "222222",
    "message_id": "new",
    "rowid": 2,
    "phone_e164": "+8613800138000",
    "account_phone": "+8613800138000",
    "received_at": "2026-05-05T00:00:10+00:00",
}
record_other = {
    "otp": "333333",
    "code": "333333",
    "message_id": "other",
    "rowid": 3,
    "phone_e164": "+8618984829950",
    "account_phone": "+8618984829950",
    "received_at": "2026-05-05T00:00:20+00:00",
}
module.STATE.update({"last_otp": record_new, "otps": [record_new, record_old, record_other]})
module.consume_otp_record(phone="+8613800138000", record=record_old)
state_after = module.get_state()
payload = {
    "same_phone_after": module.select_otp_record(state_after, phone="+8613800138000")["otp"],
    "other_phone_after": module.select_otp_record(state_after, phone="+8618984829950")["otp"],
    "records_after": [item["message_id"] for item in state_after.get("otps", [])],
    "global_after": module.select_otp_record(state_after)["otp"],
}
print(json.dumps(payload))
`;
  const run = runPython(['-c', code], {
    timeout: 3000,
    env: { GPC_SMS_HELPER_ALLOW_NON_MAC: '1' },
  });
  if (!run) {
    return;
  }
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout.trim()), {
    same_phone_after: '222222',
    other_phone_after: '333333',
    records_after: ['new', 'other'],
    global_after: '222222',
  });
});
