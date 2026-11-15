"use strict";

importScripts("core.js");

let applyQueue = Promise.resolve();

async function readState() {
  const stored = await chrome.storage.local.get(HeaderCore.STORAGE_KEY);
  return HeaderCore.normalizeState(stored[HeaderCore.STORAGE_KEY]);
}

async function ensureState() {
  const stored = await chrome.storage.local.get(HeaderCore.STORAGE_KEY);
  const state = HeaderCore.normalizeState(stored[HeaderCore.STORAGE_KEY]);

  if (!stored[HeaderCore.STORAGE_KEY]) {
    await chrome.storage.local.set({ [HeaderCore.STORAGE_KEY]: state });
  }

  return state;
}

async function applyCurrentProfile() {
  const state = await readState();
  const rule = HeaderCore.buildDynamicRule(state);
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const update = {
    removeRuleIds: existingRules.map((existingRule) => existingRule.id)
  };

  if (rule) {
    update.addRules = [rule];
  }

  if (update.removeRuleIds.length > 0 || rule) {
    await chrome.declarativeNetRequest.updateDynamicRules(update);
  }

  return {
    applied: Boolean(rule),
    headerCount: rule ? rule.action.requestHeaders.length : 0
  };
}

function queueApply() {
  applyQueue = applyQueue
    .catch(() => undefined)
    .then(applyCurrentProfile);

  return applyQueue;
}

chrome.runtime.onInstalled.addListener(() => {
  ensureState()
    .then(queueApply)
    .catch((error) => console.error("Unable to initialize header rules.", error));
});

chrome.runtime.onStartup.addListener(() => {
  queueApply()
    .catch((error) => console.error("Unable to restore header rules.", error));
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[HeaderCore.STORAGE_KEY]) {
    return;
  }

  queueApply()
    .catch((error) => console.error("Unable to update header rules.", error));
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "APPLY_HEADERS") {
    return false;
  }

  queueApply()
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});
