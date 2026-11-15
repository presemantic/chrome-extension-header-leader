"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const HeaderCore = require("../core.js");

test("creates a usable default state", () => {
  const state = HeaderCore.createDefaultState();

  assert.equal(state.enabled, true);
  assert.equal(state.profiles.length, 1);
  assert.deepEqual(state.activeProfileIds, [state.profiles[0].id]);
  assert.equal(state.profiles[0].headers.length, 1);
  assert.equal(state.profiles[0].headers[0].enabled, true);
});

test("limits profile names to 32 characters", () => {
  const profile = HeaderCore.createProfile("a".repeat(50));

  assert.equal(profile.name.length, 32);
});

test("validates header names and blocks value line breaks", () => {
  assert.equal(HeaderCore.validateHeader({ name: "X-Test", value: "ok", operation: "set" }).valid, true);
  assert.equal(HeaderCore.validateHeader({ name: "Bad Header", value: "ok", operation: "set" }).valid, false);
  assert.equal(HeaderCore.validateHeader({ name: "X-Test", value: "a\nb", operation: "set" }).valid, false);
});

test("marks whether Chrome supports native append for a request header", () => {
  const supported = HeaderCore.validateHeader({ name: "Accept-Language", value: "pl", operation: "append" });
  const unsupported = HeaderCore.validateHeader({ name: "X-Custom", value: "value", operation: "append" });

  assert.equal(supported.valid, true);
  assert.equal(supported.name, "accept-language");
  assert.equal(supported.nativeAppend, true);
  assert.equal(unsupported.valid, true);
  assert.equal(unsupported.name, "X-Custom");
  assert.equal(unsupported.nativeAppend, false);
});

test("emulates repeated custom-header append with a combined set value", () => {
  const profile = HeaderCore.createProfile("Append", {
    id: "append",
    headers: [
      { name: "1", value: "1", operation: "append" },
      { name: "1", value: "2", operation: "append" },
      { name: "1", value: "3", operation: "append" },
      { name: "1", value: "4", operation: "append" }
    ]
  });
  const rule = HeaderCore.buildDynamicRule({
    enabled: true,
    activeProfileIds: ["append"],
    profiles: [profile]
  });

  assert.deepEqual(rule.action.requestHeaders, [
    { header: "1", operation: "set", value: "1, 2, 3, 4" }
  ]);
});

test("keeps native append for Chrome-supported headers", () => {
  const profile = HeaderCore.createProfile("Native append", {
    id: "native",
    headers: [
      { name: "Accept-Language", value: "pl", operation: "append" },
      { name: "Accept-Language", value: "en", operation: "append" }
    ]
  });
  const rule = HeaderCore.buildDynamicRule({
    enabled: true,
    activeProfileIds: ["native"],
    profiles: [profile]
  });

  assert.deepEqual(rule.action.requestHeaders, [
    { header: "accept-language", operation: "append", value: "pl, en" }
  ]);
});

test("builds one request modification rule from an active profile", () => {
  const profile = HeaderCore.createProfile("API", {
    id: "api",
    headers: [
      { id: "one", name: "X-Environment", value: "test", operation: "set" },
      { id: "two", name: "X-Trace", value: "", operation: "remove" },
      { id: "blank", name: "", value: "ignored", operation: "set" }
    ]
  });
  const rule = HeaderCore.buildDynamicRule({
    enabled: true,
    activeProfileIds: ["api"],
    profiles: [profile]
  });

  assert.equal(rule.id, HeaderCore.RULE_ID);
  assert.deepEqual(rule.action.requestHeaders, [
    { header: "X-Environment", operation: "set", value: "test" },
    { header: "X-Trace", operation: "remove" }
  ]);
  assert.equal(rule.condition.regexFilter, "^https?://");
  assert.ok(rule.condition.resourceTypes.includes("main_frame"));
  assert.ok(rule.condition.resourceTypes.includes("sub_frame"));
  assert.ok(rule.condition.resourceTypes.includes("xmlhttprequest"));
});

test("returns no rule when the extension is disabled", () => {
  const state = HeaderCore.createDefaultState();
  const activeProfileIds = [...state.activeProfileIds];
  state.enabled = false;

  assert.equal(HeaderCore.buildDynamicRule(state), null);
  assert.deepEqual(HeaderCore.normalizeState(state).activeProfileIds, activeProfileIds);
});

test("skips individually disabled headers", () => {
  const profile = HeaderCore.createProfile("API", {
    id: "api",
    headers: [
      { id: "enabled", name: "X-Enabled", value: "yes", operation: "set", enabled: true },
      { id: "disabled", name: "X-Disabled", value: "no", operation: "set", enabled: false }
    ]
  });
  const rule = HeaderCore.buildDynamicRule({
    enabled: true,
    activeProfileIds: ["api"],
    profiles: [profile]
  });

  assert.deepEqual(rule.action.requestHeaders, [
    { header: "X-Enabled", operation: "set", value: "yes" }
  ]);
});

test("migrates a legacy single active profile", () => {
  const profile = HeaderCore.createProfile("Legacy", { id: "legacy" });
  const state = HeaderCore.normalizeState({
    enabled: true,
    activeProfileId: "legacy",
    profiles: [profile]
  });

  assert.equal(state.version, 2);
  assert.deepEqual(state.activeProfileIds, ["legacy"]);
});

test("combines several active profiles and lets the later profile win conflicts", () => {
  const first = HeaderCore.createProfile("First", {
    id: "first",
    headers: [
      { name: "X-Shared", value: "first", operation: "set" },
      { name: "X-First", value: "one", operation: "set" }
    ]
  });
  const second = HeaderCore.createProfile("Second", {
    id: "second",
    headers: [
      { name: "x-shared", value: "second", operation: "set" },
      { name: "X-Second", value: "two", operation: "set" }
    ]
  });
  const rule = HeaderCore.buildDynamicRule({
    enabled: true,
    activeProfileIds: ["first", "second"],
    profiles: [first, second]
  });

  assert.deepEqual(rule.action.requestHeaders, [
    { header: "X-First", operation: "set", value: "one" },
    { header: "x-shared", operation: "set", value: "second" },
    { header: "X-Second", operation: "set", value: "two" }
  ]);
});

test("returns no rule when every profile is inactive", () => {
  const state = HeaderCore.createDefaultState();
  state.activeProfileIds = [];

  assert.equal(HeaderCore.buildDynamicRule(state), null);
});

test("uses header order when the same profile defines a name more than once", () => {
  const profile = HeaderCore.createProfile("Ordered", {
    id: "ordered",
    headers: [
      { id: "first", name: "X-Order", value: "first", operation: "set" },
      { id: "second", name: "x-order", value: "second", operation: "set" }
    ]
  });
  const state = {
    enabled: true,
    activeProfileIds: ["ordered"],
    profiles: [profile]
  };

  assert.deepEqual(HeaderCore.buildDynamicRule(state).action.requestHeaders, [
    { header: "x-order", operation: "set", value: "second" }
  ]);

  profile.headers.reverse();
  assert.deepEqual(HeaderCore.buildDynamicRule(state).action.requestHeaders, [
    { header: "X-Order", operation: "set", value: "first" }
  ]);
});
