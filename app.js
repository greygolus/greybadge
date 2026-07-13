import { inject } from "@vercel/analytics";
import {
  BADGE_PRODUCT_ID,
  BADGE_VENDOR_ID,
  DISPLAY_HEIGHT,
  DISPLAY_WIDTH,
  MODES,
  buildPayload,
  writePayload
} from "./protocol.js";
import {
  CONTENT_LIBRARY,
  CUSTOM_EFFECTS,
  FRAME_WIDTH,
  SHOWS,
  combineFrames,
  createCustomAnimation,
  getLibraryEntry
} from "./library.js";
import {
  CLOCK_ANIMATIONS,
  CLOCK_BORDERS,
  CLOCK_FONTS,
  DEFAULT_CLOCK_SETTINGS,
  clockSyncKey,
  clockTimeParts,
  createClockFrames,
  createClockSlot,
  normalizeClockSettings,
  secondsUntilClockSync
} from "./clock.js";

inject({ mode: import.meta.env.PROD ? "production" : "development" });

const $ = (selector, root = document) => root.querySelector(selector);
const STORAGE_KEY = "badgebetter-project-v1";
const FAVORITES_KEY = "badgebetter-favorites-v1";
const CLOCK_STORAGE_KEY = "badgebetter-clock-v1";
const brightnessLevels = [25, 50, 75, 100];

const makeSlot = (text = "NEW MESSAGE") => ({
  text,
  source: "text",
  rows: null,
  speed: 4,
  mode: 0,
  blink: false,
  ants: false
});

const initialState = {
  brightness: 100,
  scrollLock: true,
  slots: [makeSlot("HELLO, WORLD!"), { ...makeSlot("NICE TO MEET YOU"), mode: 6, speed: 6 }]
};

let state = loadState();
let selectedIndex = 0;
let previewRunning = true;
let previewStarted = performance.now();
let connectedDevice = null;
let pixelDraft = blankRows(DISPLAY_WIDTH);
let isDrawing = false;
let eraseMode = false;
let libraryFilter = "Everything";
let favorites = new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]"));
let libraryRowsCache = new Map();
let lastLibraryFrame = 0;
let effectDraft = null;
let pixelCreatesNew = false;
let studioFrames = [blankRows(DISPLAY_WIDTH)];
let activeStudioFrame = 0;
let studioCreatesNew = false;
let studioPlaying = true;
let studioDrawing = false;
let studioEraseMode = false;
let studioOrientation = "horizontal";
let clockSettings = loadClockSettings();
let clockPreviewFrames = [];
let clockPreviewSignature = "";
let clockActive = false;
let clockStopAt = 0;
let clockLastSync = null;
let clockTimer = null;
let clockWriteInProgress = false;
let clockWakeLock = null;

const elements = {
  slotList: $("#slotList"),
  template: $("#slotTemplate"),
  preview: $("#previewCanvas"),
  previewPanel: $("#previewPanel"),
  previewSentinel: $("#previewSentinel"),
  scrollLockButton: $("#scrollLockButton"),
  pixel: $("#pixelCanvas"),
  effect: $("#effectCanvas"),
  deviceStatus: $("#deviceStatus"),
  connectButton: $("#connectButton"),
  sendButton: $("#sendButton"),
  sendDot: $("#sendDot"),
  sendTitle: $("#sendTitle"),
  sendSubtitle: $("#sendSubtitle"),
  previewTitle: $("#previewTitle"),
  timeline: $("#timelineProgress"),
  storage: $("#storageLabel"),
  slots: $("#slotLabel"),
  brightness: $("#brightness"),
  brightnessValue: $("#brightnessValue"),
  pixelDialog: $("#pixelDialog"),
  libraryDialog: $("#libraryDialog"),
  animationDialog: $("#animationDialog"),
  createDialog: $("#createDialog"),
  frameStudioDialog: $("#frameStudioDialog"),
  framePreview: $("#framePreviewCanvas"),
  frameEditor: $("#frameEditorCanvas"),
  frameSequence: $("#frameSequence"),
  clockDialog: $("#clockDialog"),
  clockCanvas: $("#clockCanvas"),
  clockLiveStatus: $("#clockLiveStatus"),
  clockReadout: $("#clockReadout"),
  libraryGrid: $("#libraryGrid"),
  showGrid: $("#showGrid"),
  loadedTray: $("#loadedTray"),
  loadedSummary: $("#loadedSummary"),
  loadedCount: $("#loadedCount"),
  libraryNotice: $("#libraryNotice"),
  librarySearch: $("#librarySearch"),
  toast: $("#toast")
};

function blankRows(width = DISPLAY_WIDTH) {
  return Array.from({ length: DISPLAY_HEIGHT }, () => Array(width).fill(false));
}

function loadClockSettings() {
  try {
    return normalizeClockSettings(JSON.parse(localStorage.getItem(CLOCK_STORAGE_KEY)) || DEFAULT_CLOCK_SETTINGS);
  } catch {
    return normalizeClockSettings(DEFAULT_CLOCK_SETTINGS);
  }
}

function persistClockSettings() {
  localStorage.setItem(CLOCK_STORAGE_KEY, JSON.stringify(clockSettings));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.slots?.length) {
      if (typeof saved.scrollLock !== "boolean") saved.scrollLock = true;
      return saved;
    }
  } catch { /* Start fresh if a preset was interrupted or corrupt. */ }
  return structuredClone(initialState);
}

function syncScrollLock() {
  elements.previewPanel.classList.toggle("locked", state.scrollLock);
  elements.scrollLockButton.classList.toggle("active", state.scrollLock);
  elements.scrollLockButton.setAttribute("aria-pressed", String(state.scrollLock));
  elements.scrollLockButton.setAttribute("aria-label", state.scrollLock ? "Turn preview scroll lock off" : "Turn preview scroll lock on");
  elements.scrollLockButton.lastChild.textContent = state.scrollLock ? " Lock on" : " Lock off";
  updatePreviewDock();
}

function updatePreviewDock() {
  const trigger = elements.previewSentinel.getBoundingClientRect().top + window.scrollY - 88;
  elements.previewPanel.classList.toggle("is-docked", state.scrollLock && window.scrollY > trigger + 4);
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function toast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => elements.toast.classList.remove("show"), 2200);
}

function libraryFeedback(message, isError = false) {
  elements.libraryNotice.textContent = message;
  elements.libraryNotice.style.background = isError ? "#40100d" : "#36100d";
  elements.libraryNotice.classList.remove("show");
  requestAnimationFrame(() => elements.libraryNotice.classList.add("show"));
  clearTimeout(libraryFeedback.timer);
  libraryFeedback.timer = setTimeout(() => elements.libraryNotice.classList.remove("show"), 6000);
}

function rowsForSlot(slot) {
  if (slot.source !== "text" && Array.isArray(slot.rows)) return slot.rows;
  return rasterizeText(slot.text || " ");
}

