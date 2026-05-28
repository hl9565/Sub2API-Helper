(function attachBackgroundKiroState(root, factory) {
  root.MultiPageBackgroundKiroState = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundKiroStateModule() {
  const DEFAULT_TARGET_ID = 'kiro-rs';
  const DEFAULT_REGION = 'us-east-1';
  const FLAT_FIELD_DEFINITIONS = Object.freeze([]);
  const FLAT_FIELD_KEYS = Object.freeze([]);

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

  function deepMerge(baseValue, patchValue) {
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
      next[key] = deepMerge(baseObject[key], value);
    });
    return next;
  }

  function normalizeString(value = '', fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
  }

  function normalizeInteger(value, fallback = 0) {
    const numeric = Math.floor(Number(value));
    return Number.isInteger(numeric) ? numeric : fallback;
  }

  function normalizeNullableInteger(value, fallback = null) {
    if (value === null || value === undefined || value === '') {
      return fallback;
    }
    const numeric = Math.floor(Number(value));
    return Number.isInteger(numeric) ? numeric : fallback;
  }

  function normalizeNullableIdentifier(value, fallback = null) {
    if (value === null || value === undefined || value === '') {
      return fallback;
    }
    if (typeof value === 'number') {
      const numeric = Math.floor(value);
      return Number.isInteger(numeric) ? numeric : fallback;
    }
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      return fallback;
    }
    const numeric = Math.floor(Number(normalized));
    return Number.isInteger(numeric) && String(numeric) === normalized
      ? numeric
      : normalized;
  }

  function normalizeBoolean(value, fallback = false) {
    if (value === true || value === false) {
      return value;
    }
    return fallback;
  }

  function buildDefaultRuntimeState() {
    return {
      session: {
        currentStage: '',
        registerTabId: null,
        desktopTabId: null,
        startedAt: 0,
        pageState: '',
        pageUrl: '',
        lastError: '',
        lastWarning: '',
      },
      register: {
        email: '',
        fullName: '',
        verificationRequestedAt: 0,
        loginUrl: '',
        status: '',
        completedAt: 0,
      },
      webAuth: {
        status: '',
        completedAt: 0,
        hasAccessToken: false,
        hasSessionToken: false,
      },
      desktopAuth: {
        region: DEFAULT_REGION,
        clientId: '',
        clientSecret: '',
        clientIdHash: '',
        state: '',
        codeVerifier: '',
        codeChallenge: '',
        redirectUri: '',
        redirectPort: 0,
        authorizeUrl: '',
        authorizationCode: '',
        accessToken: '',
        refreshToken: '',
        status: '',
        authorizedAt: 0,
        otpRequestedAt: 0,
        tokenSource: 'desktop_authorization_code_pkce',
      },
      upload: {
        targetId: DEFAULT_TARGET_ID,
        status: '',
        error: '',
        credentialId: null,
        lastMessage: '',
        lastUploadedAt: 0,
      },
    };
  }

  function normalizeRuntimeState(runtimeState = {}) {
    const merged = deepMerge(buildDefaultRuntimeState(), runtimeState);
    return {
      session: {
        currentStage: normalizeString(merged.session?.currentStage),
        registerTabId: normalizeNullableInteger(merged.session?.registerTabId),
        desktopTabId: normalizeNullableInteger(merged.session?.desktopTabId),
        startedAt: Math.max(0, normalizeInteger(merged.session?.startedAt)),
        pageState: normalizeString(merged.session?.pageState),
        pageUrl: normalizeString(merged.session?.pageUrl),
        lastError: normalizeString(merged.session?.lastError),
        lastWarning: normalizeString(merged.session?.lastWarning),
      },
      register: {
        email: normalizeString(merged.register?.email),
        fullName: normalizeString(merged.register?.fullName),
        verificationRequestedAt: Math.max(0, normalizeInteger(merged.register?.verificationRequestedAt)),
        loginUrl: normalizeString(merged.register?.loginUrl),
        status: normalizeString(merged.register?.status),
        completedAt: Math.max(0, normalizeInteger(merged.register?.completedAt)),
      },
      webAuth: {
        status: normalizeString(merged.webAuth?.status),
        completedAt: Math.max(0, normalizeInteger(merged.webAuth?.completedAt)),
        hasAccessToken: normalizeBoolean(merged.webAuth?.hasAccessToken),
        hasSessionToken: normalizeBoolean(merged.webAuth?.hasSessionToken),
      },
      desktopAuth: {
        region: normalizeString(merged.desktopAuth?.region, DEFAULT_REGION),
        clientId: normalizeString(merged.desktopAuth?.clientId),
        clientSecret: normalizeString(merged.desktopAuth?.clientSecret),
        clientIdHash: normalizeString(merged.desktopAuth?.clientIdHash),
        state: normalizeString(merged.desktopAuth?.state),
        codeVerifier: normalizeString(merged.desktopAuth?.codeVerifier),
        codeChallenge: normalizeString(merged.desktopAuth?.codeChallenge),
        redirectUri: normalizeString(merged.desktopAuth?.redirectUri),
        redirectPort: Math.max(0, normalizeInteger(merged.desktopAuth?.redirectPort)),
        authorizeUrl: normalizeString(merged.desktopAuth?.authorizeUrl),
        authorizationCode: normalizeString(merged.desktopAuth?.authorizationCode),
        accessToken: normalizeString(merged.desktopAuth?.accessToken),
        refreshToken: normalizeString(merged.desktopAuth?.refreshToken),
        status: normalizeString(merged.desktopAuth?.status),
        authorizedAt: Math.max(0, normalizeInteger(merged.desktopAuth?.authorizedAt)),
        otpRequestedAt: Math.max(0, normalizeInteger(merged.desktopAuth?.otpRequestedAt)),
        tokenSource: normalizeString(
          merged.desktopAuth?.tokenSource,
          'desktop_authorization_code_pkce'
        ),
      },
      upload: {
        targetId: normalizeString(merged.upload?.targetId, DEFAULT_TARGET_ID),
        status: normalizeString(merged.upload?.status),
        error: normalizeString(merged.upload?.error),
        credentialId: normalizeNullableIdentifier(merged.upload?.credentialId),
        lastMessage: normalizeString(merged.upload?.lastMessage),
        lastUploadedAt: Math.max(0, normalizeInteger(merged.upload?.lastUploadedAt)),
      },
    };
  }

  function buildCanonicalRuntimeStatePatch(state = {}, runtimeState = {}) {
    const normalizedRuntimeState = normalizeRuntimeState(runtimeState);
    const baseRuntimeState = isPlainObject(state?.runtimeState)
      ? cloneValue(state.runtimeState)
      : {};
    delete baseRuntimeState.flowId;
    delete baseRuntimeState.runId;
    delete baseRuntimeState.activeFlowId;
    delete baseRuntimeState.activeRunId;
    delete baseRuntimeState.currentNodeId;
    delete baseRuntimeState.nodeStatuses;
    if (isPlainObject(baseRuntimeState.sharedState)) {
      delete baseRuntimeState.sharedState.tabRegistry;
      delete baseRuntimeState.sharedState.sourceLastUrls;
      delete baseRuntimeState.sharedState.flowStartTime;
    }
    const baseFlowState = isPlainObject(baseRuntimeState.flowState)
      ? cloneValue(baseRuntimeState.flowState)
      : {};
    return {
      ...baseRuntimeState,
      flowState: {
        ...baseFlowState,
        kiro: normalizedRuntimeState,
      },
    };
  }

  function buildRuntimeStateView(runtimeState = {}) {
    const normalizedFlowState = isPlainObject(runtimeState?.flowState)
      ? runtimeState.flowState
      : {};
    return {
      flowState: cloneValue(normalizedFlowState),
      flows: cloneValue(normalizedFlowState),
    };
  }

  function buildRuntimeStatePatch(currentState = {}, patch = {}) {
    if (!isPlainObject(patch)) {
      return {};
    }
    const nextRuntimeState = normalizeRuntimeState(
      deepMerge(ensureRuntimeState(currentState), patch)
    );
    return {
      runtimeState: buildCanonicalRuntimeStatePatch(currentState, nextRuntimeState),
    };
  }

  function ensureRuntimeState(state = {}) {
    const runtimeFlowState = isPlainObject(state?.runtimeState?.flowState)
      ? state.runtimeState.flowState
      : {};
    if (isPlainObject(runtimeFlowState.kiro)) {
      return normalizeRuntimeState(runtimeFlowState.kiro);
    }
    if (isPlainObject(state?.flowState?.kiro)) {
      return normalizeRuntimeState(state.flowState.kiro);
    }
    return buildDefaultRuntimeState();
  }

  function projectRuntimeFields() {
    return {};
  }

  function buildStateView(state = {}) {
    const nextRuntimeState = ensureRuntimeState(state);
    const runtimeState = buildCanonicalRuntimeStatePatch(state, nextRuntimeState);
    return {
      ...state,
      runtimeState,
      ...buildRuntimeStateView(runtimeState),
    };
  }

  function buildSessionStatePatch(currentState = {}, updates = {}) {
    const runtimePatch = isPlainObject(updates?.runtimeState?.flowState?.kiro)
      ? updates.runtimeState.flowState.kiro
      : (isPlainObject(updates?.flowState?.kiro)
        ? updates.flowState.kiro
        : null);
    if (!runtimePatch) {
      return {};
    }

    return buildRuntimeStatePatch(currentState, runtimePatch);
  }

  function buildRuntimeResetPatch(currentState = {}, patch = {}) {
    return buildRuntimeStatePatch(currentState, patch);
  }

  function buildStartRegisterResetPatch(currentState = {}) {
    const currentRuntimeState = ensureRuntimeState(currentState);
    const nextRuntimeState = buildDefaultRuntimeState();
    nextRuntimeState.upload.targetId = currentRuntimeState.upload?.targetId || DEFAULT_TARGET_ID;
    return {
      runtimeState: buildCanonicalRuntimeStatePatch(currentState, nextRuntimeState),
    };
  }

  function buildRegisterOnlyResetPatch(currentState = {}, registerPatch = {}) {
    const currentRuntimeState = ensureRuntimeState(currentState);
    const nextRuntimeState = normalizeRuntimeState({
      ...buildDefaultRuntimeState(),
      session: {
        ...currentRuntimeState.session,
        currentStage: 'register',
        desktopTabId: null,
        pageState: '',
        pageUrl: '',
        lastError: '',
        lastWarning: '',
      },
      register: {
        ...currentRuntimeState.register,
        completedAt: 0,
        status: '',
        ...registerPatch,
      },
      upload: {
        ...buildDefaultRuntimeState().upload,
        targetId: currentRuntimeState.upload?.targetId || DEFAULT_TARGET_ID,
      },
    });
    return {
      runtimeState: buildCanonicalRuntimeStatePatch(currentState, nextRuntimeState),
    };
  }

  function buildDesktopResetPatch(currentState = {}) {
    const currentRuntimeState = ensureRuntimeState(currentState);
    const nextRuntimeState = normalizeRuntimeState({
      ...currentRuntimeState,
      session: {
        ...currentRuntimeState.session,
        currentStage: 'desktop-authorize',
        desktopTabId: null,
        pageState: '',
        pageUrl: '',
        lastError: '',
        lastWarning: '',
      },
      desktopAuth: buildDefaultRuntimeState().desktopAuth,
      upload: {
        ...buildDefaultRuntimeState().upload,
        targetId: currentRuntimeState.upload?.targetId || DEFAULT_TARGET_ID,
      },
    });
    return {
      runtimeState: buildCanonicalRuntimeStatePatch(currentState, nextRuntimeState),
    };
  }

  function buildUploadResetPatch(currentState = {}) {
    const currentRuntimeState = ensureRuntimeState(currentState);
    const nextRuntimeState = normalizeRuntimeState({
      ...currentRuntimeState,
      upload: {
        ...buildDefaultRuntimeState().upload,
        targetId: currentRuntimeState.upload?.targetId || DEFAULT_TARGET_ID,
      },
    });
    return {
      runtimeState: buildCanonicalRuntimeStatePatch(currentState, nextRuntimeState),
    };
  }

  function buildDownstreamResetPatch(stepKey = '', currentState = {}) {
    switch (normalizeString(stepKey)) {
      case 'kiro-open-register-page':
        return buildStartRegisterResetPatch(currentState);
      case 'kiro-submit-email':
        return buildRegisterOnlyResetPatch(currentState, {
          email: '',
          fullName: '',
          verificationRequestedAt: 0,
        });
      case 'kiro-submit-name':
        return buildRegisterOnlyResetPatch(currentState, {
          fullName: '',
          verificationRequestedAt: 0,
        });
      case 'kiro-submit-verification-code':
        return buildRegisterOnlyResetPatch(currentState, {});
      case 'kiro-submit-password':
        return buildRegisterOnlyResetPatch(currentState, {});
      case 'kiro-complete-register-consent':
        return buildDesktopResetPatch(currentState);
      case 'kiro-start-desktop-authorize':
        return buildDesktopResetPatch(currentState);
      case 'kiro-complete-desktop-authorize':
        return buildUploadResetPatch(currentState);
      case 'kiro-upload-credential':
        return buildUploadResetPatch(currentState);
      default:
        return {};
    }
  }

  function applyNodeCompletionPayload(currentState = {}, payload = {}) {
    return buildSessionStatePatch(currentState, payload);
  }

  function buildFreshKeepState(currentState = {}) {
    const currentRuntimeState = ensureRuntimeState(currentState);
    const nextRuntimeState = buildDefaultRuntimeState();
    nextRuntimeState.upload.targetId = currentRuntimeState.upload?.targetId || DEFAULT_TARGET_ID;
    return {
      runtimeState: buildCanonicalRuntimeStatePatch(currentState, nextRuntimeState),
      ...(Object.prototype.hasOwnProperty.call(currentState, 'targetId')
        ? { targetId: normalizeString(currentState.targetId, DEFAULT_TARGET_ID).toLowerCase() }
        : {}),
    };
  }

  return {
    DEFAULT_REGION,
    DEFAULT_TARGET_ID,
    FLAT_FIELD_DEFINITIONS,
    FLAT_FIELD_KEYS,
    applyNodeCompletionPayload,
    buildDefaultRuntimeState,
    buildDownstreamResetPatch,
    buildFreshKeepState,
    buildRuntimeStatePatch,
    buildSessionStatePatch,
    buildStateView,
    ensureRuntimeState,
    projectRuntimeFields,
  };
});
