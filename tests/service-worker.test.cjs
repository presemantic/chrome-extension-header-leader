"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

test("popup reconciliation replaces stale dynamic rules with main-frame coverage", async () => {
  const root = path.resolve(__dirname, "..");
  const listeners = {};
  const updates = [];
  const state = {
    version: 2,
    enabled: true,
    activeProfileIds: ["profile"],
    profiles: [{
      id: "profile",
      name: "Profile",
      headers: [{
        id: "header",
        name: "X-Test",
        value: "yes",
        operation: "set",
        enabled: true
      }]
    }]
  };
  const context = vm.createContext({
    console,
    chrome: {
      declarativeNetRequest: {
        getDynamicRules: async () => [{ id: 99, condition: { regexFilter: "^https?://" } }],
        updateDynamicRules: async (update) => updates.push(update)
      },
      runtime: {
        onInstalled: { addListener: (listener) => { listeners.installed = listener; } },
        onStartup: { addListener: (listener) => { listeners.startup = listener; } },
        onMessage: { addListener: (listener) => { listeners.message = listener; } }
      },
      storage: {
        local: {
          get: async () => ({ headerManagerState: state }),
          set: async () => undefined
        },
        onChanged: { addListener: (listener) => { listeners.storageChanged = listener; } }
      }
    },
    clearTimeout,
    setTimeout
  });

  context.importScripts = (...files) => {
    files.forEach((file) => {
      vm.runInContext(
        fs.readFileSync(path.join(root, file), "utf8"),
        context,
        { filename: file }
      );
    });
  };

  vm.runInContext(
    fs.readFileSync(path.join(root, "service-worker.js"), "utf8"),
    context,
    { filename: "service-worker.js" }
  );

  const response = await new Promise((resolve) => {
    const keepAlive = listeners.message(
      { type: "APPLY_HEADERS" },
      {},
      resolve
    );
    assert.equal(keepAlive, true);
  });

  assert.equal(response.ok, true);
  assert.equal(response.headerCount, 1);
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].removeRuleIds, [99]);
  assert.equal(updates[0].addRules[0].action.requestHeaders[0].header, "X-Test");
  assert.ok(updates[0].addRules[0].condition.resourceTypes.includes("main_frame"));
});