function rasterizeText(text) {
  const measure = document.createElement("canvas").getContext("2d");
  measure.font = "700 10px Arial, sans-serif";
  const width = Math.max(8, Math.ceil(measure.measureText(text).width) + 3);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = DISPLAY_HEIGHT;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, width, DISPLAY_HEIGHT);
  ctx.fillStyle = "white";
  ctx.font = "700 10px Arial, sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, 1, 9);
  const data = ctx.getImageData(0, 0, width, DISPLAY_HEIGHT).data;
  return Array.from({ length: DISPLAY_HEIGHT }, (_, y) =>
    Array.from({ length: width }, (_, x) => data[(y * width + x) * 4 + 3] > 96)
  );
}

function renderSlots() {
  elements.slotList.replaceChildren();
  state.slots.forEach((slot, index) => {
    const card = elements.template.content.firstElementChild.cloneNode(true);
    card.classList.toggle("selected", index === selectedIndex);
    $(".slot-number", card).textContent = String(index + 1).padStart(2, "0");
    $(".source-label", card).textContent = slot.source === "animation" ? "CUSTOM EFFECT" : slot.source === "library" ? "PREMADE ART" : slot.source.toUpperCase();
    const text = $(".message-text", card);
    text.value = slot.source === "text" ? slot.text : slot.title || (slot.source === "image" ? "Imported bitmap" : "Custom pixel frame");
    text.disabled = slot.source !== "text";
    text.addEventListener("input", () => updateSlot(index, { text: text.value }));

    const mode = $(".mode", card);
    MODES.forEach((name, value) => mode.add(new Option(name, value)));
    mode.value = slot.mode;
    mode.addEventListener("change", () => updateSlot(index, { mode: Number(mode.value) }));

    const speed = $(".speed", card);
    const speedOutput = $(".speed-wrap output", card);
    speed.value = slot.speed;
    speedOutput.textContent = slot.speed;
    speed.addEventListener("input", () => {
      speedOutput.textContent = speed.value;
      updateSlot(index, { speed: Number(speed.value) });
    });
    for (const key of ["blink", "ants"]) {
      const input = $(`.${key}`, card);
      input.checked = slot[key];
      input.addEventListener("change", () => updateSlot(index, { [key]: input.checked }));
    }
    $(".slot-select", card).addEventListener("click", () => selectSlot(index));
    $(".edit-animation", card).addEventListener("click", () => { selectedIndex = index; openFrameStudio(false); });
    $(".duplicate", card).addEventListener("click", () => duplicateSlot(index));
    $(".move-up", card).addEventListener("click", () => moveSlot(index, -1));
    $(".move-down", card).addEventListener("click", () => moveSlot(index, 1));
    $(".remove", card).addEventListener("click", () => removeSlot(index));
    elements.slotList.append(card);
  });
  updateStats();
  if (elements.libraryDialog.open) renderLoadedTray();
}

function updateSlot(index, changes) {
  Object.assign(state.slots[index], changes);
  persist();
  previewStarted = performance.now();
  updateStats();
}

function selectSlot(index) {
  selectedIndex = Math.max(0, Math.min(index, state.slots.length - 1));
  previewStarted = performance.now();
  renderSlots();
}

function duplicateSlot(index) {
  if (state.slots.length >= 8) return toast("The badge supports up to eight slots.");
  state.slots.splice(index + 1, 0, structuredClone(state.slots[index]));
  selectedIndex = index + 1;
  persist();
  renderSlots();
}

function moveSlot(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= state.slots.length) return;
  [state.slots[index], state.slots[target]] = [state.slots[target], state.slots[index]];
  selectedIndex = target;
  persist();
  renderSlots();
}

function removeSlot(index) {
  if (state.slots.length === 1) return toast("Keep at least one message slot.");
  state.slots.splice(index, 1);
  selectedIndex = Math.min(selectedIndex, state.slots.length - 1);
  persist();
  renderSlots();
}

function preparedSlots() {
  return state.slots.map((slot) => ({ ...slot, rows: rowsForSlot(slot) }));
}

function updateStats() {
  elements.slots.textContent = `${state.slots.length} / 8`;
  elements.previewTitle.textContent = `Message ${selectedIndex + 1}`;
  try {
    const result = buildPayload(preparedSlots(), state.brightness);
    elements.storage.textContent = `${result.usedBytes.toLocaleString()} / 8,192 B`;
    elements.sendButton.disabled = !connectedDevice;
  } catch (error) {
    elements.storage.textContent = "OVER CAPACITY";
    elements.sendButton.disabled = true;
    elements.sendSubtitle.textContent = error.message;
  }
}

function pixelViewport(slot, elapsed) {
  const source = rowsForSlot(slot);
  const width = source[0]?.length || 1;
  const viewport = blankRows(DISPLAY_WIDTH);
  const step = Math.floor(elapsed / Math.max(28, 190 - slot.speed * 19));
  let offsetX = 0;
  let offsetY = 0;
  if (slot.mode === 0) offsetX = DISPLAY_WIDTH - (step % (width + DISPLAY_WIDTH));
  else if (slot.mode === 1) offsetX = -width + (step % (width + DISPLAY_WIDTH));
  else if (slot.mode === 2) offsetY = DISPLAY_HEIGHT - (step % (DISPLAY_HEIGHT * 2));
  else if (slot.mode === 3) offsetY = -DISPLAY_HEIGHT + (step % (DISPLAY_HEIGHT * 2));
  else offsetX = Math.floor((DISPLAY_WIDTH - width) / 2);

  let reveal = DISPLAY_WIDTH;
  if (slot.mode === 6) offsetY = -DISPLAY_HEIGHT + Math.min(DISPLAY_HEIGHT, step % (DISPLAY_HEIGHT + 10));
  if (slot.mode === 7) reveal = Math.min(DISPLAY_WIDTH, (step % (DISPLAY_WIDTH + 14)) * 2);
  if (slot.mode === 8) reveal = Math.min(DISPLAY_WIDTH, step % (DISPLAY_WIDTH + 16));
  if (slot.mode === 5) {
    const frameWidth = 48;
    const frames = Math.max(1, Math.ceil(width / frameWidth));
    const frame = Math.floor(elapsed / Math.max(67, 1300 - slot.speed * 145)) % frames;
    offsetX = -frame * frameWidth;
  }

  for (let y = 0; y < DISPLAY_HEIGHT; y += 1) {
    for (let x = 0; x < DISPLAY_WIDTH; x += 1) {
      const sx = x - offsetX;
      const sy = y - offsetY;
      if (x < reveal && source[sy]?.[sx]) viewport[y][x] = true;
    }
  }
  if (slot.ants) {
    for (let x = 0; x < DISPLAY_WIDTH; x += 1) {
      const on = (x + step) % 3 === 0;
      viewport[0][x] ||= on;
      viewport[DISPLAY_HEIGHT - 1][x] ||= on;
    }
    for (let y = 0; y < DISPLAY_HEIGHT; y += 1) {
      const on = (y + step) % 3 === 0;
      viewport[y][0] ||= on;
      viewport[y][DISPLAY_WIDTH - 1] ||= on;
    }
  }
  if (slot.blink && Math.floor(elapsed / 500) % 2) return blankRows(DISPLAY_WIDTH);
  return viewport;
}

