"use strict";

const elements = {
  extensionEnabled: document.querySelector("#extensionEnabled"),
  enabledLabel: document.querySelector("#enabledLabel"),
  saveStatus: document.querySelector("#saveStatus"),
  profileList: document.querySelector("#profileList"),
  profileScrollbar: document.querySelector("#profileScrollbar"),
  profileScrollbarThumb: document.querySelector("#profileScrollbarThumb"),
  addProfile: document.querySelector("#addProfile"),
  undoDeleteProfile: document.querySelector("#undoDeleteProfile"),
  undoDeleteHeader: document.querySelector("#undoDeleteHeader"),
  addHeader: document.querySelector("#addHeader"),
  headerRows: document.querySelector("#headerRows"),
  emptyHeaders: document.querySelector("#emptyHeaders"),
  headerScrollbar: document.querySelector("#headerScrollbar"),
  headerScrollbarThumb: document.querySelector("#headerScrollbarThumb"),
  profileItemTemplate: document.querySelector("#profileItemTemplate"),
  headerRowTemplate: document.querySelector("#headerRowTemplate")
};

let state = HeaderCore.createDefaultState();
let selectedProfileId = state.activeProfileIds[0];
let deletedProfileHistory = [];
let deletedHeaderHistory = [];
let draggedHeaderId = null;
let headerScrollbarPointerId = null;
let headerScrollbarStartY = 0;
let headerScrollbarStartTop = 0;
let profileScrollbarPointerId = null;
let profileScrollbarStartY = 0;
let profileScrollbarStartTop = 0;
let saveSequence = 0;

function getSelectedProfile() {
  return state.profiles.find((profile) => profile.id === selectedProfileId)
    || state.profiles[0];
}

function setStatus(message, tone = "normal") {
  elements.saveStatus.textContent = message;
  elements.saveStatus.dataset.tone = tone;
}

function scheduleSave() {
  setStatus("Saving");
  const sequence = ++saveSequence;
  const snapshot = HeaderCore.normalizeState(state);

  chrome.storage.local.set({ [HeaderCore.STORAGE_KEY]: snapshot })
    .then(() => {
      if (sequence === saveSequence) {
        setStatus("Saved");
      }
    })
    .catch((error) => {
      if (sequence === saveSequence) {
        setStatus(error.message || "Unable to save", "error");
      }
    });
}

function selectProfile(profileId) {
  if (!state.profiles.some((profile) => profile.id === profileId)) {
    return;
  }

  selectedProfileId = profileId;
  elements.profileList.querySelectorAll(".profile-item").forEach((item) => {
    const isSelected = item.dataset.profileId === selectedProfileId;
    item.classList.toggle("is-selected", isSelected);
    item.setAttribute("aria-current", isSelected ? "true" : "false");
  });
  renderEditor();
}

function finishProfileNameEdit(profile, input, display) {
  profile.name = profile.name.trim() || "Untitled profile";
  input.value = profile.name;
  display.textContent = profile.name;
  display.title = profile.name;
  input.hidden = true;
  display.hidden = false;
  scheduleSave();
}

