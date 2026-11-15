import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const managerHtml = await readFile(path.join(root, "manager.html"), "utf8");
const managerCss = await readFile(path.join(root, "manager.css"), "utf8");
const icon = await readFile(path.join(root, "icons", "icon-32.png"));
const iconData = `data:image/png;base64,${icon.toString("base64")}`;
const bodyMatch = managerHtml.match(/<body>([\s\S]*?)<script src="core\.js"><\/script>/);

if (!bodyMatch) {
  throw new Error("Unable to extract manager body.");
}

const pencil = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16-.8 4.8L8 20l10.5-10.5-4-4L4 16Zm8.8-8.8 4 4M14.5 5.5l1.4-1.4a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8l-1.4 1.4"/></svg>`;
const trash = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"/></svg>`;
const drag = `<svg viewBox="0 0 16 24" aria-hidden="true"><circle cx="5" cy="6" r="1.5"/><circle cx="11" cy="6" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="11" cy="12" r="1.5"/><circle cx="5" cy="18" r="1.5"/><circle cx="11" cy="18" r="1.5"/></svg>`;

function profileRow(name, { selected = false, active = false, disabled = false } = {}) {
  return `<div class="profile-item${selected ? " is-active" : ""}">
    <button class="edit-profile-name" type="button" aria-label="Edit profile name">${pencil}</button>
    <div class="profile-name-cell"><button class="profile-name-display" type="button">${name}</button></div>
    <label class="profile-switch"><input class="profile-active" type="checkbox"${active ? " checked" : ""}${disabled ? " disabled" : ""}><span aria-hidden="true"></span></label>
    <button class="delete-profile-icon" type="button" aria-label="Delete profile">${trash}</button>
  </div>`;
}

function headerRow(name, value, operation, { enabled = true, disabled = false } = {}) {
  const selected = (candidate) => candidate === operation ? " selected" : "";
  return `<div class="header-row${enabled ? "" : " is-disabled"}" role="row">
    <button class="drag-handle" type="button" aria-label="Drag to reorder header">${drag}</button>
    <label class="row-switch"><input class="header-enabled" type="checkbox"${enabled ? " checked" : ""}${disabled ? " disabled" : ""}><span aria-hidden="true"></span></label>
    <label class="header-name-field"><input class="header-name" type="text" value="${name}"${disabled ? " disabled" : ""}><small class="field-error"></small></label>
    <label><input class="header-value" type="text" value="${value}"${disabled ? " disabled" : ""}></label>
    <label><select class="header-operation"${disabled ? " disabled" : ""}><option value="set"${selected("set")}>Set</option><option value="append"${selected("append")}>Append</option><option value="remove"${selected("remove")}>Remove</option></select></label>
    <button class="delete-header-icon" type="button" aria-label="Delete header">${trash}</button>
  </div>`;
}

const scenarios = [
  {
    file: "header-leader-screenshot-1280x800.png",
    profiles: [
      profileRow("API Debug", { selected: true, active: true }),
      profileRow("Staging", { active: true }),
      profileRow("CORS checks")
    ],
    headers: [
      headerRow("X-Debug", "1", "set"),
      headerRow("Accept", "application/json", "append"),
      headerRow("X-Legacy-Header", "", "remove")
    ]
  },
  {
    file: "header-leader-profiles-1280x800.png",
    profiles: [
      profileRow("Local API", { selected: true, active: true }),
      profileRow("Staging API", { active: true }),
      profileRow("Feature flags", { active: true }),
      profileRow("CORS checks"),
      profileRow("Legacy service")
    ],
    headers: [
      headerRow("X-Environment", "local", "set"),
      headerRow("X-Client", "header-leader", "set")
    ]
  },
  {
    file: "header-leader-operations-1280x800.png",
    profiles: [profileRow("Request operations", { selected: true, active: true }), profileRow("Staging")],
    headers: [
      headerRow("X-Request-ID", "debug-123", "set"),
      headerRow("Accept", "application/json", "append"),
      headerRow("X-Powered-By", "", "remove"),
      headerRow("Cache-Control", "no-cache", "set", { enabled: false })
    ]
  },
  {
    file: "header-leader-multiple-profiles-1280x800.png",
    profiles: [
      profileRow("API Debug", { active: true }),
      profileRow("Staging", { selected: true, active: true }),
      profileRow("Feature flags", { active: true }),
      profileRow("CORS checks")
    ],
    headers: [
      headerRow("X-Environment", "staging", "set"),
      headerRow("X-Feature-Preview", "enabled", "set"),
      headerRow("Authorization", "Bearer demo-token", "set", { enabled: false })
    ]
  },
  {
    file: "header-leader-pause-1280x800.png",
    enabled: false,
    profiles: [
      profileRow("API Debug", { selected: true, active: true, disabled: true }),
      profileRow("Staging", { active: true, disabled: true }),
      profileRow("Feature flags", { disabled: true })
    ],
    headers: [
      headerRow("X-Debug", "1", "set", { disabled: true }),
      headerRow("X-Environment", "staging", "set", { disabled: true })
    ]
  }
];

function renderBody(scenario) {
  let body = bodyMatch[1]
    .replace('src="icons/icon-32.png"', `src="${iconData}"`)
    .replace('<nav id="profileList" class="profile-list" aria-label="Header profiles"></nav>', `<nav id="profileList" class="profile-list" aria-label="Header profiles">${scenario.profiles.join("")}</nav>`)
    .replace('<div id="headerRows" class="header-rows"></div>', `<div id="headerRows" class="header-rows">${scenario.headers.join("")}</div>`)
    .replace('<span id="saveStatus" class="save-status" role="status">Ready</span>', '<span id="saveStatus" class="save-status" role="status">READY</span>');

  if (scenario.enabled === false) {
    body = body.replace('<span id="enabledLabel">Enabled</span>', '<span id="enabledLabel">Disabled</span>');
  } else {
    body = body.replace('<input id="extensionEnabled" type="checkbox">', '<input id="extensionEnabled" type="checkbox" checked>');
  }

  return body;
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_EXECUTABLE_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true
});

for (const scenario of scenarios) {
  const screenshotHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
    ${managerCss}
    html, body { width: 1280px !important; height: 800px !important; }
    body { display: flex !important; align-items: center; justify-content: center; background: radial-gradient(circle at 20% 10%, #2b472e 0, #172518 44%, #0d160f 100%) !important; }
    .shot-shell { width: 800px; height: 600px; border: 1px solid rgba(255,255,255,.16); background: #f2f0e9; box-shadow: 0 30px 90px rgba(0,0,0,.48); }
    svg { fill: none; stroke: currentColor; }
    .drag-handle svg { fill: currentColor; stroke: none; }
  </style></head><body><div class="shot-shell">${renderBody(scenario)}</div></body></html>`;
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.setContent(screenshotHtml, { waitUntil: "load" });
  await writeFile(path.join(root, "assets", scenario.file), await page.screenshot({ type: "png" }));
  await page.close();
}

await browser.close();
console.log(scenarios.map(({ file }) => path.join(root, "assets", file)).join("\n"));