function drawLedCanvas(canvas, rows, pixelSize) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#020402";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < rows.length; y += 1) {
    for (let x = 0; x < rows[y].length; x += 1) {
      const gap = Math.max(1, pixelSize * .18);
      ctx.fillStyle = rows[y][x] ? "#ff4938" : "#26100d";
      ctx.shadowColor = rows[y][x] ? "#ff2f23" : "transparent";
      ctx.shadowBlur = rows[y][x] ? pixelSize * .65 : 0;
      ctx.beginPath();
      ctx.roundRect(x * pixelSize + gap / 2, y * pixelSize + gap / 2, pixelSize - gap, pixelSize - gap, pixelSize * .22);
      ctx.fill();
    }
  }
  ctx.shadowBlur = 0;
}

function entryRows(entry) {
  if (!libraryRowsCache.has(entry.id)) libraryRowsCache.set(entry.id, entry.generate());
  return libraryRowsCache.get(entry.id);
}

function rowsToViewport(rows, frame = 0) {
  const viewport = blankRows(DISPLAY_WIDTH);
  const width = rows[0]?.length || 1;
  const sourceX = width > DISPLAY_WIDTH ? frame * FRAME_WIDTH : 0;
  const targetX = width <= DISPLAY_WIDTH ? Math.max(0, Math.floor((DISPLAY_WIDTH - width) / 2)) : 0;
  for (let y = 0; y < DISPLAY_HEIGHT; y += 1) {
    for (let x = 0; x < DISPLAY_WIDTH; x += 1) if (rows[y]?.[sourceX + x]) viewport[y][targetX + x] = true;
  }
  return viewport;
}

function slotFromEntry(entry) {
  return {
    text: "",
    title: entry.name,
    source: entry.kind === "animation" ? "animation" : "library",
    rows: structuredClone(entryRows(entry)),
    speed: entry.speed,
    mode: entry.mode,
    blink: false,
    ants: false
  };
}

function applyLibraryEntry(entry, append = false) {
  const next = slotFromEntry(entry);
  if (append) {
    if (state.slots.length >= 8) return libraryFeedback("All eight badge slots are already in use.", true);
    state.slots.push(next);
    selectedIndex = state.slots.length - 1;
  } else {
    state.slots[selectedIndex] = next;
  }
  persist();
  renderSlots();
  renderLoadedTray();
  libraryFeedback(`✓ ${entry.name} ${append ? `added as slot ${selectedIndex + 1}` : `replaced slot ${selectedIndex + 1}`}.`);
}

function applyShow(show) {
  state.slots = show.entries.map((id) => slotFromEntry(getLibraryEntry(id))).slice(0, 8);
  selectedIndex = 0;
  persist();
  renderSlots();
  renderLoadedTray();
  libraryFeedback(`✓ ${show.name} loaded as a ${state.slots.length}-slot show.`);
}

function renderLoadedTray() {
  elements.loadedCount.textContent = `${state.slots.length} / 8 slots`;
  elements.loadedTray.replaceChildren();
  elements.loadedSummary.replaceChildren();
  state.slots.forEach((slot, index) => {
    const item = document.createElement("article");
    item.className = `loaded-slot${index === selectedIndex ? " selected" : ""}`;
    item.dataset.slotIndex = index;
    const main = document.createElement("button");
    main.className = "loaded-slot-main";
    main.setAttribute("aria-label", `Select loaded slot ${index + 1}`);
    const canvas = document.createElement("canvas");
    canvas.width = 176;
    canvas.height = 44;
    const title = slot.source === "text" ? (slot.text || "Untitled text") : (slot.title || "Custom art");
    const copy = document.createElement("span");
    copy.className = "loaded-slot-copy";
    copy.innerHTML = `<em>${String(index + 1).padStart(2, "0")}</em><b>${escapeHtml(title)}</b><small>${escapeHtml(MODES[slot.mode] || "Custom effect")} · speed ${slot.speed}</small>`;
    main.append(canvas, copy);
    main.addEventListener("click", () => {
      selectedIndex = index;
      previewStarted = performance.now();
      renderSlots();
      renderLoadedTray();
      libraryFeedback(`Slot ${index + 1} selected. Replace will update this slot.`);
    });
    const remove = document.createElement("button");
    remove.className = "loaded-slot-remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Remove loaded slot ${index + 1}`);
    remove.addEventListener("click", () => {
      if (state.slots.length === 1) return libraryFeedback("Keep at least one loaded slot.", true);
      state.slots.splice(index, 1);
      selectedIndex = Math.min(selectedIndex, state.slots.length - 1);
      persist();
      renderSlots();
      renderLoadedTray();
      libraryFeedback(`Slot ${index + 1} removed.`);
    });
    item.append(main, remove);
    elements.loadedTray.append(item);

    const summary = document.createElement("button");
    summary.className = `loaded-summary-chip${index === selectedIndex ? " selected" : ""}`;
    const summaryTitle = slot.source === "text" ? (slot.text || "Untitled text") : (slot.title || "Custom art");
    summary.textContent = `${String(index + 1).padStart(2, "0")} ${summaryTitle}`;
    summary.title = `${summaryTitle} — ${MODES[slot.mode] || "Custom effect"}`;
    summary.addEventListener("click", () => {
      selectedIndex = index;
      previewStarted = performance.now();
      renderSlots();
      renderLoadedTray();
      libraryFeedback(`Slot ${index + 1} selected. Replace will update this slot.`);
    });
    elements.loadedSummary.append(summary);
  });
}

function renderLibraryFilters() {
  const container = $("#libraryFilters");
  container.replaceChildren();
  ["Everything", "Favorites", "Animations", "Icons", "Patterns"].forEach((name) => {
    const button = document.createElement("button");
    button.textContent = name;
    button.classList.toggle("active", libraryFilter === name);
    button.addEventListener("click", () => { libraryFilter = name; renderLibraryFilters(); renderLibrary(); });
    container.append(button);
  });
}

function renderShows() {
  elements.showGrid.replaceChildren();
  SHOWS.forEach((show) => {
    const button = document.createElement("button");
    button.className = "show-card";
    button.innerHTML = `<span>● ● ● ● ●</span><div><b>${escapeHtml(show.name)}</b><small>${escapeHtml(show.description)}</small></div>`;
    button.addEventListener("click", () => applyShow(show));
    elements.showGrid.append(button);
  });
}