function renderProfiles() {
  elements.profileList.replaceChildren();

  state.profiles.forEach((profile) => {
    const item = elements.profileItemTemplate.content.firstElementChild.cloneNode(true);
    const editButton = item.querySelector(".edit-profile-name");
    const nameDisplay = item.querySelector(".profile-name-display");
    const nameInput = item.querySelector(".profile-name-input");
    const activeInput = item.querySelector(".profile-active");
    const deleteButton = item.querySelector(".delete-profile-icon");

    item.dataset.profileId = profile.id;
    nameDisplay.textContent = profile.name;
    nameDisplay.title = profile.name;
    nameInput.value = profile.name;
    activeInput.checked = state.enabled && state.activeProfileIds.includes(profile.id);
    activeInput.disabled = !state.enabled;
    item.classList.toggle("is-selected", profile.id === selectedProfileId);
    item.classList.toggle("is-active", activeInput.checked);
    item.setAttribute("aria-current", profile.id === selectedProfileId ? "true" : "false");

    item.addEventListener("click", (event) => {
      if (!event.target.closest?.("button, input, label")) {
        selectProfile(profile.id);
      }
    });

    activeInput.addEventListener("change", () => {
      if (activeInput.checked) {
        state.activeProfileIds = [...new Set([...state.activeProfileIds, profile.id])];
      } else {
        state.activeProfileIds = state.activeProfileIds.filter(
          (profileId) => profileId !== profile.id
        );
      }
      item.classList.toggle("is-active", activeInput.checked);
      scheduleSave();
    });

    nameDisplay.addEventListener("click", () => selectProfile(profile.id));
    editButton.addEventListener("click", () => {
      selectProfile(profile.id);
      nameDisplay.hidden = true;
      nameInput.hidden = false;
      nameInput.focus();
      nameInput.select();
    });
    nameInput.addEventListener("input", () => {
      profile.name = nameInput.value.slice(0, HeaderCore.PROFILE_NAME_LIMIT);
      scheduleSave();
    });
    nameInput.addEventListener("blur", () => {
      finishProfileNameEdit(profile, nameInput, nameDisplay);
    });
    nameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        nameInput.blur();
      }
    });

    deleteButton.addEventListener("click", () => deleteProfile(profile));
    elements.profileList.append(item);
  });

  requestAnimationFrame(updateProfileScrollbar);
}

function updateHeaderError(row, header) {
  const result = HeaderCore.validateHeader(header);
  const error = row.querySelector(".field-error");
  const nameInput = row.querySelector(".header-name");

  if (!header.enabled || !header.name.trim()) {
    error.textContent = "";
    nameInput.removeAttribute("aria-invalid");
    return;
  }

  error.textContent = result.valid ? "" : result.reason;
  if (result.valid) {
    nameInput.removeAttribute("aria-invalid");
  } else {
    nameInput.setAttribute("aria-invalid", "true");
  }
}

function getHeaderScrollbarMetrics() {
  const trackHeight = elements.headerScrollbar.clientHeight;
  const viewportHeight = elements.headerRows.clientHeight;
  const contentHeight = elements.headerRows.scrollHeight;
  const hasOverflow = !elements.headerRows.hidden
    && contentHeight > viewportHeight + 1;
  const thumbHeight = hasOverflow
    ? Math.max(36, trackHeight * (viewportHeight / contentHeight))
    : trackHeight;

  return {
    trackHeight,
    viewportHeight,
    contentHeight,
    hasOverflow,
    thumbHeight,
    maxThumbTop: Math.max(0, trackHeight - thumbHeight),
    maxScrollTop: Math.max(0, contentHeight - viewportHeight)
  };
}

function updateHeaderScrollbar() {
  const metrics = getHeaderScrollbarMetrics();
  if (metrics.trackHeight <= 0) {
    return;
  }

  const thumbTop = metrics.hasOverflow && metrics.maxScrollTop > 0
    ? (elements.headerRows.scrollTop / metrics.maxScrollTop) * metrics.maxThumbTop
    : 0;

  elements.headerScrollbar.classList.toggle("is-static", !metrics.hasOverflow);
  elements.headerScrollbarThumb.style.height = `${metrics.thumbHeight}px`;
  elements.headerScrollbarThumb.style.top = `${thumbTop}px`;
}

function scrollHeadersFromThumbTop(thumbTop) {
  const metrics = getHeaderScrollbarMetrics();
  if (!metrics.hasOverflow || metrics.maxThumbTop <= 0) {
    return;
  }

  const clampedTop = Math.max(0, Math.min(thumbTop, metrics.maxThumbTop));
  elements.headerRows.scrollTop = (clampedTop / metrics.maxThumbTop) * metrics.maxScrollTop;
}

function stopHeaderScrollbarDrag(event) {
  if (event.pointerId !== headerScrollbarPointerId) {
    return;
  }

  if (elements.headerScrollbarThumb.hasPointerCapture(event.pointerId)) {
    elements.headerScrollbarThumb.releasePointerCapture(event.pointerId);
  }
  headerScrollbarPointerId = null;
  elements.headerScrollbarThumb.classList.remove("is-dragging");
}

