(function attachHeaderCore(globalScope) {
  "use strict";

  const STORAGE_KEY = "headerManagerState";
  const RULE_ID = 1;
  const PROFILE_NAME_LIMIT = 32;
  const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
  const ALLOWED_OPERATIONS = new Set(["set", "append", "remove"]);
  const APPENDABLE_REQUEST_HEADERS = new Set([
    "accept",
    "accept-encoding",
    "accept-language",
    "access-control-request-headers",
    "cache-control",
    "connection",
    "content-language",
    "cookie",
    "forwarded",
    "if-match",
    "if-none-match",
    "keep-alive",
    "range",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "user-agent",
    "via",
    "want-digest",
    "x-forwarded-for"
  ]);
  const REQUEST_RESOURCE_TYPES = [
    "main_frame",
    "sub_frame",
    "stylesheet",
    "script",
    "image",
    "font",
    "object",
    "xmlhttprequest",
    "ping",
    "csp_report",
    "media",
    "websocket",
    "webtransport",
    "webbundle",
    "other"
  ];

  function createId(prefix) {
    if (globalScope.crypto && typeof globalScope.crypto.randomUUID === "function") {
      return `${prefix}-${globalScope.crypto.randomUUID()}`;
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function createHeader(overrides = {}) {
    return {
      id: overrides.id || createId("header"),
      name: typeof overrides.name === "string" ? overrides.name : "",
      value: typeof overrides.value === "string" ? overrides.value : "",
      operation: ALLOWED_OPERATIONS.has(overrides.operation) ? overrides.operation : "set",
      enabled: overrides.enabled !== false
    };
  }

  function createProfile(name = "New profile", overrides = {}) {
    const safeName = String(name).trim().slice(0, PROFILE_NAME_LIMIT) || "New profile";

    return {
      id: overrides.id || createId("profile"),
      name: safeName,
      headers: Array.isArray(overrides.headers)
        ? overrides.headers.map((header) => createHeader(header))
        : [createHeader()]
    };
  }

  function createDefaultState() {
    const profile = createProfile("Default profile");

    return {
      version: 2,
      enabled: true,
      activeProfileIds: [profile.id],
      profiles: [profile]
    };
  }

  function normalizeState(input) {
    if (!input || typeof input !== "object") {
      return createDefaultState();
    }

    const profiles = Array.isArray(input.profiles)
      ? input.profiles.map((profile, index) => createProfile(
        typeof profile?.name === "string" ? profile.name : `Profile ${index + 1}`,
        profile || {}
      ))
      : [];

    if (profiles.length === 0) {
      profiles.push(createProfile("Default profile"));
    }

    let requestedActiveProfileIds;
    if (Array.isArray(input.activeProfileIds)) {
      requestedActiveProfileIds = input.activeProfileIds;
    } else if (typeof input.activeProfileId === "string") {
      requestedActiveProfileIds = [input.activeProfileId];
    } else {
      requestedActiveProfileIds = [profiles[0].id];
    }

    const existingProfileIds = new Set(profiles.map((profile) => profile.id));
    const activeProfileIds = [...new Set(requestedActiveProfileIds)]
      .filter((profileId) => existingProfileIds.has(profileId));

    return {
      version: 2,
      enabled: input.enabled !== false,
      activeProfileIds,
      profiles
    };
  }

  function validateHeader(header) {
    const name = typeof header?.name === "string" ? header.name.trim() : "";
    const value = typeof header?.value === "string" ? header.value : "";
    const operation = ALLOWED_OPERATIONS.has(header?.operation) ? header.operation : "set";

    if (!name) {
      return { valid: false, reason: "Enter a header name." };
    }

    if (!HEADER_NAME_PATTERN.test(name)) {
      return { valid: false, reason: "Use a valid HTTP header name." };
    }

    if (/\r|\n/.test(value)) {
      return { valid: false, reason: "Header values cannot contain line breaks." };
    }

    const nativeAppend = operation === "append"
      && APPENDABLE_REQUEST_HEADERS.has(name.toLowerCase());

    return {
      valid: true,
      name: nativeAppend ? name.toLowerCase() : name,
      value,
      operation,
      nativeAppend
    };
  }

  function combineHeaderValues(existingValue, nextValue, headerName) {
    if (!existingValue) {
      return nextValue;
    }
    if (!nextValue) {
      return existingValue;
    }

    const separator = headerName.toLowerCase() === "cookie" ? "; " : ", ";
    return `${existingValue}${separator}${nextValue}`;
  }

  function buildDynamicRule(input) {
    const state = normalizeState(input);

    if (!state.enabled) {
      return null;
    }

    if (state.activeProfileIds.length === 0) {
      return null;
    }

    const activeProfileIds = new Set(state.activeProfileIds);
    const requestHeadersByName = new Map();

    state.profiles
      .filter((profile) => activeProfileIds.has(profile.id))
      .forEach((profile) => profile.headers
        .filter((header) => header.enabled !== false)
        .map(validateHeader)
        .filter((result) => result.valid)
        .forEach((result) => {
          const normalizedName = result.name.toLowerCase();
          const existingModification = requestHeadersByName.get(normalizedName);
          let modification;

          if (result.operation === "append") {
            const canExtendExisting = existingModification
              && existingModification.operation !== "remove";
            const combinedValue = canExtendExisting
              ? combineHeaderValues(
                existingModification.value,
                result.value,
                result.name
              )
              : result.value;
            const operation = canExtendExisting
              ? (existingModification.operation === "append" && result.nativeAppend
                ? "append"
                : "set")
              : (result.nativeAppend ? "append" : "set");

            modification = {
              header: result.name,
              operation,
              value: combinedValue
            };
          } else {
            modification = {
              header: result.name,
              operation: result.operation
            };

            if (result.operation !== "remove") {
              modification.value = result.value;
            }
          }

          requestHeadersByName.delete(normalizedName);
          requestHeadersByName.set(normalizedName, modification);
        }));

    const requestHeaders = [...requestHeadersByName.values()];

    if (requestHeaders.length === 0) {
      return null;
    }

    return {
      id: RULE_ID,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders
      },
      condition: {
        regexFilter: "^https?://",
        resourceTypes: REQUEST_RESOURCE_TYPES
      }
    };
  }

  const api = {
    STORAGE_KEY,
    RULE_ID,
    PROFILE_NAME_LIMIT,
    createHeader,
    createProfile,
    createDefaultState,
    normalizeState,
    validateHeader,
    buildDynamicRule
  };

  globalScope.HeaderCore = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