function renderLibrary() {
  const query = elements.librarySearch.value.trim().toLowerCase();
  const filtered = CONTENT_LIBRARY.filter((entry) => {
    if (libraryFilter === "Favorites" && !favorites.has(entry.id)) return false;
    if (!["Everything", "Favorites"].includes(libraryFilter) && entry.category !== libraryFilter) return false;
    return !query || `${entry.name} ${entry.tags} ${entry.description}`.toLowerCase().includes(query);
  });
  $("#libraryResultTitle").textContent = libraryFilter === "Everything" ? "Browse by category" : libraryFilter;
  $("#libraryCount").textContent = `${filtered.length} result${filtered.length === 1 ? "" : "s"}`;
  elements.libraryGrid.replaceChildren();
  const categoryOrder = ["Animations", "Icons", "Patterns"];
  categoryOrder.forEach((category) => {
    const entries = filtered.filter((entry) => entry.category === category);
    if (!entries.length) return;
    const section = document.createElement("section");
    section.className = "library-category-section";
    const heading = document.createElement("div");
    heading.className = "library-category-heading";
    heading.innerHTML = `<div><span>${category === "Animations" ? "SELF-PLAYING" : category === "Icons" ? "PIXEL ART" : "FULL DISPLAY"}</span><h3>${category}</h3></div><small>${entries.length} item${entries.length === 1 ? "" : "s"}</small>`;
    const grid = document.createElement("div");
    grid.className = "library-category-grid";
    entries.forEach((entry) => {
      const item = $("#libraryItemTemplate").content.firstElementChild.cloneNode(true);
      item.dataset.entryId = entry.id;
      $(".kind", item).textContent = entry.kind === "animation" ? "Animated loop" : entry.category.slice(0, -1);
      $("h4", item).textContent = entry.name;
      $("p", item).textContent = entry.description;
      const favorite = $(".favorite", item);
      favorite.textContent = favorites.has(entry.id) ? "★" : "☆";
      favorite.classList.toggle("active", favorites.has(entry.id));
      favorite.addEventListener("click", () => {
        favorites.has(entry.id) ? favorites.delete(entry.id) : favorites.add(entry.id);
        localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
        if (libraryFilter === "Favorites") renderLibrary(); else { favorite.textContent = favorites.has(entry.id) ? "★" : "☆"; favorite.classList.toggle("active", favorites.has(entry.id)); }
      });
      $(".replace", item).addEventListener("click", () => applyLibraryEntry(entry));
      $(".append", item).addEventListener("click", () => applyLibraryEntry(entry, true));
      grid.append(item);
    });
    section.append(heading, grid);
    elements.libraryGrid.append(section);
  });
  drawLibraryPreviews(performance.now(), true);
}

function drawLibraryPreviews(now, force = false) {
  if (!elements.libraryDialog.open || (!force && now - lastLibraryFrame < 120)) return;
  lastLibraryFrame = now;
  elements.libraryGrid.querySelectorAll(".library-item").forEach((item) => {
    const entry = getLibraryEntry(item.dataset.entryId);
    const rows = entryRows(entry);
    const frames = entry.kind === "animation" ? Math.max(1, Math.floor(rows[0].length / FRAME_WIDTH)) : 1;
    const frame = Math.floor(now / Math.max(90, 800 - entry.speed * 80)) % frames;
    drawLedCanvas($("canvas", item), rowsToViewport(rows, frame), 6);
  });
  elements.loadedTray.querySelectorAll(".loaded-slot").forEach((item) => {
    const slot = state.slots[Number(item.dataset.slotIndex)];
    if (slot) drawLedCanvas($("canvas", item), pixelViewport(slot, now), 4);
  });
}

function openLibrary() {
  elements.libraryNotice.classList.remove("show");
  renderLibraryFilters();
  renderShows();
  renderLibrary();
  renderLoadedTray();
  elements.libraryDialog.showModal();
  drawLibraryPreviews(performance.now(), true);
}

function updateEffectDraft() {
  const effect = $("#customEffect").value;
  const frames = Number($("#frameCount").value);
  effectDraft = createCustomAnimation(rowsForSlot(state.slots[selectedIndex]), effect, frames);
}

function openEffectLab() {
  const select = $("#customEffect");
  if (!select.options.length) CUSTOM_EFFECTS.forEach(([value, label]) => select.add(new Option(label, value)));
  $("#effectSpeed").value = state.slots[selectedIndex].speed || 5;
  $("#effectSpeedValue").textContent = $("#effectSpeed").value;
  updateEffectDraft();
  elements.animationDialog.showModal();
}

function openCreateDialog() {
  if (state.slots.length >= 8) return toast("All eight badge slots are already in use.");
  elements.createDialog.showModal();
}

function framesFromRows(rows) {
  const width = rows[0]?.length || DISPLAY_WIDTH;
  if (width >= FRAME_WIDTH && width % FRAME_WIDTH === 0) {
    return Array.from({ length: width / FRAME_WIDTH }, (_, frameIndex) => {
      const frame = blankRows(DISPLAY_WIDTH);
      for (let y = 0; y < DISPLAY_HEIGHT; y += 1) for (let x = 0; x < DISPLAY_WIDTH; x += 1) frame[y][x] = Boolean(rows[y]?.[frameIndex * FRAME_WIDTH + x]);
      return frame;
    });
  }
  const frame = blankRows(DISPLAY_WIDTH);
  const sourceWidth = rows[0]?.length || 1;
  const sourceStart = Math.max(0, Math.floor((sourceWidth - DISPLAY_WIDTH) / 2));
  const targetStart = Math.max(0, Math.floor((DISPLAY_WIDTH - sourceWidth) / 2));
  for (let y = 0; y < DISPLAY_HEIGHT; y += 1) for (let x = 0; x < Math.min(sourceWidth, DISPLAY_WIDTH); x += 1) frame[y][targetStart + x] = Boolean(rows[y]?.[sourceStart + x]);
  return [frame];
}

function openFrameStudio(createNew = false) {
  if (createNew && state.slots.length >= 8) return toast("All eight badge slots are already in use.");
  studioCreatesNew = createNew;
  studioFrames = createNew ? [blankRows(DISPLAY_WIDTH)] : framesFromRows(rowsForSlot(state.slots[selectedIndex])).slice(0, 12);
  activeStudioFrame = 0;
  studioPlaying = true;
  studioOrientation = "horizontal";
  $("#frameSpeed").value = createNew ? 5 : state.slots[selectedIndex].speed || 5;
  $("#frameSpeedValue").textContent = $("#frameSpeed").value;
  $("#onionSkin").checked = true;
  $("#onionOpacity").value = 30;
  $("#onionOpacityValue").textContent = "30%";
  $("#frameStudioTitle").textContent = createNew ? "New frame animation" : `Edit ${state.slots[selectedIndex].title || state.slots[selectedIndex].text || `slot ${selectedIndex + 1}`}`;
  $("#framePlayButton").textContent = "Ⅱ Pause";
  elements.frameStudioDialog.showModal();
  renderFrameStudio();
}