function getProfileScrollbarMetrics() {
  const trackHeight = elements.profileScrollbar.clientHeight;
  const viewportHeight = elements.profileList.clientHeight;
  const contentHeight = elements.profileList.scrollHeight;
  const hasOverflow = contentHeight > viewportHeight + 1;
  const thumbHeight = hasOverflow
    ? Math.max(36, trackHeight * (viewportHeight / contentHeight))
    : trackHeight;

  return {
    trackHeight,
    viewportHeight,
    contentHeight,
    hasOverflow,
    thumbHeight,
    maxThumbTop: Math.max(0, trackHeight - thumbHeight),
    maxScrollTop: Math.max(0, contentHeight - viewportHeight)
  };
}

function updateProfileScrollbar() {
  const metrics = getProfileScrollbarMetrics();
  if (metrics.trackHeight <= 0) {
    return;
  }

  const thumbTop = metrics.hasOverflow && metrics.maxScrollTop > 0
    ? (elements.profileList.scrollTop / metrics.maxScrollTop) * metrics.maxThumbTop
    : 0;

  elements.profileScrollbar.classList.toggle("is-static", !metrics.hasOverflow);
  elements.profileScrollbarThumb.style.height = `${metrics.thumbHeight}px`;
  elements.profileScrollbarThumb.style.top = `${thumbTop}px`;
}

function scrollProfilesFromThumbTop(thumbTop) {
  const metrics = getProfileScrollbarMetrics();
  if (!metrics.hasOverflow || metrics.maxThumbTop <= 0) {
    return;
  }

  const clampedTop = Math.max(0, Math.min(thumbTop, metrics.maxThumbTop));
  elements.profileList.scrollTop = (clampedTop / metrics.maxThumbTop) * metrics.maxScrollTop;
}

function stopProfileScrollbarDrag(event) {
  if (event.pointerId !== profileScrollbarPointerId) {
    return;
  }

  if (elements.profileScrollbarThumb.hasPointerCapture(event.pointerId)) {
    elements.profileScrollbarThumb.releasePointerCapture(event.pointerId);
  }
  profileScrollbarPointerId = null;
  elements.profileScrollbarThumb.classList.remove("is-dragging");
}

function renderReorderedHeaders(profile, scrollTop) {
  renderHeaderRows(profile);
  elements.headerRows.scrollTop = scrollTop;
  scheduleSave();
}

function moveHeaderByOffset(profile, headerId, offset) {
  const currentIndex = profile.headers.findIndex((header) => header.id === headerId);
  const targetIndex = currentIndex + offset;

  if (currentIndex === -1 || targetIndex < 0 || targetIndex >= profile.headers.length) {
    return;
  }

  const scrollTop = elements.headerRows.scrollTop;
  const [header] = profile.headers.splice(currentIndex, 1);
  profile.headers.splice(targetIndex, 0, header);
  renderReorderedHeaders(profile, scrollTop);
}

function clearHeaderDropIndicators() {
  elements.headerRows.querySelectorAll(".header-row").forEach((row) => {
    delete row.dataset.dropPosition;
  });
}

function moveHeaderByDrop(profile, draggedId, targetId, insertAfter) {
  const draggedIndex = profile.headers.findIndex((header) => header.id === draggedId);
  const targetIndex = profile.headers.findIndex((header) => header.id === targetId);

  if (draggedIndex === -1 || targetIndex === -1 || draggedId === targetId) {
    return;
  }

  const scrollTop = elements.headerRows.scrollTop;
  const [draggedHeader] = profile.headers.splice(draggedIndex, 1);
  const updatedTargetIndex = profile.headers.findIndex((header) => header.id === targetId);
  const insertionIndex = updatedTargetIndex + (insertAfter ? 1 : 0);
  profile.headers.splice(insertionIndex, 0, draggedHeader);
  renderReorderedHeaders(profile, scrollTop);
}

