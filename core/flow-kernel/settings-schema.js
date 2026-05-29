(function attachMultiPageSettingsSchema(root, factory) {
  root.MultiPageSettingsSchema = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createSettingsSchemaModule() {
  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function cloneValue(value) {
    if (Array.isArray(value)) {
      return value.map((entry) => cloneValue(entry));
    }
    if (isPlainObject(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, entryValue]) => [key, cloneValue(entryValue)])
      );
    }
    return value;
  }

  function mergePlainObjects(baseValue = {}, patchValue = {}) {
    if (Array.isArray(patchValue)) {
      return patchValue.map((entry) => cloneValue(entry));
    }
    if (!isPlainObject(patchValue)) {
      return patchValue === undefined ? cloneValue(baseValue) : patchValue;
    }
    const baseObject = isPlainObject(baseValue) ? baseValue : {};
    const next = {
      ...cloneValue(baseObject),
    };
    Object.entries(patchValue).forEach(([key, value]) => {
      next[key] = mergePlainObjects(baseObject[key], value);
    });
    return next;
  }

  function normalizeStepExecutionRangeEntry(value = {}, fallback = {}) {
    const source = isPlainObject(value) ? value : {};
    const fallbackSource = isPlainObject(fallback) ? fallback : {};
    const fromStep = Math.max(1, Number(source.fromStep ?? fallbackSource.fromStep ?? 1) || 1);
    const toStep = Math.max(fromStep, Number(source.toStep ?? fallbackSource.toStep ?? fromStep) || fromStep);
    return {
      enabled: Boolean(source.enabled ?? fallbackSource.enabled),
      fromStep,
      toStep,
    };
  }

  function normalizeEmailListSetting(value = []) {
    const source = Array.isArray(value)
      ? value
      : String(value || '').split(/[\r\n,，;；\s]+/);
    const seen = new Set();
    return source
      .map((item) => String(item || '').trim().toLowerCase())
      .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item))
      .filter((item) => {
        if (seen.has(item)) {
          return false;
        }
        seen.add(item);
        return true;
      });
  }

  function createSettingsSchema(deps = {}) {
    const rootScope = typeof self !== 'undefined' ? self : globalThis;
    const flowRegistry = deps.flowRegistry || rootScope.MultiPageFlowRegistry || {};
    const defaultFlowId = String(
      deps.defaultFlowId || flowRegistry.DEFAULT_FLOW_ID || 'openai'
    ).trim().toLowerCase() || 'openai';
    const defaultOpenAiTargetId = flowRegistry.DEFAULT_OPENAI_TARGET_ID || 'cpa';
    const defaultKiroTargetId = flowRegistry.DEFAULT_KIRO_TARGET_ID || 'kiro-rs';
    const defaultKiroRsUrl = String(flowRegistry.DEFAULT_KIRO_RS_URL || '').trim();
    const normalizeFlowId = typeof flowRegistry.normalizeFlowId === 'function'
      ? flowRegistry.normalizeFlowId
      : ((value = '', fallback = defaultFlowId) => {
        const normalized = String(value || '').trim().toLowerCase();
        return normalized || String(fallback || '').trim().toLowerCase() || defaultFlowId;
      });
    const normalizeTargetId = typeof flowRegistry.normalizeTargetId === 'function'
      ? flowRegistry.normalizeTargetId
      : ((_flowId, value = '', fallback = '') => String(value || fallback || '').trim().toLowerCase());
    const getRegisteredFlowIds = typeof flowRegistry.getRegisteredFlowIds === 'function'
      ? flowRegistry.getRegisteredFlowIds
      : (() => ['openai', 'kiro']);
    const getFlowDefinition = typeof flowRegistry.getFlowDefinition === 'function'
      ? flowRegistry.getFlowDefinition
      : (() => null);
    const getDefaultTargetId = typeof flowRegistry.getDefaultTargetId === 'function'
      ? flowRegistry.getDefaultTargetId
      : ((flowId) => (flowId === 'kiro' ? defaultKiroTargetId : defaultOpenAiTargetId));
    const getTargetDefinitions = typeof flowRegistry.getTargetDefinitions === 'function'
      ? flowRegistry.getTargetDefinitions
      : (() => ({}));

    const normalizePlusAccountAccessStrategy = (value = '') => {
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized === 'sub2api_codex_session') {
        return 'sub2api_codex_session';
      }
      if (normalized === 'cpa_codex_session') {
        return 'cpa_codex_session';
      }
      return 'oauth';
    };

    function getCanonicalFlowIds() {
      const ids = Array.isArray(getRegisteredFlowIds())
        ? getRegisteredFlowIds()
        : [];
      const seen = new Set();
      return ids
        .map((flowId) => normalizeFlowId(flowId, defaultFlowId))
        .filter((flowId) => {
          if (!flowId || seen.has(flowId)) {
            return false;
          }
          seen.add(flowId);
          return true;
        });
    }

    function getFlowSettingsDefaults(flowId) {
      const definition = getFlowDefinition(flowId) || {};
      return isPlainObject(definition.settingsDefaults) ? definition.settingsDefaults : {};
    }

    function getDefaultStepExecutionRange(flowId) {
      const flowDefaults = getFlowSettingsDefaults(flowId);
      const range = flowDefaults?.autoRun?.stepExecutionRange;
      if (isPlainObject(range)) {
        return normalizeStepExecutionRangeEntry(range, { enabled: false, fromStep: 1, toStep: 1 });
      }
      const lastStep = Math.max(1, Number(getFlowDefinition(flowId)?.workflowStepCount) || 1);
      return { enabled: false, fromStep: 1, toStep: lastStep };
    }

    function buildDefaultTargetState(flowId, targetId) {
      const definition = getFlowDefinition(flowId) || {};
      const flowDefaults = getFlowSettingsDefaults(flowId);
      const targetDefaults = isPlainObject(flowDefaults?.targets?.[targetId])
        ? flowDefaults.targets[targetId]
        : {};
      const sharedTargetDefaults = isPlainObject(definition.defaultTargetState)
        ? definition.defaultTargetState
        : {};
      const targetDefinition = isPlainObject(getTargetDefinitions(flowId)?.[targetId])
        ? getTargetDefinitions(flowId)[targetId]
        : {};
      const targetDefinitionDefaults = isPlainObject(targetDefinition.defaultState)
        ? targetDefinition.defaultState
        : {};
      return mergePlainObjects(
        mergePlainObjects(sharedTargetDefaults, targetDefinitionDefaults),
        targetDefaults
      );
    }

    function buildDefaultTargets(flowId) {
      const targetDefinitions = getTargetDefinitions(flowId) || {};
      const targetIds = Object.keys(targetDefinitions);
      const defaults = {};
      targetIds.forEach((targetId) => {
        defaults[targetId] = buildDefaultTargetState(flowId, targetId);
      });
      return defaults;
    }

    function buildDefaultFlowSettings(flowId) {
      const defaultTargetId = normalizeTargetId(
        flowId,
        getDefaultTargetId(flowId),
        flowId === 'kiro' ? defaultKiroTargetId : defaultOpenAiTargetId
      );
      const base = {
        selectedTargetId: defaultTargetId,
        targets: buildDefaultTargets(flowId),
        autoRun: {
          stepExecutionRange: getDefaultStepExecutionRange(flowId),
        },
      };
      return mergePlainObjects(base, getFlowSettingsDefaults(flowId));
    }

    function buildDefaultFlows() {
      const flows = {};
      getCanonicalFlowIds().forEach((flowId) => {
        flows[flowId] = buildDefaultFlowSettings(flowId);
      });
      return flows;
    }

    function buildDefaultSettingsState() {
      return {
        schemaVersion: 5,
        activeFlowId: defaultFlowId,
        services: {
          account: {
            customPassword: '',
          },
          email: {
            provider: '163',
          },
          phone: {
            provider: 'hero-sms',
            providerOrder: [],
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
            heroSms: {
              apiKey: '',
              reuseEnabled: true,
              acquirePriority: 'country',
              minPrice: '',
              maxPrice: '',
              preferredPrice: '',
              countryId: 52,
              countryLabel: '泰国 (Thailand)',
              countryFallback: [],
            },
            fiveSim: {
              apiKey: '',
              product: 'openai',
              countryId: 'thailand',
              countryLabel: '泰国 (Thailand)',
              countryFallback: [],
              countryOrder: [],
              minPrice: '',
              maxPrice: '',
              operator: 'any',
            },
            nexSms: {
              apiKey: '',
              countryOrder: [],
              serviceCode: 'ot',
            },
          },
          proxy: {
            enabled: false,
            provider: '711proxy',
            mode: 'account',
          },
        },
        flows: buildDefaultFlows(),
      };
    }

    function getTargetValue(settingsState, pathGetter, legacyPathGetter = null, fallback = {}) {
      const sourceState = isPlainObject(settingsState) ? settingsState : {};
      const resolvedValue = pathGetter(sourceState)
        || (typeof legacyPathGetter === 'function' ? legacyPathGetter(sourceState) : null)
        || fallback;
      return cloneValue(resolvedValue);
    }

    function normalizeFlowTargetState(flowId, targetId, nested = {}, defaults = {}) {
      const targetState = mergePlainObjects(defaults, nested);
      if (flowId === 'openai' && targetId === 'cpa') {
        return {
          ...targetState,
          vpsUrl: String(targetState.vpsUrl ?? '').trim(),
          vpsPassword: String(targetState.vpsPassword ?? ''),
          localCpaStep9Mode: String(targetState.localCpaStep9Mode ?? 'submit').trim() || 'submit',
        };
      }
      if (flowId === 'openai' && targetId === 'sub2api') {
        return {
          ...targetState,
          sub2apiUrl: String(targetState.sub2apiUrl ?? '').trim(),
          sub2apiEmail: String(targetState.sub2apiEmail ?? '').trim(),
          sub2apiPassword: String(targetState.sub2apiPassword ?? ''),
          sub2apiGroupName: String(targetState.sub2apiGroupName ?? 'codex').trim() || 'codex',
          sub2apiGroupNames: Array.isArray(targetState.sub2apiGroupNames)
            ? targetState.sub2apiGroupNames.map((entry) => String(entry || '').trim()).filter(Boolean)
            : ['codex', 'openai-plus'],
          sub2apiAccountPriority: Math.max(1, Number(targetState.sub2apiAccountPriority) || 1),
          sub2apiDefaultProxyName: String(targetState.sub2apiDefaultProxyName ?? '').trim(),
          sub2apiReauthMode: Boolean(targetState.sub2apiReauthMode),
          sub2apiReauthRestoreAccountEnabled: Boolean(targetState.sub2apiReauthRestoreAccountEnabled),
          sub2apiReauthEmailSuffix: String(targetState.sub2apiReauthEmailSuffix ?? '').trim().toLowerCase(),
          sub2apiReauthSkipEmails: normalizeEmailListSetting(targetState.sub2apiReauthSkipEmails),
        };
      }
      if (flowId === 'openai' && targetId === 'codex2api') {
        return {
          ...targetState,
          codex2apiUrl: String(targetState.codex2apiUrl ?? '').trim(),
          codex2apiAdminKey: String(targetState.codex2apiAdminKey ?? '').trim(),
        };
      }
      if (flowId === 'kiro' && targetId === 'kiro-rs') {
        return {
          ...targetState,
          baseUrl: String(targetState.baseUrl ?? defaultKiroRsUrl).trim() || defaultKiroRsUrl,
          apiKey: String(targetState.apiKey ?? ''),
        };
      }
      if (flowId === 'grok' && targetId === 'webchat2api') {
        return {
          ...targetState,
          baseUrl: String(targetState.baseUrl ?? '').trim(),
          apiKey: String(targetState.apiKey ?? ''),
        };
      }
      return targetState;
    }

    function buildNormalizedTargets(flowId, nestedFlow = {}, defaultFlow = {}) {
      const targetIds = Array.from(new Set([
        ...Object.keys(defaultFlow.targets || {}),
        ...Object.keys(isPlainObject(nestedFlow.targets) ? nestedFlow.targets : {}),
        ...Object.keys(getTargetDefinitions(flowId) || {}),
      ]));
      const targets = {};
      targetIds.forEach((targetId) => {
        targets[targetId] = normalizeFlowTargetState(
          flowId,
          targetId,
          isPlainObject(nestedFlow.targets?.[targetId]) ? nestedFlow.targets[targetId] : {},
          defaultFlow.targets?.[targetId] || buildDefaultTargetState(flowId, targetId)
        );
      });
      return targets;
    }

    function normalizeFlowSettings(flowId, input = {}, nested = {}, defaults = {}) {
      const nestedFlow = isPlainObject(nested?.flows?.[flowId]) ? nested.flows[flowId] : {};
      const activeFlowId = normalizeFlowId(
        input?.activeFlowId
        ?? nested?.activeFlowId
        ?? defaults.activeFlowId,
        defaults.activeFlowId
      );
      const mergedFlow = mergePlainObjects(defaults.flows?.[flowId] || buildDefaultFlowSettings(flowId), nestedFlow);
      const defaultTargetId = defaults.flows?.[flowId]?.selectedTargetId || getDefaultTargetId(flowId);
      const selectedTargetId = normalizeTargetId(
        flowId,
        nestedFlow?.selectedTargetId
          ?? nestedFlow?.targetId
          ?? (flowId === 'openai' ? nestedFlow?.integrationTargetId : undefined)
          ?? (activeFlowId === flowId ? (input?.selectedTargetId ?? input?.targetId) : undefined)
          ?? defaultTargetId,
        defaultTargetId
      );
      const stepExecutionRangeByFlow = isPlainObject(input?.stepExecutionRangeByFlow)
        ? input.stepExecutionRangeByFlow
        : {};
      const autoRun = {
        ...(isPlainObject(mergedFlow.autoRun) ? mergedFlow.autoRun : {}),
        stepExecutionRange: normalizeStepExecutionRangeEntry(
          stepExecutionRangeByFlow[flowId]
            ?? nestedFlow?.autoRun?.stepExecutionRange
            ?? {},
          defaults.flows?.[flowId]?.autoRun?.stepExecutionRange || getDefaultStepExecutionRange(flowId)
        ),
      };

      return {
        ...mergedFlow,
        selectedTargetId,
        targets: buildNormalizedTargets(flowId, nestedFlow, defaults.flows?.[flowId] || {}),
        autoRun,
      };
    }

    function normalizeOpenAiSettings(input = {}, nested = {}, defaults = {}, currentFlow = {}) {
      const defaultOpenAiFlow = isPlainObject(defaults?.flows?.openai)
        ? defaults.flows.openai
        : {};
      const defaultOpenAiTargets = isPlainObject(defaultOpenAiFlow.targets)
        ? defaultOpenAiFlow.targets
        : {};
      const defaultOpenAiSignup = isPlainObject(defaultOpenAiFlow.signup)
        ? defaultOpenAiFlow.signup
        : {};
      const defaultOpenAiPlus = isPlainObject(defaultOpenAiFlow.plus)
        ? defaultOpenAiFlow.plus
        : {};
      const cpaSource = {
        ...currentFlow.targets.cpa,
        ...getTargetValue(
          nested,
          (state) => state.flows?.openai?.integrationTargets?.cpa,
          null,
          {}
        ),
        vpsUrl: input?.vpsUrl ?? currentFlow.targets.cpa.vpsUrl,
        vpsPassword: input?.vpsPassword ?? currentFlow.targets.cpa.vpsPassword,
        localCpaStep9Mode: input?.localCpaStep9Mode ?? currentFlow.targets.cpa.localCpaStep9Mode,
      };
      const sub2apiSource = {
        ...currentFlow.targets.sub2api,
        ...getTargetValue(
          nested,
          (state) => state.flows?.openai?.integrationTargets?.sub2api,
          null,
          {}
        ),
        sub2apiUrl: input?.sub2apiUrl ?? currentFlow.targets.sub2api.sub2apiUrl,
        sub2apiEmail: input?.sub2apiEmail ?? currentFlow.targets.sub2api.sub2apiEmail,
        sub2apiPassword: input?.sub2apiPassword ?? currentFlow.targets.sub2api.sub2apiPassword,
        sub2apiGroupName: input?.sub2apiGroupName ?? currentFlow.targets.sub2api.sub2apiGroupName,
        sub2apiGroupNames: input?.sub2apiGroupNames ?? currentFlow.targets.sub2api.sub2apiGroupNames,
        sub2apiAccountPriority: input?.sub2apiAccountPriority ?? currentFlow.targets.sub2api.sub2apiAccountPriority,
        sub2apiDefaultProxyName: input?.sub2apiDefaultProxyName ?? currentFlow.targets.sub2api.sub2apiDefaultProxyName,
        sub2apiReauthMode: input?.sub2apiReauthMode ?? currentFlow.targets.sub2api.sub2apiReauthMode,
        sub2apiReauthRestoreAccountEnabled: input?.sub2apiReauthRestoreAccountEnabled ?? currentFlow.targets.sub2api.sub2apiReauthRestoreAccountEnabled,
        sub2apiReauthEmailSuffix: input?.sub2apiReauthEmailSuffix ?? currentFlow.targets.sub2api.sub2apiReauthEmailSuffix,
        sub2apiReauthSkipEmails: input?.sub2apiReauthSkipEmails ?? currentFlow.targets.sub2api.sub2apiReauthSkipEmails,
      };
      const codex2apiSource = {
        ...currentFlow.targets.codex2api,
        ...getTargetValue(
          nested,
          (state) => state.flows?.openai?.integrationTargets?.codex2api,
          null,
          {}
        ),
        codex2apiUrl: input?.codex2apiUrl ?? currentFlow.targets.codex2api.codex2apiUrl,
        codex2apiAdminKey: input?.codex2apiAdminKey ?? currentFlow.targets.codex2api.codex2apiAdminKey,
      };
      return {
        ...currentFlow,
        targets: {
          ...currentFlow.targets,
          cpa: normalizeFlowTargetState('openai', 'cpa', cpaSource, defaultOpenAiTargets.cpa || {}),
          sub2api: normalizeFlowTargetState('openai', 'sub2api', sub2apiSource, defaultOpenAiTargets.sub2api || {}),
          codex2api: normalizeFlowTargetState('openai', 'codex2api', codex2apiSource, defaultOpenAiTargets.codex2api || {}),
        },
        signup: {
          signupMethod: String(
            input?.signupMethod
            ?? currentFlow.signup?.signupMethod
            ?? defaultOpenAiSignup.signupMethod
            ?? 'email'
          ).trim().toLowerCase() === 'phone' ? 'phone' : 'email',
          phoneVerificationEnabled: Boolean(
            input?.phoneVerificationEnabled
            ?? currentFlow.signup?.phoneVerificationEnabled
            ?? defaultOpenAiSignup.phoneVerificationEnabled
            ?? false
          ),
          phoneSignupReloginAfterBindEmailEnabled: Boolean(
            input?.phoneSignupReloginAfterBindEmailEnabled
            ?? currentFlow.signup?.phoneSignupReloginAfterBindEmailEnabled
            ?? defaultOpenAiSignup.phoneSignupReloginAfterBindEmailEnabled
            ?? false
          ),
        },
        plus: {
          plusModeEnabled: Boolean(
            input?.plusModeEnabled
            ?? currentFlow.plus?.plusModeEnabled
            ?? defaultOpenAiPlus.plusModeEnabled
            ?? false
          ),
          plusPaymentMethod: String(
            input?.plusPaymentMethod
            ?? currentFlow.plus?.plusPaymentMethod
            ?? defaultOpenAiPlus.plusPaymentMethod
            ?? 'paypal-hosted'
          ).trim() || defaultOpenAiPlus.plusPaymentMethod || 'paypal-hosted',
          plusAccountAccessStrategy: normalizePlusAccountAccessStrategy(
            input?.plusAccountAccessStrategy
            ?? currentFlow.plus?.plusAccountAccessStrategy
            ?? defaultOpenAiPlus.plusAccountAccessStrategy
            ?? 'oauth'
          ),
          hostedCheckoutVerificationUrl: String(
            input?.hostedCheckoutVerificationUrl
            ?? currentFlow.plus?.hostedCheckoutVerificationUrl
            ?? defaultOpenAiPlus.hostedCheckoutVerificationUrl
            ?? ''
          ).trim(),
          hostedCheckoutPhoneNumber: String(
            input?.hostedCheckoutPhoneNumber
            ?? currentFlow.plus?.hostedCheckoutPhoneNumber
            ?? defaultOpenAiPlus.hostedCheckoutPhoneNumber
            ?? ''
          ).trim(),
          plusHostedCheckoutOauthDelaySeconds: (() => {
            const numeric = Number(
              input?.plusHostedCheckoutOauthDelaySeconds
              ?? currentFlow.plus?.plusHostedCheckoutOauthDelaySeconds
              ?? defaultOpenAiPlus.plusHostedCheckoutOauthDelaySeconds
              ?? 3
            );
            const fallback = Number(defaultOpenAiPlus.plusHostedCheckoutOauthDelaySeconds ?? 3) || 3;
            return Math.min(120, Math.max(0, Math.floor(Number.isFinite(numeric) ? numeric : fallback)));
          })(),
        },
      };
    }

    function normalizeKiroSettings(input = {}, defaults = {}, currentFlow = {}) {
      const defaultKiroFlow = isPlainObject(defaults?.flows?.kiro)
        ? defaults.flows.kiro
        : {};
      const defaultKiroTargets = isPlainObject(defaultKiroFlow.targets)
        ? defaultKiroFlow.targets
        : {};
      const targetSource = {
        ...currentFlow.targets['kiro-rs'],
        baseUrl: input?.kiroRsUrl ?? input?.kiroRsBaseUrl ?? currentFlow.targets['kiro-rs'].baseUrl,
        apiKey: input?.kiroRsKey ?? input?.kiroRsApiKey ?? currentFlow.targets['kiro-rs'].apiKey,
      };
      return {
        ...currentFlow,
        targets: {
          ...currentFlow.targets,
          'kiro-rs': normalizeFlowTargetState('kiro', 'kiro-rs', targetSource, defaultKiroTargets['kiro-rs'] || {}),
        },
      };
    }

    function normalizeSettingsState(input = {}, options = {}) {
      const defaults = buildDefaultSettingsState();
      const nested = isPlainObject(input?.settingsState)
        ? input.settingsState
        : (isPlainObject(input) && isPlainObject(input.flows) && isPlainObject(input.services) ? input : {});
      const activeFlowId = normalizeFlowId(
        input?.activeFlowId
        ?? nested?.activeFlowId
        ?? options?.activeFlowId
        ?? defaults.activeFlowId,
        defaults.activeFlowId
      );
      const normalized = {
        schemaVersion: Number(input?.settingsSchemaVersion || nested?.schemaVersion || defaults.schemaVersion) || defaults.schemaVersion,
        activeFlowId,
        services: {
          email: {
            provider: String(
              nested?.services?.email?.provider
              ?? input?.mailProvider
              ?? defaults.services.email.provider
            ).trim() || defaults.services.email.provider,
          },
          proxy: {
            enabled: Boolean(
              nested?.services?.proxy?.enabled
              ?? input?.ipProxyEnabled
              ?? defaults.services.proxy.enabled
            ),
            provider: String(
              nested?.services?.proxy?.provider
              ?? input?.ipProxyService
              ?? defaults.services.proxy.provider
            ).trim() || defaults.services.proxy.provider,
            mode: String(
              nested?.services?.proxy?.mode
              ?? input?.ipProxyMode
              ?? defaults.services.proxy.mode
            ).trim() || defaults.services.proxy.mode,
          },
          account: {
            customPassword: String(
              input?.customPassword
              ?? nested?.services?.account?.customPassword
              ?? defaults.services.account.customPassword
            ).trim(),
          },
          phone: {
            provider: String(
              nested?.services?.phone?.provider
              ?? input?.phoneSmsProvider
              ?? defaults.services.phone.provider
            ).trim() || defaults.services.phone.provider,
            providerOrder: cloneValue(
              nested?.services?.phone?.providerOrder
              ?? input?.phoneSmsProviderOrder
              ?? defaults.services.phone.providerOrder
            ),
            verificationResendCount: Number(
              nested?.services?.phone?.verificationResendCount
              ?? input?.verificationResendCount
              ?? defaults.services.phone.verificationResendCount
            ) || defaults.services.phone.verificationResendCount,
            phoneVerificationReplacementLimit: Number(
              nested?.services?.phone?.phoneVerificationReplacementLimit
              ?? input?.phoneVerificationReplacementLimit
              ?? defaults.services.phone.phoneVerificationReplacementLimit
            ) || defaults.services.phone.phoneVerificationReplacementLimit,
            phoneCodeWaitSeconds: Number(
              nested?.services?.phone?.phoneCodeWaitSeconds
              ?? input?.phoneCodeWaitSeconds
              ?? defaults.services.phone.phoneCodeWaitSeconds
            ) || defaults.services.phone.phoneCodeWaitSeconds,
            phoneCodeTimeoutWindows: Number(
              nested?.services?.phone?.phoneCodeTimeoutWindows
              ?? input?.phoneCodeTimeoutWindows
              ?? defaults.services.phone.phoneCodeTimeoutWindows
            ) || defaults.services.phone.phoneCodeTimeoutWindows,
            phoneCodePollIntervalSeconds: Number(
              nested?.services?.phone?.phoneCodePollIntervalSeconds
              ?? input?.phoneCodePollIntervalSeconds
              ?? defaults.services.phone.phoneCodePollIntervalSeconds
            ) || defaults.services.phone.phoneCodePollIntervalSeconds,
            phoneCodePollMaxRounds: Number(
              nested?.services?.phone?.phoneCodePollMaxRounds
              ?? input?.phoneCodePollMaxRounds
              ?? defaults.services.phone.phoneCodePollMaxRounds
            ) || defaults.services.phone.phoneCodePollMaxRounds,
            phoneSmsReuseEnabled: Boolean(
              nested?.services?.phone?.phoneSmsReuseEnabled
              ?? input?.phoneSmsReuseEnabled
              ?? defaults.services.phone.phoneSmsReuseEnabled
            ),
            freePhoneReuseEnabled: Boolean(
              nested?.services?.phone?.freePhoneReuseEnabled
              ?? input?.freePhoneReuseEnabled
              ?? defaults.services.phone.freePhoneReuseEnabled
            ),
            freePhoneReuseAutoEnabled: Boolean(
              nested?.services?.phone?.freePhoneReuseAutoEnabled
              ?? input?.freePhoneReuseAutoEnabled
              ?? defaults.services.phone.freePhoneReuseAutoEnabled
            ),
            phonePreferredActivation: cloneValue(
              nested?.services?.phone?.phonePreferredActivation
              ?? input?.phonePreferredActivation
              ?? defaults.services.phone.phonePreferredActivation
            ),
            heroSms: {
              apiKey: String(
                nested?.services?.phone?.heroSms?.apiKey
                ?? input?.heroSmsApiKey
                ?? defaults.services.phone.heroSms.apiKey
              ),
              reuseEnabled: Boolean(
                nested?.services?.phone?.heroSms?.reuseEnabled
                ?? input?.heroSmsReuseEnabled
                ?? defaults.services.phone.heroSms.reuseEnabled
              ),
              acquirePriority: String(
                nested?.services?.phone?.heroSms?.acquirePriority
                ?? input?.heroSmsAcquirePriority
                ?? defaults.services.phone.heroSms.acquirePriority
              ).trim() || defaults.services.phone.heroSms.acquirePriority,
              minPrice: String(
                nested?.services?.phone?.heroSms?.minPrice
                ?? input?.heroSmsMinPrice
                ?? defaults.services.phone.heroSms.minPrice
              ).trim(),
              maxPrice: String(
                nested?.services?.phone?.heroSms?.maxPrice
                ?? input?.heroSmsMaxPrice
                ?? defaults.services.phone.heroSms.maxPrice
              ).trim(),
              preferredPrice: String(
                nested?.services?.phone?.heroSms?.preferredPrice
                ?? input?.heroSmsPreferredPrice
                ?? defaults.services.phone.heroSms.preferredPrice
              ).trim(),
              countryId: nested?.services?.phone?.heroSms?.countryId
                ?? input?.heroSmsCountryId
                ?? defaults.services.phone.heroSms.countryId,
              countryLabel: String(
                nested?.services?.phone?.heroSms?.countryLabel
                ?? input?.heroSmsCountryLabel
                ?? defaults.services.phone.heroSms.countryLabel
              ).trim() || defaults.services.phone.heroSms.countryLabel,
              countryFallback: cloneValue(
                nested?.services?.phone?.heroSms?.countryFallback
                ?? input?.heroSmsCountryFallback
                ?? defaults.services.phone.heroSms.countryFallback
              ),
            },
            fiveSim: {
              apiKey: String(
                nested?.services?.phone?.fiveSim?.apiKey
                ?? input?.fiveSimApiKey
                ?? defaults.services.phone.fiveSim.apiKey
              ),
              product: String(
                nested?.services?.phone?.fiveSim?.product
                ?? input?.fiveSimProduct
                ?? defaults.services.phone.fiveSim.product
              ).trim() || defaults.services.phone.fiveSim.product,
              countryId: String(
                nested?.services?.phone?.fiveSim?.countryId
                ?? input?.fiveSimCountryId
                ?? defaults.services.phone.fiveSim.countryId
              ).trim() || defaults.services.phone.fiveSim.countryId,
              countryLabel: String(
                nested?.services?.phone?.fiveSim?.countryLabel
                ?? input?.fiveSimCountryLabel
                ?? defaults.services.phone.fiveSim.countryLabel
              ).trim() || defaults.services.phone.fiveSim.countryLabel,
              countryFallback: cloneValue(
                nested?.services?.phone?.fiveSim?.countryFallback
                ?? input?.fiveSimCountryFallback
                ?? defaults.services.phone.fiveSim.countryFallback
              ),
              countryOrder: cloneValue(
                nested?.services?.phone?.fiveSim?.countryOrder
                ?? input?.fiveSimCountryOrder
                ?? defaults.services.phone.fiveSim.countryOrder
              ),
              minPrice: String(
                nested?.services?.phone?.fiveSim?.minPrice
                ?? input?.fiveSimMinPrice
                ?? defaults.services.phone.fiveSim.minPrice
              ).trim(),
              maxPrice: String(
                nested?.services?.phone?.fiveSim?.maxPrice
                ?? input?.fiveSimMaxPrice
                ?? defaults.services.phone.fiveSim.maxPrice
              ).trim(),
              operator: String(
                nested?.services?.phone?.fiveSim?.operator
                ?? input?.fiveSimOperator
                ?? defaults.services.phone.fiveSim.operator
              ).trim() || defaults.services.phone.fiveSim.operator,
            },
            nexSms: {
              apiKey: String(
                nested?.services?.phone?.nexSms?.apiKey
                ?? input?.nexSmsApiKey
                ?? defaults.services.phone.nexSms.apiKey
              ),
              countryOrder: cloneValue(
                nested?.services?.phone?.nexSms?.countryOrder
                ?? input?.nexSmsCountryOrder
                ?? defaults.services.phone.nexSms.countryOrder
              ),
              serviceCode: String(
                nested?.services?.phone?.nexSms?.serviceCode
                ?? input?.nexSmsServiceCode
                ?? defaults.services.phone.nexSms.serviceCode
              ).trim() || defaults.services.phone.nexSms.serviceCode,
            },
          },
        },
        flows: {},
      };

      getCanonicalFlowIds().forEach((flowId) => {
        normalized.flows[flowId] = normalizeFlowSettings(flowId, {
          ...input,
          activeFlowId,
        }, nested, defaults);
      });
      if (normalized.flows.openai) {
        normalized.flows.openai = normalizeOpenAiSettings(input, nested, defaults, normalized.flows.openai);
      }
      if (normalized.flows.kiro) {
        normalized.flows.kiro = normalizeKiroSettings(input, defaults, normalized.flows.kiro);
      }
      return normalized;
    }

    function mergeSettingsState(baseValue = {}, patchValue = {}) {
      const baseSettingsState = normalizeSettingsState(baseValue);
      const patchSettingsState = normalizeSettingsState({
        settingsState: patchValue,
        activeFlowId: patchValue?.activeFlowId ?? baseSettingsState.activeFlowId,
      });

      return normalizeSettingsState({
        settingsState: mergePlainObjects(baseSettingsState, patchSettingsState),
      });
    }

    function getFlowSettings(settingsState = {}, flowId) {
      const normalizedState = normalizeSettingsState(settingsState);
      const normalizedFlowId = normalizeFlowId(flowId, normalizedState.activeFlowId);
      return cloneValue(normalizedState?.flows?.[normalizedFlowId] || {});
    }

    function getSelectedTargetId(settingsState = {}, flowId) {
      const normalizedState = normalizeSettingsState(settingsState);
      const normalizedFlowId = normalizeFlowId(flowId, normalizedState.activeFlowId);
      const flowSettings = normalizedState?.flows?.[normalizedFlowId] || {};
      return normalizeTargetId(
        normalizedFlowId,
        flowSettings?.selectedTargetId,
        getDefaultTargetId(normalizedFlowId)
      );
    }

    function getTargetSettings(settingsState = {}, flowId, targetId = '') {
      const normalizedState = normalizeSettingsState(settingsState);
      const normalizedFlowId = normalizeFlowId(flowId, normalizedState.activeFlowId);
      const resolvedTargetId = normalizeTargetId(
        normalizedFlowId,
        targetId || getSelectedTargetId(normalizedState, normalizedFlowId),
        getSelectedTargetId(normalizedState, normalizedFlowId)
      );
      return cloneValue(normalizedState?.flows?.[normalizedFlowId]?.targets?.[resolvedTargetId] || {});
    }

    function buildStepExecutionRangeByFlow(settingsState = {}) {
      const normalizedState = normalizeSettingsState(settingsState);
      const defaults = buildDefaultSettingsState();
      return Object.fromEntries(
        Object.entries(normalizedState.flows || {}).map(([flowId, flowSettings]) => [
          flowId,
          normalizeStepExecutionRangeEntry(
            flowSettings?.autoRun?.stepExecutionRange,
            defaults.flows?.[flowId]?.autoRun?.stepExecutionRange || getDefaultStepExecutionRange(flowId)
          ),
        ])
      );
    }

    function buildSettingsView(settingsState = {}, baseInput = {}) {
      const normalizedState = normalizeSettingsState(settingsState);
      const next = {
        ...(isPlainObject(baseInput) ? cloneValue(baseInput) : {}),
      };
      const openaiState = normalizedState.flows.openai || buildDefaultFlowSettings('openai');
      const kiroState = normalizedState.flows.kiro || buildDefaultFlowSettings('kiro');
      const grokState = normalizedState.flows.grok || buildDefaultFlowSettings('grok');
      next.activeFlowId = normalizedState.activeFlowId;
      next.targetId = getSelectedTargetId(normalizedState, normalizedState.activeFlowId);
      next.vpsUrl = openaiState.targets.cpa?.vpsUrl || '';
      next.vpsPassword = openaiState.targets.cpa?.vpsPassword || '';
      next.localCpaStep9Mode = openaiState.targets.cpa?.localCpaStep9Mode || 'submit';
      next.sub2apiUrl = openaiState.targets.sub2api?.sub2apiUrl || '';
      next.sub2apiEmail = openaiState.targets.sub2api?.sub2apiEmail || '';
      next.sub2apiPassword = openaiState.targets.sub2api?.sub2apiPassword || '';
      next.sub2apiGroupName = openaiState.targets.sub2api?.sub2apiGroupName || 'codex';
      next.sub2apiGroupNames = cloneValue(openaiState.targets.sub2api?.sub2apiGroupNames || ['codex', 'openai-plus']);
      next.sub2apiAccountPriority = openaiState.targets.sub2api?.sub2apiAccountPriority || 1;
      next.sub2apiDefaultProxyName = openaiState.targets.sub2api?.sub2apiDefaultProxyName || '';
      next.sub2apiReauthMode = Boolean(openaiState.targets.sub2api?.sub2apiReauthMode);
      next.sub2apiReauthRestoreAccountEnabled = Boolean(openaiState.targets.sub2api?.sub2apiReauthRestoreAccountEnabled);
      next.sub2apiReauthEmailSuffix = String(openaiState.targets.sub2api?.sub2apiReauthEmailSuffix || '').trim().toLowerCase();
      next.sub2apiReauthSkipEmails = cloneValue(openaiState.targets.sub2api?.sub2apiReauthSkipEmails || []);
      next.codex2apiUrl = openaiState.targets.codex2api?.codex2apiUrl || '';
      next.codex2apiAdminKey = openaiState.targets.codex2api?.codex2apiAdminKey || '';
      next.customPassword = normalizedState.services.account.customPassword;
      next.signupMethod = openaiState.signup?.signupMethod || 'email';
      next.phoneVerificationEnabled = Boolean(openaiState.signup?.phoneVerificationEnabled);
      next.phoneSignupReloginAfterBindEmailEnabled = Boolean(openaiState.signup?.phoneSignupReloginAfterBindEmailEnabled);
      next.phoneSmsProvider = normalizedState.services.phone?.provider || 'hero-sms';
      next.phoneSmsProviderOrder = cloneValue(normalizedState.services.phone?.providerOrder || []);
      next.verificationResendCount = normalizedState.services.phone?.verificationResendCount ?? 4;
      next.phoneVerificationReplacementLimit = normalizedState.services.phone?.phoneVerificationReplacementLimit ?? 3;
      next.phoneCodeWaitSeconds = normalizedState.services.phone?.phoneCodeWaitSeconds ?? 60;
      next.phoneCodeTimeoutWindows = normalizedState.services.phone?.phoneCodeTimeoutWindows ?? 2;
      next.phoneCodePollIntervalSeconds = normalizedState.services.phone?.phoneCodePollIntervalSeconds ?? 5;
      next.phoneCodePollMaxRounds = normalizedState.services.phone?.phoneCodePollMaxRounds ?? 4;
      next.phoneSmsReuseEnabled = Boolean(normalizedState.services.phone?.phoneSmsReuseEnabled);
      next.freePhoneReuseEnabled = Boolean(normalizedState.services.phone?.freePhoneReuseEnabled);
      next.freePhoneReuseAutoEnabled = Boolean(normalizedState.services.phone?.freePhoneReuseAutoEnabled);
      next.phonePreferredActivation = cloneValue(normalizedState.services.phone?.phonePreferredActivation);
      next.heroSmsApiKey = normalizedState.services.phone?.heroSms?.apiKey || '';
      next.heroSmsReuseEnabled = Boolean(normalizedState.services.phone?.heroSms?.reuseEnabled);
      next.heroSmsAcquirePriority = normalizedState.services.phone?.heroSms?.acquirePriority || 'country';
      next.heroSmsMinPrice = normalizedState.services.phone?.heroSms?.minPrice || '';
      next.heroSmsMaxPrice = normalizedState.services.phone?.heroSms?.maxPrice || '';
      next.heroSmsPreferredPrice = normalizedState.services.phone?.heroSms?.preferredPrice || '';
      next.heroSmsCountryId = normalizedState.services.phone?.heroSms?.countryId ?? 52;
      next.heroSmsCountryLabel = normalizedState.services.phone?.heroSms?.countryLabel || '泰国 (Thailand)';
      next.heroSmsCountryFallback = cloneValue(normalizedState.services.phone?.heroSms?.countryFallback || []);
      next.fiveSimApiKey = normalizedState.services.phone?.fiveSim?.apiKey || '';
      next.fiveSimProduct = normalizedState.services.phone?.fiveSim?.product || 'openai';
      next.fiveSimCountryId = normalizedState.services.phone?.fiveSim?.countryId || 'thailand';
      next.fiveSimCountryLabel = normalizedState.services.phone?.fiveSim?.countryLabel || '泰国 (Thailand)';
      next.fiveSimCountryFallback = cloneValue(normalizedState.services.phone?.fiveSim?.countryFallback || []);
      next.fiveSimCountryOrder = cloneValue(normalizedState.services.phone?.fiveSim?.countryOrder || []);
      next.fiveSimMinPrice = normalizedState.services.phone?.fiveSim?.minPrice || '';
      next.fiveSimMaxPrice = normalizedState.services.phone?.fiveSim?.maxPrice || '';
      next.fiveSimOperator = normalizedState.services.phone?.fiveSim?.operator || 'any';
      next.nexSmsApiKey = normalizedState.services.phone?.nexSms?.apiKey || '';
      next.nexSmsCountryOrder = cloneValue(normalizedState.services.phone?.nexSms?.countryOrder || []);
      next.nexSmsServiceCode = normalizedState.services.phone?.nexSms?.serviceCode || 'ot';
      next.plusModeEnabled = Boolean(openaiState.plus?.plusModeEnabled);
      next.plusPaymentMethod = openaiState.plus?.plusPaymentMethod || 'paypal-hosted';
      next.plusAccountAccessStrategy = openaiState.plus?.plusAccountAccessStrategy || 'oauth';
      next.hostedCheckoutVerificationUrl = openaiState.plus?.hostedCheckoutVerificationUrl || '';
      next.hostedCheckoutPhoneNumber = openaiState.plus?.hostedCheckoutPhoneNumber || '';
      next.plusHostedCheckoutOauthDelaySeconds = openaiState.plus?.plusHostedCheckoutOauthDelaySeconds ?? 3;
      next.mailProvider = normalizedState.services.email.provider;
      next.ipProxyEnabled = normalizedState.services.proxy.enabled;
      next.ipProxyService = normalizedState.services.proxy.provider;
      next.ipProxyMode = normalizedState.services.proxy.mode;
      next.kiroRsUrl = kiroState.targets['kiro-rs']?.baseUrl || '';
      next.kiroRsKey = kiroState.targets['kiro-rs']?.apiKey || '';
      next.grokWebchat2ApiUrl = grokState.targets.webchat2api?.baseUrl || '';
      next.grokWebchat2ApiAdminKey = grokState.targets.webchat2api?.apiKey || '';
      next.stepExecutionRangeByFlow = buildStepExecutionRangeByFlow(normalizedState);
      next.settingsSchemaVersion = normalizedState.schemaVersion;
      next.settingsState = cloneValue(normalizedState);
      return next;
    }

    function getFlowInputState(settingsState = {}, flowId) {
      const normalizedState = normalizeSettingsState(settingsState);
      const normalizedFlowId = normalizeFlowId(flowId, normalizedState.activeFlowId);
      const targetId = getSelectedTargetId(normalizedState, normalizedFlowId);
      if (normalizedFlowId === 'kiro') {
        const targetSettings = getTargetSettings(normalizedState, normalizedFlowId, targetId);
        return {
          activeFlowId: normalizedFlowId,
          targetId,
          kiroRsUrl: targetSettings.baseUrl || '',
          kiroRsKey: targetSettings.apiKey || '',
        };
      }
      return {
        activeFlowId: normalizedFlowId,
        targetId,
      };
    }

    return {
      buildDefaultSettingsState,
      buildSettingsView,
      buildStepExecutionRangeByFlow,
      getFlowInputState,
      getFlowSettings,
      getSelectedTargetId,
      getTargetSettings,
      mergeSettingsState,
      normalizeSettingsState,
    };
  }

  return {
    createSettingsSchema,
  };
});