function renderFrameStudio() {
  $("#frameSequenceCount").textContent = `${studioFrames.length} frame${studioFrames.length === 1 ? "" : "s"}`;
  $("#activeFrameTitle").textContent = `Frame ${activeStudioFrame + 1}`;
  $("#frameStorageEstimate").textContent = `Animation size: ~${(64 + studioFrames.length * 66).toLocaleString()} B · ${studioFrames.length}/12 frames`;
  elements.frameSequence.className = `frame-sequence ${studioOrientation}`;
  $("#horizontalFrames").classList.toggle("active", studioOrientation === "horizontal");
  $("#verticalFrames").classList.toggle("active", studioOrientation === "vertical");
  elements.frameSequence.replaceChildren();
  studioFrames.forEach((frame, index) => {
    const card = document.createElement("button");
    card.className = `frame-card${index === activeStudioFrame ? " active" : ""}`;
    card.setAttribute("aria-label", `Edit animation frame ${index + 1}`);
    const canvas = document.createElement("canvas");
    canvas.width = 176;
    canvas.height = 44;
    const number = document.createElement("span");
    number.textContent = String(index + 1).padStart(2, "0");
    card.append(number, canvas);
    card.addEventListener("click", () => { activeStudioFrame = index; renderFrameStudio(); });
    elements.frameSequence.append(card);
    drawLedCanvas(canvas, frame, 4);
  });
  drawFrameEditor();
}

function drawFrameEditor() {
  const canvas = elements.frameEditor;
  const ctx = canvas.getContext("2d");
  const cell = canvas.width / DISPLAY_WIDTH;
  const current = studioFrames[activeStudioFrame];
  const previous = activeStudioFrame > 0 ? studioFrames[activeStudioFrame - 1] : null;
  const onion = $("#onionSkin").checked && previous;
  const onionAlpha = Number($("#onionOpacity").value) / 100;
  ctx.fillStyle = "#050202";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < DISPLAY_HEIGHT; y += 1) {
    for (let x = 0; x < DISPLAY_WIDTH; x += 1) {
      const gap = 2.5;
      const active = current[y][x];
      const ghost = onion && previous[y][x] && !active;
      ctx.fillStyle = active ? "#ff4938" : ghost ? `rgba(255,73,56,${onionAlpha})` : "#26100d";
      ctx.shadowColor = active ? "#ff2f23" : "transparent";
      ctx.shadowBlur = active ? 8 : 0;
      ctx.beginPath();
      ctx.roundRect(x * cell + gap / 2, y * cell + gap / 2, cell - gap, cell - gap, 3);
      ctx.fill();
    }
  }
  ctx.shadowBlur = 0;
}

function editStudioPixel(event) {
  const rect = elements.frameEditor.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) / rect.width * DISPLAY_WIDTH);
  const y = Math.floor((event.clientY - rect.top) / rect.height * DISPLAY_HEIGHT);
  if (x < 0 || x >= DISPLAY_WIDTH || y < 0 || y >= DISPLAY_HEIGHT) return;
  studioFrames[activeStudioFrame][y][x] = !studioEraseMode;
  drawFrameEditor();
  const cards = elements.frameSequence.querySelectorAll(".frame-card");
  const activeCard = cards[activeStudioFrame];
  if (activeCard) drawLedCanvas($("canvas", activeCard), studioFrames[activeStudioFrame], 4);
}

function addStudioFrame(copyCurrent = false) {
  if (studioFrames.length >= 12) return toast("Frame Studio supports up to 12 frames per animation.");
  const next = copyCurrent ? structuredClone(studioFrames[activeStudioFrame]) : blankRows(DISPLAY_WIDTH);
  studioFrames.splice(activeStudioFrame + 1, 0, next);
  activeStudioFrame += 1;
  renderFrameStudio();
}

function moveStudioFrame(delta) {
  const target = activeStudioFrame + delta;
  if (target < 0 || target >= studioFrames.length) return;
  [studioFrames[activeStudioFrame], studioFrames[target]] = [studioFrames[target], studioFrames[activeStudioFrame]];
  activeStudioFrame = target;
  renderFrameStudio();
}

function populateClockChoices() {
  const fill = (select, choices) => {
    select.replaceChildren(...choices.map(([value, label]) => new Option(label, value)));
  };
  fill($("#clockFont"), CLOCK_FONTS);
  fill($("#clockBorder"), CLOCK_BORDERS);
  fill($("#clockAnimation"), CLOCK_ANIMATIONS);
}

function syncClockControls() {
  $("#clockFont").value = clockSettings.font;
  $("#clockFormat").value = clockSettings.format;
  $("#clockBorder").value = clockSettings.border;
  $("#clockAnimation").value = clockSettings.animation;
  $("#clockTimezone").value = clockSettings.timezone;
  $("#clockSync").value = String(clockSettings.syncMinutes);
  $("#clockSession").value = String(clockSettings.sessionMinutes);
  $("#clockSpeed").value = String(clockSettings.speed);
  $("#clockSpeedValue").textContent = String(clockSettings.speed);
  $("#clockLeadingZero").checked = clockSettings.leadingZero;
  $("#clockMarker").checked = clockSettings.marker;
  $("#clockMarker").disabled = clockSettings.format === "24";
}

function readClockControls() {
  clockSettings = normalizeClockSettings({
    font: $("#clockFont").value,
    format: $("#clockFormat").value,
    border: $("#clockBorder").value,
    animation: $("#clockAnimation").value,
    timezone: $("#clockTimezone").value,
    syncMinutes: Number($("#clockSync").value),
    sessionMinutes: Number($("#clockSession").value),
    speed: Number($("#clockSpeed").value),
    leadingZero: $("#clockLeadingZero").checked,
    marker: $("#clockMarker").checked
  });
  $("#clockSpeedValue").textContent = String(clockSettings.speed);
  $("#clockMarker").disabled = clockSettings.format === "24";
  clockPreviewSignature = "";
  persistClockSettings();
}

function setClockSessionUi() {
  elements.clockLiveStatus.classList.toggle("active", clockActive);
  $("#startClock").disabled = clockActive || clockWriteInProgress;
  $("#stopClock").disabled = !clockActive;
  document.querySelectorAll(".clock-controls select, .clock-controls input").forEach((control) => { control.disabled = clockActive; });
}

function openClockStudio() {
  syncClockControls();
  setClockSessionUi();
  clockPreviewSignature = "";
  elements.clockDialog.showModal();
}