function renderHeaderRows(profile) {
  elements.headerRows.replaceChildren();
  elements.headerRows.hidden = profile.headers.length === 0;
  elements.emptyHeaders.hidden = profile.headers.length !== 0;

  profile.headers.forEach((header) => {
    const row = elements.headerRowTemplate.content.firstElementChild.cloneNode(true);
    const dragHandle = row.querySelector(".drag-handle");
    const enabledInput = row.querySelector(".header-enabled");
    const nameInput = row.querySelector(".header-name");
    const valueInput = row.querySelector(".header-value");
    const operationSelect = row.querySelector(".header-operation");
    const removeButton = row.querySelector(".delete-header-icon");

    row.dataset.headerId = header.id;
    enabledInput.checked = header.enabled !== false;
    nameInput.value = header.name;
    valueInput.value = header.value;
    operationSelect.value = header.operation;
    valueInput.disabled = header.operation === "remove";
    row.classList.toggle("is-disabled", !enabledInput.checked);
    updateHeaderError(row, header);

    dragHandle.addEventListener("dragstart", (event) => {
      draggedHeaderId = header.id;
      row.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", header.id);
    });

    dragHandle.addEventListener("dragend", () => {
      draggedHeaderId = null;
      row.classList.remove("is-dragging");
      clearHeaderDropIndicators();
    });

    dragHandle.addEventListener("keydown", (event) => {
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        moveHeaderByOffset(profile, header.id, event.key === "ArrowUp" ? -1 : 1);
      }
    });

    row.addEventListener("dragover", (event) => {
      if (!draggedHeaderId || draggedHeaderId === header.id) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const bounds = row.getBoundingClientRect();
      clearHeaderDropIndicators();
      row.dataset.dropPosition = event.clientY > bounds.top + bounds.height / 2
        ? "after"
        : "before";
    });

    row.addEventListener("dragleave", (event) => {
      if (!row.contains(event.relatedTarget)) {
        delete row.dataset.dropPosition;
      }
    });

    row.addEventListener("drop", (event) => {
      event.preventDefault();
      const insertAfter = row.dataset.dropPosition === "after";
      const droppedHeaderId = draggedHeaderId;
      draggedHeaderId = null;
      clearHeaderDropIndicators();
      moveHeaderByDrop(profile, droppedHeaderId, header.id, insertAfter);
    });

    enabledInput.addEventListener("change", () => {
      header.enabled = enabledInput.checked;
      row.classList.toggle("is-disabled", !header.enabled);
      updateHeaderError(row, header);
      scheduleSave();
    });

    nameInput.addEventListener("input", () => {
      header.name = nameInput.value;
      updateHeaderError(row, header);
      scheduleSave();
    });

    valueInput.addEventListener("input", () => {
      header.value = valueInput.value;
      updateHeaderError(row, header);
      scheduleSave();
    });

    operationSelect.addEventListener("change", () => {
      header.operation = operationSelect.value;
      valueInput.disabled = header.operation === "remove";
      updateHeaderError(row, header);
      scheduleSave();
    });

    removeButton.addEventListener("click", () => {
      const headerIndex = profile.headers.findIndex((candidate) => candidate.id === header.id);
      if (headerIndex === -1) {
        return;
      }

      const [deletedHeader] = profile.headers.splice(headerIndex, 1);
      deletedHeaderHistory.push({
        profileId: profile.id,
        header: deletedHeader,
        headerIndex
      });
      renderHeaderRows(profile);
      renderHeaderUndoState();
      scheduleSave();
    });

    elements.headerRows.append(row);
  });

  requestAnimationFrame(updateHeaderScrollbar);
}

function renderEditor() {
  const profile = getSelectedProfile();
  selectedProfileId = profile.id;
  renderHeaderRows(profile);
}

function renderEnabledState() {
  elements.extensionEnabled.checked = state.enabled;
  elements.enabledLabel.textContent = state.enabled ? "Enabled" : "Disabled";
}

function renderUndoState() {
  const lastDeleted = deletedProfileHistory.at(-1);
  elements.undoDeleteProfile.disabled = !lastDeleted;
  elements.undoDeleteProfile.title = lastDeleted
    ? `Restore “${lastDeleted.profile.name}”`
    : "Nothing to restore";
}

function renderHeaderUndoState() {
  const lastDeleted = deletedHeaderHistory.at(-1);
  const headerName = lastDeleted?.header.name.trim() || "Untitled header";
  elements.undoDeleteHeader.disabled = !lastDeleted;
  elements.undoDeleteHeader.title = lastDeleted
    ? `Restore “${headerName}”`
    : "Nothing to restore";
}

function render() {
  renderEnabledState();
  renderUndoState();
  renderHeaderUndoState();
  renderProfiles();
  renderEditor();
}