function renderClockPreview(now) {
  const date = new Date();
  const signature = `${Math.floor(date.getTime() / 60000)}:${JSON.stringify(clockSettings)}`;
  if (signature !== clockPreviewSignature) {
    clockPreviewFrames = createClockFrames(date, clockSettings);
    clockPreviewSignature = signature;
  }
  const interval = Math.max(130, 1100 - clockSettings.speed * 100);
  const frame = Math.floor(now / interval) % clockPreviewFrames.length;
  drawLedCanvas(elements.clockCanvas, clockPreviewFrames[frame], 12);

  const parts = clockTimeParts(date, clockSettings);
  const mark = clockSettings.format === "12" && clockSettings.marker ? parts.marker : "";
  elements.clockReadout.textContent = `${parts.hourText.trim()}:${parts.minuteText}${mark}`;
  const status = $("span", elements.clockLiveStatus);
  if (clockWriteInProgress) {
    status.textContent = "Syncing the current minute to the badge...";
  } else if (clockActive) {
    const nextSync = secondsUntilClockSync(date, clockSettings);
    const nextLabel = nextSync >= 60 ? `${Math.floor(nextSync / 60)}m ${nextSync % 60}s` : `${nextSync}s`;
    const sessionLabel = clockStopAt ? `${Math.max(1, Math.ceil((clockStopAt - Date.now()) / 60000))} min left` : "no time cap";
    status.textContent = `Live · next sync in ${nextLabel} · ${sessionLabel}${clockWakeLock ? " · screen awake" : ""}`;
  } else {
    status.textContent = clockSettings.timezone === "utc" ? "Previewing UTC" : "Previewing your local time";
  }
}

async function requestClockWakeLock() {
  if (!clockActive || document.hidden || clockWakeLock || !("wakeLock" in navigator)) return;
  try {
    clockWakeLock = await navigator.wakeLock.request("screen");
    clockWakeLock.addEventListener("release", () => { clockWakeLock = null; });
  } catch { /* Clock syncing still works when wake lock is unavailable. */ }
}

async function releaseClockWakeLock() {
  if (!clockWakeLock) return;
  const lock = clockWakeLock;
  clockWakeLock = null;
  try { await lock.release(); } catch { /* It may already be released by the browser. */ }
}

async function syncClockToBadge() {
  if (!clockActive || !connectedDevice || clockWriteInProgress) return false;
  clockWriteInProgress = true;
  setClockSessionUi();
  try {
    const date = new Date();
    const slot = createClockSlot(date, clockSettings);
    const { payload, usedBytes } = buildPayload([slot], state.brightness, date);
    await writePayload(connectedDevice, payload);
    clockLastSync = clockSyncKey(date, clockSettings);
    elements.sendTitle.textContent = "Clock Mode is live";
    elements.sendSubtitle.textContent = `${usedBytes.toLocaleString()} bytes synced. Send your playlist when you want to restore it.`;
    return true;
  } catch (error) {
    stopClock(`Clock sync failed: ${error.message}`);
    return false;
  } finally {
    clockWriteInProgress = false;
    setClockSessionUi();
  }
}

function stopClock(message = "Live clock stopped. The last synced time remains on the badge.") {
  clockActive = false;
  clockStopAt = 0;
  clockLastSync = null;
  clearInterval(clockTimer);
  clockTimer = null;
  releaseClockWakeLock();
  setClockSessionUi();
  if (message) toast(message);
}

async function clockTick() {
  if (!clockActive) return;
  if (clockStopAt && Date.now() >= clockStopAt) return stopClock("Clock session finished. Start another session whenever you need it.");
  const syncKey = clockSyncKey(new Date(), clockSettings);
  if (syncKey !== clockLastSync) await syncClockToBadge();
}

async function startClock() {
  readClockControls();
  if (!connectedDevice) await connectBadge(true);
  if (!connectedDevice) return toast("Connect the badge to start live Clock Mode.");
  if (!confirm("Start live Clock Mode? This temporarily replaces the playlist currently stored on the physical badge.")) return;
  clockActive = true;
  clockStopAt = clockSettings.sessionMinutes ? Date.now() + clockSettings.sessionMinutes * 60000 : 0;
  clockLastSync = null;
  setClockSessionUi();
  await requestClockWakeLock();
  if (!await syncClockToBadge()) return;
  clockTimer = setInterval(clockTick, 1000);
  toast(clockStopAt ? "Clock Mode started. Keep this tab open." : "Uncapped Clock Mode started. It will run until disconnected or stopped.");
}

function addClockSnapshot() {
  readClockControls();
  if (state.slots.length >= 8) return toast("All eight badge slots are already in use.");
  state.slots.push(createClockSlot(new Date(), clockSettings));
  selectedIndex = state.slots.length - 1;
  persist();
  renderSlots();
  toast("Current clock face added to the playlist as a snapshot.");
}

function animate(now) {
  const elapsed = previewRunning ? now - previewStarted : 0;
  const slot = state.slots[selectedIndex];
  if (slot) drawLedCanvas(elements.preview, pixelViewport(slot, elapsed), 12);
  const cycle = 5000;
  elements.timeline.style.width = `${previewRunning ? (elapsed % cycle) / cycle * 100 : 0}%`;
  drawLibraryPreviews(now);
  if (elements.animationDialog.open && effectDraft) {
    const frameCount = Math.floor(effectDraft[0].length / FRAME_WIDTH);
    const speed = Number($("#effectSpeed").value);
    const frame = Math.floor(now / Math.max(80, 900 - speed * 90)) % frameCount;
    drawLedCanvas(elements.effect, rowsToViewport(effectDraft, frame), 12);
  }
  if (elements.frameStudioDialog.open) {
    const speed = Number($("#frameSpeed").value);
    const frame = studioPlaying ? Math.floor(now / Math.max(90, 900 - speed * 90)) % studioFrames.length : activeStudioFrame;
    drawLedCanvas(elements.framePreview, studioFrames[frame], 12);
  }
  if (elements.clockDialog.open) renderClockPreview(now);
  requestAnimationFrame(animate);
}

async function connectBadge(prompt = true) {
  if (!("hid" in navigator)) {
    toast("Open this app in Microsoft Edge or Google Chrome to use USB.");
    return null;
  }
  try {
    const devices = prompt
      ? await navigator.hid.requestDevice({ filters: [{ vendorId: BADGE_VENDOR_ID, productId: BADGE_PRODUCT_ID }] })
      : await navigator.hid.getDevices();
    const device = devices.find((item) => item.vendorId === BADGE_VENDOR_ID && item.productId === BADGE_PRODUCT_ID);
    if (!device) return null;
    if (!device.opened) await device.open();
    setDevice(device);
    return device;
  } catch (error) {
    toast(`Could not connect: ${error.message}`);
    return null;
  }
}

function setDevice(device) {
  connectedDevice = device;
  const name = device.productName || "CH546 LED badge";
  elements.deviceStatus.innerHTML = `<i></i> ${escapeHtml(name)} connected`;
  elements.deviceStatus.classList.add("connected");
  elements.connectButton.textContent = "Reconnect";
  elements.sendDot.classList.add("connected");
  elements.sendTitle.textContent = "Badge connected";
  elements.sendSubtitle.textContent = "Your playlist is ready to upload.";
  elements.sendButton.disabled = false;
}

function disconnectDevice() {
  if (clockActive) stopClock("Badge disconnected, so live Clock Mode stopped.");
  connectedDevice = null;
  elements.deviceStatus.innerHTML = "<i></i> Badge not connected";
  elements.deviceStatus.classList.remove("connected");
  elements.sendDot.classList.remove("connected");
  elements.sendTitle.textContent = "Badge disconnected";
  elements.sendSubtitle.textContent = "Reconnect it to upload this design.";
  elements.sendButton.disabled = true;
}

async function sendToBadge() {
  if (!connectedDevice) return connectBadge(true);
  if (clockWriteInProgress) return toast("Wait for the current clock sync to finish.");
  if (clockActive) stopClock("");
  try {
    elements.sendButton.disabled = true;
    elements.sendTitle.textContent = "Uploading…";
    const { payload, usedBytes } = buildPayload(preparedSlots(), state.brightness);
    await writePayload(connectedDevice, payload, (progress) => {
      elements.sendButton.textContent = `Sending ${Math.round(progress * 100)}%`;
    });
    elements.sendTitle.textContent = "Upload complete";
    elements.sendSubtitle.textContent = `${usedBytes.toLocaleString()} bytes written. Press the badge button to choose its playback group.`;
    toast("Playlist sent to the badge.");
  } catch (error) {
    elements.sendTitle.textContent = "Upload failed";
    elements.sendSubtitle.textContent = error.message;
    toast(error.message);
  } finally {
    elements.sendButton.textContent = "Send to badge ↗";
    elements.sendButton.disabled = !connectedDevice;
  }
}

function openPixelEditor(createNew = false) {
  pixelCreatesNew = createNew;
  const current = createNew ? blankRows(DISPLAY_WIDTH) : rowsForSlot(state.slots[selectedIndex]);
  pixelDraft = blankRows(DISPLAY_WIDTH);
  for (let y = 0; y < DISPLAY_HEIGHT; y += 1) {
    for (let x = 0; x < Math.min(DISPLAY_WIDTH, current[y].length); x += 1) pixelDraft[y][x] = current[y][x];
  }
  drawLedCanvas(elements.pixel, pixelDraft, 16);
  elements.pixelDialog.showModal();
}

function editPixel(event) {
  const rect = elements.pixel.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) / rect.width * DISPLAY_WIDTH);
  const y = Math.floor((event.clientY - rect.top) / rect.height * DISPLAY_HEIGHT);
  if (x < 0 || x >= DISPLAY_WIDTH || y < 0 || y >= DISPLAY_HEIGHT) return;
  pixelDraft[y][x] = !eraseMode;
  drawLedCanvas(elements.pixel, pixelDraft, 16);
}

async function importImage(file) {
  if (!file) return;
  const image = new Image();
  image.src = URL.createObjectURL(file);
  await image.decode();
  const width = Math.max(1, Math.min(720, Math.round(image.width / image.height * DISPLAY_HEIGHT)));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = DISPLAY_HEIGHT;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, width, DISPLAY_HEIGHT);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(image, 0, 0, width, DISPLAY_HEIGHT);
  const data = ctx.getImageData(0, 0, width, DISPLAY_HEIGHT);
  const gray = Array.from({ length: DISPLAY_HEIGHT }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      const i = (y * width + x) * 4;
      return data.data[i] * .299 + data.data[i + 1] * .587 + data.data[i + 2] * .114;
    })
  );
  const rows = blankRows(width);
  for (let y = 0; y < DISPLAY_HEIGHT; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const oldValue = gray[y][x];
      const newValue = oldValue >= 128 ? 255 : 0;
      rows[y][x] = newValue > 0;
      const error = oldValue - newValue;
      if (x + 1 < width) gray[y][x + 1] += error * 7 / 16;
      if (y + 1 < DISPLAY_HEIGHT) {
        if (x > 0) gray[y + 1][x - 1] += error * 3 / 16;
        gray[y + 1][x] += error * 5 / 16;
        if (x + 1 < width) gray[y + 1][x + 1] += error / 16;
      }
    }
  }
  Object.assign(state.slots[selectedIndex], { source: "image", title: file.name, rows });
  URL.revokeObjectURL(image.src);
  persist();
  renderSlots();
  toast(`Imported ${width} × 11 monochrome pixels.`);
}