function addHeader() {
  const profile = getSelectedProfile();
  const header = HeaderCore.createHeader();
  profile.headers.push(header);
  renderHeaderRows(profile);
  scheduleSave();

  requestAnimationFrame(() => {
    elements.headerRows
      .querySelector(`[data-header-id="${CSS.escape(header.id)}"] .header-name`)
      ?.focus();
  });
}

function deleteProfile(profile) {
  const profileIndex = state.profiles.findIndex((candidate) => candidate.id === profile.id);
  if (profileIndex === -1) {
    return;
  }

  const wasActive = state.activeProfileIds.includes(profile.id);
  const wasSelected = selectedProfileId === profile.id;
  state.profiles = state.profiles.filter((candidate) => candidate.id !== profile.id);
  state.activeProfileIds = state.activeProfileIds.filter(
    (profileId) => profileId !== profile.id
  );

  let replacementProfileId = null;
  if (state.profiles.length === 0) {
    const replacement = HeaderCore.createProfile("Default profile");
    state.profiles.push(replacement);
    state.activeProfileIds = [replacement.id];
    replacementProfileId = replacement.id;
  }

  if (wasSelected) {
    selectedProfileId = state.profiles[0].id;
  }

  deletedProfileHistory.push({
    profile,
    profileIndex,
    wasActive,
    wasSelected,
    replacementProfileId
  });
  render();
  scheduleSave();
}

function undoDeleteProfile() {
  const deleted = deletedProfileHistory.pop();
  if (!deleted) {
    return;
  }

  if (
    deleted.replacementProfileId
    && state.profiles.length === 1
    && state.profiles[0].id === deleted.replacementProfileId
  ) {
    state.profiles = [];
    state.activeProfileIds = state.activeProfileIds.filter(
      (profileId) => profileId !== deleted.replacementProfileId
    );
  }

  const insertionIndex = Math.min(deleted.profileIndex, state.profiles.length);
  state.profiles.splice(insertionIndex, 0, deleted.profile);

  if (deleted.wasActive) {
    state.activeProfileIds = [...new Set([
      ...state.activeProfileIds,
      deleted.profile.id
    ])];
  }

  if (deleted.wasSelected) {
    selectedProfileId = deleted.profile.id;
  }

  render();
  scheduleSave();
}

function findProfileForHeaderUndo(profileId) {
  const currentProfile = state.profiles.find((profile) => profile.id === profileId);
  if (currentProfile) {
    return currentProfile;
  }

  for (let index = deletedProfileHistory.length - 1; index >= 0; index -= 1) {
    if (deletedProfileHistory[index].profile.id === profileId) {
      return deletedProfileHistory[index].profile;
    }
  }

  return null;
}

function undoDeleteHeader() {
  while (deletedHeaderHistory.length > 0) {
    const deleted = deletedHeaderHistory.pop();
    const profile = findProfileForHeaderUndo(deleted.profileId);

    if (!profile || profile.headers.some((header) => header.id === deleted.header.id)) {
      continue;
    }

    const insertionIndex = Math.min(deleted.headerIndex, profile.headers.length);
    profile.headers.splice(insertionIndex, 0, deleted.header);

    if (state.profiles.some((candidate) => candidate.id === profile.id)) {
      if (selectedProfileId === profile.id) {
        renderHeaderRows(profile);
      }
      scheduleSave();
    }

    renderHeaderUndoState();
    return;
  }

  renderHeaderUndoState();
}

elements.extensionEnabled.addEventListener("change", () => {
  state.enabled = elements.extensionEnabled.checked;
  render();
  scheduleSave();
});

elements.addProfile.addEventListener("click", () => {
  const profile = HeaderCore.createProfile(`Profile ${state.profiles.length + 1}`);
  state.profiles.push(profile);
  selectedProfileId = profile.id;
  render();
  scheduleSave();

  requestAnimationFrame(() => {
    elements.profileList
      .querySelector(`[data-profile-id="${CSS.escape(profile.id)}"] .edit-profile-name`)
      ?.click();
  });
});

elements.undoDeleteProfile.addEventListener("click", undoDeleteProfile);
elements.undoDeleteHeader.addEventListener("click", undoDeleteHeader);