function exportPreset() {
  const blob = new Blob([JSON.stringify({ format: "BadgeBetter", version: 1, ...state }, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `badgebetter-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importPreset(file) {
  try {
    const incoming = JSON.parse(await file.text());
    if (incoming.format !== "BadgeBetter" || !incoming.slots?.length || incoming.slots.length > 8) throw new Error("Not a valid BadgeBetter preset.");
    state = { brightness: incoming.brightness || 100, scrollLock: incoming.scrollLock ?? true, slots: incoming.slots };
    selectedIndex = 0;
    persist();
    syncGlobalControls();
    syncScrollLock();
    renderSlots();
    toast("Preset loaded.");
  } catch (error) { toast(error.message); }
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function syncGlobalControls() {
  const index = Math.max(0, brightnessLevels.indexOf(state.brightness));
  elements.brightness.value = index + 1;
  elements.brightnessValue.textContent = `${state.brightness}%`;
}

$("#addSlot").addEventListener("click", openCreateDialog);
$("#newCreationButton").addEventListener("click", openCreateDialog);
$("#clockButton").addEventListener("click", openClockStudio);
$("#previousPreview").addEventListener("click", () => selectSlot((selectedIndex - 1 + state.slots.length) % state.slots.length));
$("#nextPreview").addEventListener("click", () => selectSlot((selectedIndex + 1) % state.slots.length));
$("#playPreview").addEventListener("click", (event) => {
  previewRunning = !previewRunning;
  previewStarted = performance.now();
  event.currentTarget.textContent = previewRunning ? "Ⅱ" : "▶";
  event.currentTarget.classList.toggle("active", previewRunning);
});
elements.scrollLockButton.addEventListener("click", () => {
  state.scrollLock = !state.scrollLock;
  persist();
  syncScrollLock();
});
window.addEventListener("scroll", updatePreviewDock, { passive: true });
window.addEventListener("resize", updatePreviewDock);
elements.brightness.addEventListener("input", () => {
  state.brightness = brightnessLevels[Number(elements.brightness.value) - 1];
  elements.brightnessValue.textContent = `${state.brightness}%`;
  persist();
  updateStats();
});
elements.connectButton.addEventListener("click", () => connectBadge(true));
elements.sendButton.addEventListener("click", sendToBadge);
$("#libraryButton").addEventListener("click", openLibrary);
$("#frameStudioButton").addEventListener("click", () => openFrameStudio(false));
$("#animationButton").addEventListener("click", openEffectLab);
$("#pixelButton").addEventListener("click", () => openPixelEditor(false));
$("#imageInput").addEventListener("change", (event) => importImage(event.target.files[0]));
$("#textModeButton").addEventListener("click", () => {
  Object.assign(state.slots[selectedIndex], { source: "text", title: null, rows: null });
  persist();
  renderSlots();
});
$("#clearPixels").addEventListener("click", () => { pixelDraft = blankRows(DISPLAY_WIDTH); drawLedCanvas(elements.pixel, pixelDraft, 16); });
$("#invertPixels").addEventListener("click", () => { pixelDraft = pixelDraft.map((row) => row.map((value) => !value)); drawLedCanvas(elements.pixel, pixelDraft, 16); });
$("#savePixels").addEventListener("click", () => {
  const pixelSlot = { ...makeSlot(""), source: "pixels", title: "Custom pixel frame", rows: structuredClone(pixelDraft), mode: 4 };
  if (pixelCreatesNew) {
    if (state.slots.length >= 8) return toast("All eight badge slots are in use.");
    state.slots.push(pixelSlot);
    selectedIndex = state.slots.length - 1;
  } else {
    Object.assign(state.slots[selectedIndex], pixelSlot);
  }
  persist();
  renderSlots();
});
elements.pixel.addEventListener("contextmenu", (event) => event.preventDefault());
elements.pixel.addEventListener("pointerdown", (event) => {
  isDrawing = true;
  eraseMode = event.button === 2;
  elements.pixel.setPointerCapture(event.pointerId);
  editPixel(event);
});
elements.pixel.addEventListener("pointermove", (event) => { if (isDrawing) editPixel(event); });
elements.pixel.addEventListener("pointerup", () => { isDrawing = false; });
$("#exportButton").addEventListener("click", exportPreset);
$("#importInput").addEventListener("change", (event) => importPreset(event.target.files[0]));
$("#resetButton").addEventListener("click", () => {
  if (!confirm("Reset every message and setting in this project?")) return;
  state = structuredClone(initialState);
  selectedIndex = 0;
  persist();
  syncGlobalControls();
  syncScrollLock();
  renderSlots();
});
elements.librarySearch.addEventListener("input", renderLibrary);
document.querySelectorAll(".dialog-close").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
$("#frameCount").addEventListener("input", () => {
  $("#frameCountValue").textContent = $("#frameCount").value;
  updateEffectDraft();
});
$("#customEffect").addEventListener("change", updateEffectDraft);
$("#effectSpeed").addEventListener("input", () => { $("#effectSpeedValue").textContent = $("#effectSpeed").value; });
$("#applyEffect").addEventListener("click", () => {
  const effectLabel = $("#customEffect").selectedOptions[0].textContent;
  Object.assign(state.slots[selectedIndex], {
    source: "animation",
    title: effectLabel,
    rows: structuredClone(effectDraft),
    mode: 5,
    speed: Number($("#effectSpeed").value),
    blink: false,
    ants: false
  });
  persist();
  elements.animationDialog.close();
  renderSlots();
  toast(`${effectLabel} animation created.`);
});
document.querySelectorAll("[data-create]").forEach((button) => button.addEventListener("click", () => {
  const kind = button.dataset.create;
  elements.createDialog.close();
  if (kind === "text") {
    state.slots.push(makeSlot("NEW MESSAGE"));
    selectedIndex = state.slots.length - 1;
    persist();
    renderSlots();
    toast("Text slot added. Type your message below.");
  } else if (kind === "pixels") {
    openPixelEditor(true);
  } else if (kind === "animation") {
    openFrameStudio(true);
  }
}));
$("#horizontalFrames").addEventListener("click", () => { studioOrientation = "horizontal"; renderFrameStudio(); });
$("#verticalFrames").addEventListener("click", () => { studioOrientation = "vertical"; renderFrameStudio(); });
$("#onionSkin").addEventListener("change", drawFrameEditor);
$("#onionOpacity").addEventListener("input", () => { $("#onionOpacityValue").textContent = `${$("#onionOpacity").value}%`; drawFrameEditor(); });
$("#frameSpeed").addEventListener("input", () => { $("#frameSpeedValue").textContent = $("#frameSpeed").value; });
$("#framePlayButton").addEventListener("click", () => {
  studioPlaying = !studioPlaying;
  $("#framePlayButton").textContent = studioPlaying ? "Ⅱ Pause" : "▶ Preview";
});
$("#addFrame").addEventListener("click", () => addStudioFrame(false));
$("#duplicateFrame").addEventListener("click", () => addStudioFrame(true));
$("#copyPreviousFrame").addEventListener("click", () => {
  if (activeStudioFrame === 0) return toast("Frame 1 has no previous frame to copy.");
  studioFrames[activeStudioFrame] = structuredClone(studioFrames[activeStudioFrame - 1]);
  renderFrameStudio();
});
$("#moveFrameLeft").addEventListener("click", () => moveStudioFrame(-1));
$("#moveFrameRight").addEventListener("click", () => moveStudioFrame(1));
$("#clearFrame").addEventListener("click", () => { studioFrames[activeStudioFrame] = blankRows(DISPLAY_WIDTH); renderFrameStudio(); });
$("#deleteFrame").addEventListener("click", () => {
  if (studioFrames.length === 1) return toast("An animation needs at least one frame.");
  studioFrames.splice(activeStudioFrame, 1);
  activeStudioFrame = Math.min(activeStudioFrame, studioFrames.length - 1);
  renderFrameStudio();
});
elements.frameEditor.addEventListener("contextmenu", (event) => event.preventDefault());
elements.frameEditor.addEventListener("pointerdown", (event) => {
  studioDrawing = true;
  studioEraseMode = event.button === 2;
  elements.frameEditor.setPointerCapture(event.pointerId);
  editStudioPixel(event);
});
elements.frameEditor.addEventListener("pointermove", (event) => { if (studioDrawing) editStudioPixel(event); });
elements.frameEditor.addEventListener("pointerup", () => { studioDrawing = false; });
$("#saveFrameAnimation").addEventListener("click", () => {
  const existing = state.slots[selectedIndex];
  const animationSlot = {
    ...makeSlot(""),
    source: "animation",
    title: studioCreatesNew ? "Custom frame animation" : (existing.title || `Animation: ${existing.text || `slot ${selectedIndex + 1}`}`),
    rows: combineFrames(studioFrames.map((frame) => structuredClone(frame))),
    speed: Number($("#frameSpeed").value),
    mode: 5
  };
  if (studioCreatesNew) {
    state.slots.push(animationSlot);
    selectedIndex = state.slots.length - 1;
  } else {
    state.slots[selectedIndex] = animationSlot;
  }
  persist();
  elements.frameStudioDialog.close();
  renderSlots();
  toast(`${studioFrames.length}-frame animation saved.`);
});
document.querySelectorAll(".clock-controls select, .clock-controls input").forEach((control) => control.addEventListener("input", readClockControls));
$("#clockSnapshot").addEventListener("click", addClockSnapshot);
$("#startClock").addEventListener("click", startClock);
$("#stopClock").addEventListener("click", () => stopClock());
document.addEventListener("visibilitychange", async () => {
  if (!document.hidden) {
    await requestClockWakeLock();
    clockTick();
  }
});

if ("hid" in navigator) {
  navigator.hid.addEventListener("disconnect", (event) => { if (event.device === connectedDevice) disconnectDevice(); });
  navigator.hid.addEventListener("connect", () => connectBadge(false));
  connectBadge(false);
}

populateClockChoices();
syncClockControls();
setClockSessionUi();
syncGlobalControls();
syncScrollLock();
renderSlots();
requestAnimationFrame(animate);