elements.addHeader.addEventListener("click", addHeader);
elements.profileList.addEventListener("scroll", updateProfileScrollbar);

elements.profileScrollbar.addEventListener("pointerdown", (event) => {
  if (
    event.target === elements.profileScrollbarThumb
    || elements.profileScrollbarThumb.contains(event.target)
  ) {
    return;
  }

  const metrics = getProfileScrollbarMetrics();
  if (!metrics.hasOverflow) {
    return;
  }

  const trackBounds = elements.profileScrollbar.getBoundingClientRect();
  scrollProfilesFromThumbTop(
    event.clientY - trackBounds.top - metrics.thumbHeight / 2
  );
});

elements.profileScrollbarThumb.addEventListener("pointerdown", (event) => {
  const metrics = getProfileScrollbarMetrics();
  if (!metrics.hasOverflow) {
    return;
  }

  event.preventDefault();
  profileScrollbarPointerId = event.pointerId;
  profileScrollbarStartY = event.clientY;
  profileScrollbarStartTop = Number.parseFloat(
    elements.profileScrollbarThumb.style.top || "0"
  );
  elements.profileScrollbarThumb.setPointerCapture(event.pointerId);
  elements.profileScrollbarThumb.classList.add("is-dragging");
});

elements.profileScrollbarThumb.addEventListener("pointermove", (event) => {
  if (event.pointerId !== profileScrollbarPointerId) {
    return;
  }

  scrollProfilesFromThumbTop(
    profileScrollbarStartTop + event.clientY - profileScrollbarStartY
  );
});

elements.profileScrollbarThumb.addEventListener("pointerup", stopProfileScrollbarDrag);
elements.profileScrollbarThumb.addEventListener("pointercancel", stopProfileScrollbarDrag);
elements.headerRows.addEventListener("scroll", updateHeaderScrollbar);

elements.headerScrollbar.addEventListener("pointerdown", (event) => {
  if (
    event.target === elements.headerScrollbarThumb
    || elements.headerScrollbarThumb.contains(event.target)
  ) {
    return;
  }

  const metrics = getHeaderScrollbarMetrics();
  if (!metrics.hasOverflow) {
    return;
  }

  const trackBounds = elements.headerScrollbar.getBoundingClientRect();
  scrollHeadersFromThumbTop(
    event.clientY - trackBounds.top - metrics.thumbHeight / 2
  );
});

elements.headerScrollbarThumb.addEventListener("pointerdown", (event) => {
  const metrics = getHeaderScrollbarMetrics();
  if (!metrics.hasOverflow) {
    return;
  }

  event.preventDefault();
  headerScrollbarPointerId = event.pointerId;
  headerScrollbarStartY = event.clientY;
  headerScrollbarStartTop = Number.parseFloat(
    elements.headerScrollbarThumb.style.top || "0"
  );
  elements.headerScrollbarThumb.setPointerCapture(event.pointerId);
  elements.headerScrollbarThumb.classList.add("is-dragging");
});

elements.headerScrollbarThumb.addEventListener("pointermove", (event) => {
  if (event.pointerId !== headerScrollbarPointerId) {
    return;
  }

  scrollHeadersFromThumbTop(
    headerScrollbarStartTop + event.clientY - headerScrollbarStartY
  );
});

elements.headerScrollbarThumb.addEventListener("pointerup", stopHeaderScrollbarDrag);
elements.headerScrollbarThumb.addEventListener("pointercancel", stopHeaderScrollbarDrag);
window.addEventListener("resize", () => {
  updateProfileScrollbar();
  updateHeaderScrollbar();
});

async function initialize() {
  try {
    const stored = await chrome.storage.local.get(HeaderCore.STORAGE_KEY);
    state = HeaderCore.normalizeState(stored[HeaderCore.STORAGE_KEY]);
    selectedProfileId = state.activeProfileIds[0] || state.profiles[0].id;
    render();
    const result = await chrome.runtime.sendMessage({ type: "APPLY_HEADERS" });
    if (!result?.ok) {
      throw new Error(result?.error || "Unable to apply header rules.");
    }
    setStatus(result.applied ? `${result.headerCount} applied` : "Ready");
  } catch (error) {
    render();
    setStatus(error.message || "Unable to load", "error");
  }
}

initialize();
