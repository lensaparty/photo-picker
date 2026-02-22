import { loadSelectionState, saveSelectionState } from "./auth.js";

const fileInput = document.getElementById("fileInput");
const folderInput = document.getElementById("folderInput");
const loadBtn = document.getElementById("loadBtn");
const grid = document.getElementById("grid");
const emptyState = document.getElementById("emptyState");
const countPill = document.getElementById("countPill");
const statusFilter = document.getElementById("statusFilter");
const searchInput = document.getElementById("searchInput");
const topSearchInput = document.getElementById("topSearchInput");
const filterJpg = document.getElementById("filterJpg");
const filterRaw = document.getElementById("filterRaw");
const selectAllBtn = document.getElementById("selectAllBtn");
const clearBtn = document.getElementById("clearBtn");
const exportBtn = document.getElementById("exportBtn");
const exportBtnDock = document.getElementById("exportBtnDock");
const resetBtnDock = document.getElementById("resetBtnDock");
const pagination = document.getElementById("pagination");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const pageInfo = document.getElementById("pageInfo");
const pageSizeSelect = document.getElementById("pageSizeSelect");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const selectedMiniBadge = document.getElementById("selectedMiniBadge");
const donePickBtn = document.getElementById("donePickBtn");

const previewWrap = document.getElementById("previewWrap");
const activeLabel = document.getElementById("activeLabel");
const captionInput = document.getElementById("captionInput");
const notesInput = document.getElementById("notesInput");
const editedInput = document.getElementById("editedInput");
const pillButtons = Array.from(document.querySelectorAll(".pill-group .pill"));
const applyBtn = document.getElementById("applyBtn");
const lockBtn = document.getElementById("lockBtn");
const unlockBtn = document.getElementById("unlockBtn");
const clearActiveBtn = document.getElementById("clearActiveBtn");

const exportModal = document.getElementById("exportModal");
const closeExport = document.getElementById("closeExport");
const exportOutput = document.getElementById("exportOutput");
const copyExport = document.getElementById("copyExport");
const downloadExport = document.getElementById("downloadExport");
const limitInput = document.getElementById("limitInput");
const limitLock = document.getElementById("limitLock");
const limitInfo = document.getElementById("limitInfo");
const copyClientLinkBtn = document.getElementById("copyClientLinkBtn");
const limitBadge = document.getElementById("limitBadge");
const limitWarning = document.getElementById("limitWarning");
const albumInfo = document.getElementById("albumInfo");
const editPickToggle = document.getElementById("editPickToggle");
const albumPickToggle = document.getElementById("albumPickToggle");
const editCounter = document.getElementById("editCounter");
const albumCounter = document.getElementById("albumCounter");
const statSelected = document.getElementById("statSelected");
const statEdit = document.getElementById("statEdit");
const statAlbum = document.getElementById("statAlbum");
const progressSelected = document.getElementById("progressSelected");
const progressEdit = document.getElementById("progressEdit");
const progressAlbum = document.getElementById("progressAlbum");
const welcomeModal = document.getElementById("welcomeModal");
const welcomeClose = document.getElementById("welcomeClose");
const themeToggle = document.getElementById("themeToggle");
const batchEditBtn = document.getElementById("batchEditBtn");
const batchAlbumBtn = document.getElementById("batchAlbumBtn");
const batchClearBtn = document.getElementById("batchClearBtn");
const tagFilterButtons = Array.from(document.querySelectorAll(".filter-chip"));
const browseTabs = Array.from(document.querySelectorAll(".browse-tab"));
const workflowFilterButtons = Array.from(document.querySelectorAll(".workflow-filter .wf-chip"));
const workflowSetButtons = Array.from(document.querySelectorAll(".workflow-set .wf-chip"));
const wfTodoCount = document.getElementById("wfTodoCount");
const wfProgressCount = document.getElementById("wfProgressCount");
const wfDoneCount = document.getElementById("wfDoneCount");
const sideUserName = document.getElementById("sideUserName");
const vendorSettingsModal = document.getElementById("vendorSettingsModal");
const openVendorSettings = document.getElementById("openVendorSettings");
const closeVendorSettings = document.getElementById("closeVendorSettings");
const openSettingsBtn = document.getElementById("openSettingsBtn");
const navVendorDashboard = document.getElementById("navVendorDashboard");
const navVendorPicker = document.getElementById("navVendorPicker");
const gotoPickerBtn = document.getElementById("gotoPickerBtn");
const vendorMainLayout = document.getElementById("vendorMainLayout");
const pickerPanel = document.getElementById("pickerPanel");
const monitorPanel = document.getElementById("monitorPanel");
const dashboardQuickPanel = document.getElementById("dashboardQuickPanel");

const MODE = document.body.dataset.mode || "vendor";
document.body.classList.add(`mode-${MODE}`);
const isClientMode = MODE === "client";

const state = {
  photos: [],
  selected: new Set(),
  activeId: null,
  page: 1,
  pageSize: 24,
  limit: null,
  limitLocked: false,
  folderId: "",
  tagFilter: "all",
  workflowFilter: "all",
};

let autosaveTimer = null;
let remoteSaveTimer = null;

const DRIVE_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbyGxjzwUcW-KxKm0M5pbR1kpkViqyzBWL76T4PRzppHX5ntF5BtpRyII8T3GZlK2ulplA/exec";
const FUNCTION_ENDPOINT = "/drive-list";

const PICKED_LABEL = {
  fg: "FG",
  vendor: "Vendor",
  unassigned: "Belum",
};

const RAW_EXTENSIONS = ["cr2", "cr3", "nef", "arw", "raf", "dng", "orf", "rw2"];
const TAG_KEYWORDS = {
  potret: ["portrait", "potret", "closeup", "close-up", "headshot"],
  landscape: ["landscape", "wide", "panorama", "landskap"],
  family: ["family", "keluarga", "fam"],
  pose: ["pose", "gaya", "style"],
  outfit: ["outfit", "dress", "suit", "baju", "gaun"],
};
let metadataRenderTimer = null;

function hydrateSidebarUser() {
  if (!sideUserName) return;
  const display = (localStorage.getItem("photoPicker.userDisplay") || "").trim();
  if (display) {
    sideUserName.textContent = display;
    return;
  }
  const email = (localStorage.getItem("photoPicker.userEmail") || "").trim();
  if (!email) return;
  const name = email.split("@")[0] || email;
  sideUserName.textContent = name;
}

function getExtension(name) {
  return name.split(".").pop()?.toLowerCase() || "";
}

function isAllowedExtension(name) {
  const ext = getExtension(name);
  return ext === "jpg" || ext === "jpeg" || RAW_EXTENSIONS.includes(ext);
}

function createPhoto(file) {
  const ext = getExtension(file.name);
  const isJpg = ext === "jpg" || ext === "jpeg";
  const isRaw = RAW_EXTENSIONS.includes(ext);
  const autoTags = inferAutoTags(file.name);
  return {
    id: crypto.randomUUID(),
    name: file.name,
    url: URL.createObjectURL(file),
    thumbUrl: "",
    pickedBy: "unassigned",
    edited: false,
    caption: "",
    notes: "",
    locked: false,
    ext,
    isJpg,
    isRaw,
    autoTags,
    workflow: "todo",
    needsEdit: false,
    forAlbum: false,
  };
}

function createPhotoFromDrive(file) {
  const ext = getExtension(file.name);
  const isJpg = ext === "jpg" || ext === "jpeg";
  const isRaw = RAW_EXTENSIONS.includes(ext);
  const autoTags = inferAutoTags(file.name);
  const thumbUrl = `https://drive.google.com/thumbnail?id=${file.id}&sz=w320`;
  const fullUrl = `https://drive.google.com/thumbnail?id=${file.id}&sz=w1200`;
  return {
    id: file.id,
    name: file.name,
    url: fullUrl,
    thumbUrl,
    pickedBy: "unassigned",
    edited: false,
    caption: "",
    notes: "",
    locked: false,
    ext,
    isJpg,
    isRaw,
    autoTags,
    workflow: "todo",
    needsEdit: false,
    forAlbum: false,
  };
}

function inferAutoTags(name) {
  const lower = (name || "").toLowerCase();
  const tags = [];
  Object.entries(TAG_KEYWORDS).forEach(([tag, keywords]) => {
    if (keywords.some((key) => lower.includes(key))) tags.push(tag);
  });
  return tags;
}

function queueMetadataRender() {
  if (metadataRenderTimer) return;
  metadataRenderTimer = setTimeout(() => {
    metadataRenderTimer = null;
    renderGrid();
    if (state.activeId) setActive(state.activeId);
  }, 120);
}

function upsertOrientationTag(photo, ratio) {
  const currentTags = Array.isArray(photo.autoTags) ? photo.autoTags : [];
  const clean = currentTags.filter((tag) => tag !== "potret" && tag !== "landscape");
  if (ratio >= 1.08) clean.push("landscape");
  else if (ratio <= 0.92) clean.push("potret");
  return Array.from(new Set(clean));
}

function hydratePhotoOrientation(photo) {
  if (!photo?.isJpg || !photo?.url) return;
  const img = new Image();
  img.referrerPolicy = "no-referrer";
  img.onload = () => {
    const ratio = (img.naturalWidth || 1) / (img.naturalHeight || 1);
    const current = state.photos.find((p) => p.id === photo.id);
    if (!current) return;
    const nextTags = upsertOrientationTag(current, ratio);
    const same = JSON.stringify(nextTags) === JSON.stringify(current.autoTags || []);
    if (same) return;
    current.autoTags = nextTags;
    queueMetadataRender();
  };
  img.onerror = () => {};
  img.src = photo.thumbUrl || photo.url;
}

function hydratePhotosOrientation(list) {
  // Batasi agar tidak spawn request orientasi terlalu banyak sekaligus.
  list
    .filter((photo) => photo.isJpg)
    .slice(0, 12)
    .forEach((photo) => hydratePhotoOrientation(photo));
}

function extractFolderId(link) {
  if (!link) return "";
  const patterns = [
    /folders\/([a-zA-Z0-9_-]+)/,
    /open\?id=([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = link.match(pattern);
    if (match && match[1]) return match[1];
  }
  return "";
}

function updateCount() {
  countPill.textContent = `${state.selected.size} dipilih`;
  if (selectedMiniBadge) {
    selectedMiniBadge.textContent = `Dipilih: ${state.selected.size}`;
  }
  updateLimitInfo();
  updateAlbumInfo();
  updateCounters();
  updateWorkflowSummary();
}

function getActivePhoto() {
  return state.photos.find((photo) => photo.id === state.activeId) || null;
}

function getLimitKey(folderId) {
  return `photoPicker.limit.${folderId}`;
}

function getLimitLockKey(folderId) {
  return `photoPicker.limitLock.${folderId}`;
}

function getStateKey(folderId) {
  return `photoPicker.state.${MODE}.${folderId}`;
}

function scheduleAutosave() {
  if (!state.folderId) return;
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(saveStateForFolder, 300);
}

async function saveStateForFolder() {
  if (!state.folderId) return;
  const payload = {
    selected: Array.from(state.selected),
    photos: state.photos.map((photo) => ({
      id: photo.id,
      caption: photo.caption,
      notes: photo.notes,
      edited: photo.edited,
      pickedBy: photo.pickedBy,
      needsEdit: photo.needsEdit,
      forAlbum: photo.forAlbum,
      locked: photo.locked,
      workflow: photo.workflow || "todo",
    })),
  };
  localStorage.setItem(getStateKey(state.folderId), JSON.stringify(payload));
  if (remoteSaveTimer) clearTimeout(remoteSaveTimer);
  remoteSaveTimer = setTimeout(async () => {
    try {
      await saveSelectionState(state.folderId, MODE, payload);
    } catch (error) {
      // keep local as fallback
    }
  }, 250);
}

function applySavedPayload(payload) {
  if (!payload) return;
  try {
    if (payload.selected) {
      state.selected = new Set(payload.selected);
    }
    if (Array.isArray(payload.photos)) {
      const map = new Map(payload.photos.map((p) => [p.id, p]));
      state.photos = state.photos.map((photo) => {
        const saved = map.get(photo.id);
        if (!saved) return photo;
        return {
          ...photo,
          caption: saved.caption || "",
          notes: saved.notes || "",
          edited: !!saved.edited,
          pickedBy: saved.pickedBy || photo.pickedBy,
          needsEdit: !!saved.needsEdit,
          forAlbum: !!saved.forAlbum,
          locked: !!saved.locked,
          workflow: saved.workflow || photo.workflow || "todo",
        };
      });
    }
  } catch (error) {
    // ignore invalid payload
  }
}

async function restoreStateForFolder(folderId) {
  const raw = localStorage.getItem(getStateKey(folderId));
  if (raw) {
    try {
      applySavedPayload(JSON.parse(raw));
    } catch (error) {
      localStorage.removeItem(getStateKey(folderId));
    }
  }
  try {
    const remote = await loadSelectionState(folderId, MODE);
    if (remote) {
      applySavedPayload(remote);
      localStorage.setItem(getStateKey(folderId), JSON.stringify(remote));
    }
  } catch (error) {
    // ignore remote issue, local fallback already applied
  }
}

function updateLimitInfo() {
  if (!limitInfo) return;
  const editCount = state.photos.filter((photo) => photo.needsEdit).length;
  if (!state.limit || state.limit <= 0) {
    limitInfo.textContent = isClientMode
      ? "Batas edit belum diatur vendor."
      : "Belum ada batas edit.";
    if (limitBadge) limitBadge.textContent = "Limit: -";
    if (limitWarning) limitWarning.textContent = "";
    return;
  }
  const remaining = Math.max(0, state.limit - editCount);
  const lockLabel = state.limitLocked ? " (terkunci)" : "";
  limitInfo.textContent = `Batas edit: ${state.limit} foto${lockLabel}. Sisa: ${remaining}.`;
  if (limitBadge) {
    limitBadge.textContent = `Limit edit: ${state.limit}`;
    limitBadge.classList.toggle("warn", remaining === 0);
  }
  if (limitWarning) {
    if (editCount < state.limit) {
      limitWarning.textContent = `Edit kurang ${state.limit - editCount} foto dari batas.`;
    } else if (editCount === state.limit) {
      limitWarning.textContent = "Limit edit tercapai.";
    } else {
      limitWarning.textContent = "Melebihi limit edit (cek pilihan).";
    }
  }
}

function updateAlbumInfo() {
  if (!albumInfo) return;
  const albumCount = state.photos.filter((photo) => photo.forAlbum).length;
  const status =
    albumCount < 34
      ? `Kurang ${34 - albumCount} foto menuju target.`
      : albumCount > 37
      ? `Melebihi ${albumCount - 37} foto.`
      : "Target album terpenuhi.";
  albumInfo.textContent = `Album: ${albumCount} foto (target 34-37). ${status}`;
}

function updateCounters() {
  const editCount = state.photos.filter((photo) => photo.needsEdit).length;
  const albumCount = state.photos.filter((photo) => photo.forAlbum).length;
  const selectedCount = state.selected.size;
  if (statSelected) statSelected.textContent = String(state.selected.size);
  if (statEdit) {
    const limitLabel = state.limit && state.limit > 0 ? state.limit : 0;
    statEdit.textContent = `${editCount}/${limitLabel}`;
  }
  if (statAlbum) statAlbum.textContent = `${albumCount}/34-37`;

  if (progressSelected) {
    const total = state.photos.length || 1;
    progressSelected.style.width = `${Math.min(100, (selectedCount / total) * 100)}%`;
  }
  if (progressEdit) {
    const limit = state.limit && state.limit > 0 ? state.limit : 1;
    progressEdit.style.width = `${Math.min(100, (editCount / limit) * 100)}%`;
  }
  if (progressAlbum) {
    progressAlbum.style.width = `${Math.min(100, (albumCount / 37) * 100)}%`;
  }
  if (editCounter) {
    const limitLabel = state.limit && state.limit > 0 ? state.limit : 0;
    editCounter.textContent = `Edit: ${editCount}/${limitLabel}`;
    editCounter.classList.toggle(
      "warn",
      state.limit && state.limit > 0 && editCount > state.limit
    );
  }
  if (albumCounter) {
    albumCounter.textContent = `Album: ${albumCount}/34-37`;
    albumCounter.classList.toggle("warn", albumCount > 37 || albumCount < 34);
  }
}

function getEditCounts() {
  const currentEdit = state.photos.filter((photo) => photo.needsEdit).length;
  const willAdd = state.photos.filter(
    (photo) => state.selected.has(photo.id) && !photo.needsEdit
  ).length;
  return { currentEdit, willAdd };
}

function getAlbumCounts() {
  const currentAlbum = state.photos.filter((photo) => photo.forAlbum).length;
  const willAdd = state.photos.filter(
    (photo) => state.selected.has(photo.id) && !photo.forAlbum
  ).length;
  return { currentAlbum, willAdd };
}

function loadLimitForFolder(folderId) {
  if (!folderId) return;
  const urlParams = new URLSearchParams(window.location.search);
  const urlLimit = Number(urlParams.get("limit"));
  const urlLock = urlParams.get("lock") === "1";
  const savedLimit = Number(localStorage.getItem(getLimitKey(folderId)));
  const savedLock = localStorage.getItem(getLimitLockKey(folderId)) === "true";

  if (isClientMode && Number.isFinite(urlLimit) && urlLimit > 0) {
    state.limit = urlLimit;
    state.limitLocked = urlLock || savedLock;
  } else {
    state.limit = Number.isFinite(savedLimit) && savedLimit > 0 ? savedLimit : null;
    state.limitLocked = savedLock;
  }
  if (limitInput) {
    limitInput.value = state.limit ? String(state.limit) : "";
    limitInput.disabled = state.limitLocked && isClientMode;
  }
  if (limitLock) {
    limitLock.checked = state.limitLocked;
    limitLock.disabled = isClientMode;
  }
  updateLimitInfo();
}

function saveLimitForFolder() {
  if (!state.folderId) return;
  if (limitInput) {
    const value = Number(limitInput.value);
    state.limit = Number.isFinite(value) && value > 0 ? value : null;
    if (state.limit) {
      localStorage.setItem(getLimitKey(state.folderId), String(state.limit));
    } else {
      localStorage.removeItem(getLimitKey(state.folderId));
    }
  }
  if (limitLock) {
    state.limitLocked = limitLock.checked;
    localStorage.setItem(getLimitLockKey(state.folderId), String(state.limitLocked));
  }
  updateLimitInfo();
}

function setActive(id) {
  state.activeId = id;
  const photo = getActivePhoto();
  if (!photo) {
    previewWrap.innerHTML = `<div class="preview-placeholder">Klik foto untuk melihat preview</div>`;
    activeLabel.textContent = "Belum ada foto aktif";
    captionInput.value = "";
    notesInput.value = "";
    editedInput.checked = false;
    pillButtons.forEach((btn) => btn.classList.remove("active"));
    captionInput.disabled = false;
    notesInput.disabled = false;
    editedInput.disabled = false;
    pillButtons.forEach((btn) => (btn.disabled = false));
    applyBtn.disabled = false;
    lockBtn.disabled = state.selected.size === 0;
    unlockBtn.disabled = state.selected.size === 0;
    return;
  }

  if (photo.isJpg) {
    previewWrap.innerHTML = `<img src="${photo.url}" alt="${photo.name}" referrerpolicy="no-referrer">`;
  } else {
    previewWrap.innerHTML = `<div class="preview-placeholder">Preview RAW tidak tersedia di browser.</div>`;
  }
  activeLabel.textContent = photo.name;
  captionInput.value = photo.caption;
  notesInput.value = photo.notes;
  editedInput.checked = photo.edited;
  pillButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.picked === photo.pickedBy);
  });
  if (editPickToggle) editPickToggle.checked = photo.needsEdit;
  if (albumPickToggle) albumPickToggle.checked = photo.forAlbum;

  const isLocked = photo.locked;
  captionInput.disabled = isLocked;
  notesInput.disabled = isLocked;
  editedInput.disabled = isLocked;
  pillButtons.forEach((btn) => (btn.disabled = isLocked));
  applyBtn.disabled = isLocked;
  lockBtn.disabled = isLocked || state.selected.size === 0;
  unlockBtn.disabled = !isLocked && state.selected.size === 0;
}

function applyEditsToSelected() {
  if (state.selected.size === 0) return;
  const picked = pillButtons.find((btn) => btn.classList.contains("active"))?.dataset.picked;
  const wantsEdit = editPickToggle ? editPickToggle.checked : false;
  const wantsAlbum = albumPickToggle ? albumPickToggle.checked : false;
  if (wantsEdit && state.limit && state.limit > 0) {
    const { currentEdit, willAdd } = getEditCounts();
    if (currentEdit + willAdd > state.limit) {
      alert("Batas edit sudah tercapai. Kurangi pilihan edit.");
      return;
    }
  }
  if (wantsAlbum) {
    const { currentAlbum, willAdd } = getAlbumCounts();
    if (currentAlbum + willAdd > 37) {
      alert("Batas album maksimal 37 foto. Kurangi pilihan album.");
      return;
    }
  }
  state.photos = state.photos.map((photo) => {
    if (!state.selected.has(photo.id) || photo.locked) return photo;
    return {
      ...photo,
      caption: captionInput.value,
      notes: notesInput.value,
      edited: editedInput.checked,
      pickedBy: picked || photo.pickedBy,
      needsEdit: wantsEdit,
      forAlbum: wantsAlbum,
    };
  });
  renderGrid();
  setActive(state.activeId);
  if (isClientMode) {
    alert(
      "Foto sudah ditandai. Silakan klik Export Terpilih, copy hasilnya, lalu kirim ke vendor/FG via WA."
    );
  } else {
    alert(
      "Foto sudah ditandai. Silakan Export Terpilih lalu kirim ke vendor/FG."
    );
  }
  scheduleAutosave();
}

function applyBatchTags({ edit, album }) {
  if (state.selected.size === 0) return;

  if (edit && state.limit && state.limit > 0) {
    const { currentEdit, willAdd } = getEditCounts();
    if (currentEdit + willAdd > state.limit) {
      alert("Batas edit sudah tercapai. Kurangi pilihan edit.");
      return;
    }
  }
  if (album) {
    const { currentAlbum, willAdd } = getAlbumCounts();
    if (currentAlbum + willAdd > 37) {
      alert("Batas album maksimal 37 foto. Kurangi pilihan album.");
      return;
    }
  }

  state.photos = state.photos.map((photo) => {
    if (!state.selected.has(photo.id) || photo.locked) return photo;
    return {
      ...photo,
      needsEdit: edit,
      forAlbum: album,
    };
  });
  renderGrid();
  setActive(state.activeId);
  scheduleAutosave();
}

function updateWorkflowSummary() {
  if (!wfTodoCount && !wfProgressCount && !wfDoneCount) return;
  const selectedPhotos = state.photos.filter((photo) => state.selected.has(photo.id));
  const src = selectedPhotos.length ? selectedPhotos : state.photos;
  const todo = src.filter((p) => (p.workflow || "todo") === "todo").length;
  const progress = src.filter((p) => (p.workflow || "todo") === "progress").length;
  const done = src.filter((p) => (p.workflow || "todo") === "done").length;
  if (wfTodoCount) wfTodoCount.textContent = String(todo);
  if (wfProgressCount) wfProgressCount.textContent = String(progress);
  if (wfDoneCount) wfDoneCount.textContent = String(done);
}

function matchesFilter(photo) {
  if (!isClientMode) {
    const filter = statusFilter.value;
    if (filter === "fg" && photo.pickedBy !== "fg") return false;
    if (filter === "vendor" && photo.pickedBy !== "vendor") return false;
    if (filter === "unassigned" && photo.pickedBy !== "unassigned") return false;
  }
  const keyword = searchInput.value.trim().toLowerCase();
  if (keyword && !photo.name.toLowerCase().includes(keyword)) return false;
  const allowJpg = filterJpg.checked;
  const allowRaw = filterRaw.checked;
  if (!allowJpg && !allowRaw) return false;
  if (photo.isJpg && !allowJpg) return false;
  if (photo.isRaw && !allowRaw) return false;
  if (!photo.isJpg && !photo.isRaw) return false;
  if (state.tagFilter !== "all") {
    if (!Array.isArray(photo.autoTags) || !photo.autoTags.includes(state.tagFilter)) {
      return false;
    }
  }
  if (state.workflowFilter !== "all" && (photo.workflow || "todo") !== state.workflowFilter) {
    return false;
  }
  return true;
}

function renderGrid() {
  grid.innerHTML = "";
  grid.classList.add("visual-first-grid");
  const visible = state.photos.filter(matchesFilter);

  emptyState.style.display = state.photos.length === 0 ? "block" : "none";
  const totalPages = Math.max(1, Math.ceil(visible.length / state.pageSize));
  if (state.page > totalPages) state.page = totalPages;
  const startIndex = isClientMode ? 0 : (state.page - 1) * state.pageSize;
  const endIndex = isClientMode ? state.page * state.pageSize : startIndex + state.pageSize;
  const pageItems = visible.slice(startIndex, endIndex);
  pagination.classList.toggle("hidden", visible.length === 0);
  pageInfo.textContent = `Halaman ${state.page} / ${totalPages}`;
  prevPageBtn.disabled = state.page <= 1;
  nextPageBtn.disabled = state.page >= totalPages;
  if (loadMoreBtn) {
    const hasMore = visible.length > pageItems.length;
    loadMoreBtn.style.display = hasMore ? "inline-flex" : "none";
  }

  pageItems.forEach((photo) => {
    const card = document.createElement("div");
    card.className = "card";
    const hasPortraitTag = (photo.autoTags || []).includes("potret");
    const hasLandscapeTag = (photo.autoTags || []).includes("landscape");
    if (hasPortraitTag) card.classList.add("portrait");
    if (hasLandscapeTag) card.classList.add("landscape");
    if (!hasPortraitTag && !hasLandscapeTag) card.classList.add("square");
    if (state.selected.has(photo.id)) card.classList.add("selected");

    const thumbHtml = photo.isJpg
      ? `<img src="${photo.thumbUrl || photo.url}" alt="${photo.name}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
      : `<div class="thumb-placeholder">RAW</div>`;
    const compactBadges = [];
    compactBadges.push(PICKED_LABEL[photo.pickedBy]);
    const workflowLabel =
      (photo.workflow || "todo") === "done"
        ? "Done"
        : (photo.workflow || "todo") === "progress"
          ? "On Progress"
          : "To Do";
    compactBadges.push(workflowLabel);
    if (photo.forAlbum) compactBadges.push("Album");
    else if (photo.needsEdit) compactBadges.push("Edit");
    else if (photo.edited) compactBadges.push("Edited");
    if (photo.isRaw) compactBadges.push("RAW");
    const autoTag = (photo.autoTags || [])[0];
    if (autoTag) compactBadges.push(autoTag);
    card.innerHTML = `
      ${thumbHtml}
      <div class="meta">
        <strong>${photo.name}</strong>
        <div class="badges">
          ${compactBadges.slice(0, 3).map((tag) => `<span class="badge">${tag}</span>`).join("")}
          ${photo.locked ? `<span class="badge">Locked</span>` : ""}
        </div>
      </div>
    `;

    card.addEventListener("click", () => {
      if (state.selected.has(photo.id)) {
        state.selected.delete(photo.id);
      } else {
        state.selected.add(photo.id);
      }
      setActive(photo.id);
      updateCount();
      renderGrid();
      scheduleAutosave();
    });

    grid.appendChild(card);
  });
  updateWorkflowSummary();
}

function resetAll() {
  const prevFolder = state.folderId;
  state.photos.forEach((photo) => URL.revokeObjectURL(photo.url));
  state.photos = [];
  state.selected.clear();
  state.activeId = null;
  state.page = 1;
  state.folderId = "";
  state.limit = null;
  state.limitLocked = false;
  if (prevFolder) {
    localStorage.removeItem(getStateKey(prevFolder));
  }
  updateCount();
  renderGrid();
  setActive(null);
}

fileInput.addEventListener("change", (event) => {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  const photos = files.map(createPhoto);
  state.photos = state.photos.concat(photos);
  if (!state.activeId && photos.length) {
    state.activeId = photos[0].id;
  }
  state.page = 1;
  renderGrid();
  updateCount();
  setActive(state.activeId);
  hydratePhotosOrientation(photos);
  fileInput.value = "";
});

function loadFromDriveJSONP(folderId) {
  return new Promise((resolve, reject) => {
    const callbackName = `driveCallback_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const script = document.createElement("script");
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timeout saat mengambil data folder."));
    }, 30000);

    function cleanup() {
      clearTimeout(timeout);
      script.remove();
      delete window[callbackName];
    }

    window[callbackName] = (payload) => {
      cleanup();
      resolve(payload);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Gagal memuat script JSONP."));
    };

    const url = `${DRIVE_ENDPOINT}?folderId=${encodeURIComponent(folderId)}&callback=${callbackName}`;
    script.src = url;
    document.body.appendChild(script);
  });
}

async function loadFromDriveFunction(folderId) {
  const response = await fetch(
    `${FUNCTION_ENDPOINT}?folderId=${encodeURIComponent(folderId)}`
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text.slice(0, 200));
  }
  return response.json();
}

async function loadDriveData(folderId) {
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return loadFromDriveJSONP(folderId);
  }
  return loadFromDriveFunction(folderId);
}

async function loadFromFolderId(folderId) {
  if (!folderId) return false;

  loadBtn.disabled = true;
  loadBtn.textContent = "Memuat...";
  try {
    const payload = await loadDriveData(folderId);
    const files = Array.isArray(payload.files) ? payload.files : [];
    const filtered = files.filter((file) => isAllowedExtension(file.name || ""));
    const photos = filtered.map(createPhotoFromDrive);
    state.photos = photos;
    state.selected.clear();
    state.activeId = photos[0]?.id || null;
    state.folderId = folderId;
    loadLimitForFolder(folderId);
    await restoreStateForFolder(folderId);
    state.page = 1;
    renderGrid();
    updateCount();
    setActive(state.activeId);
    hydratePhotosOrientation(photos);
    return true;
  } catch (error) {
    alert(
      "Tidak bisa mengambil isi folder. Pastikan link publik, Apps Script sudah di-deploy sebagai Web App (Anyone), dan function endpoint aktif.\n\nDetail: " +
        error.message
    );
    return false;
  } finally {
    loadBtn.disabled = false;
    loadBtn.textContent = "Ambil Foto";
  }
}

loadBtn.addEventListener("click", async () => {
  const folderId = extractFolderId(folderInput.value.trim());
  if (!folderId) {
    alert("Link folder Google Drive tidak valid.");
    return;
  }
  await loadFromFolderId(folderId);
});

if (statusFilter) {
  statusFilter.addEventListener("change", () => {
    state.page = 1;
    renderGrid();
  });
}
searchInput.addEventListener("input", () => {
  if (topSearchInput && topSearchInput.value !== searchInput.value) {
    topSearchInput.value = searchInput.value;
  }
  state.page = 1;
  renderGrid();
});
if (topSearchInput) {
  topSearchInput.addEventListener("input", () => {
    if (searchInput.value !== topSearchInput.value) {
      searchInput.value = topSearchInput.value;
    }
    state.page = 1;
    renderGrid();
  });
}
if (tagFilterButtons.length) {
  tagFilterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.tagFilter = btn.dataset.tagFilter || "all";
      tagFilterButtons.forEach((chip) => chip.classList.remove("active"));
      btn.classList.add("active");
      const label = state.tagFilter === "all" ? "unggulan" : state.tagFilter;
      browseTabs.forEach((tab) => {
        const isActive = (tab.textContent || "").trim().toLowerCase() === label;
        tab.classList.toggle("active", isActive);
      });
      state.page = 1;
      renderGrid();
    });
  });
}

if (browseTabs.length) {
  browseTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const key = (tab.textContent || "").trim().toLowerCase();
      const map = {
        unggulan: "all",
        potret: "potret",
        landscape: "landscape",
        family: "family",
        pose: "pose",
        outfit: "outfit",
      };
      const target = map[key] || "all";
      state.tagFilter = target;
      browseTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      tagFilterButtons.forEach((chip) => {
        chip.classList.toggle("active", (chip.dataset.tagFilter || "all") === target);
      });
      render();
    });
  });
}
if (workflowFilterButtons.length) {
  workflowFilterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.workflowFilter = btn.dataset.workflowFilter || "all";
      workflowFilterButtons.forEach((chip) => chip.classList.remove("active"));
      btn.classList.add("active");
      state.page = 1;
      renderGrid();
    });
  });
}

if (workflowSetButtons.length) {
  workflowSetButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (state.selected.size === 0) {
        alert("Pilih foto dulu.");
        return;
      }
      const workflow = btn.dataset.workflowSet || "todo";
      state.photos = state.photos.map((photo) => {
        if (!state.selected.has(photo.id) || photo.locked) return photo;
        return { ...photo, workflow };
      });
      workflowSetButtons.forEach((chip) => chip.classList.remove("active"));
      btn.classList.add("active");
      renderGrid();
      setActive(state.activeId);
      scheduleAutosave();
    });
  });
}
filterJpg.addEventListener("change", () => {
  state.page = 1;
  renderGrid();
});
filterRaw.addEventListener("change", () => {
  state.page = 1;
  renderGrid();
});

selectAllBtn.addEventListener("click", () => {
  const visible = state.photos.filter(matchesFilter);
  const startIndex = (state.page - 1) * state.pageSize;
  const pageItems = visible.slice(startIndex, startIndex + state.pageSize);
  const allSelected = pageItems.every((photo) => state.selected.has(photo.id));
  if (allSelected) {
    pageItems.forEach((photo) => state.selected.delete(photo.id));
  } else {
    pageItems.forEach((photo) => state.selected.add(photo.id));
  }
  updateCount();
  renderGrid();
  setActive(state.activeId);
  scheduleAutosave();
});

pillButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    pillButtons.forEach((pill) => pill.classList.remove("active"));
    btn.classList.add("active");
    const active = getActivePhoto();
    if (active && !active.locked) {
      active.pickedBy = btn.dataset.picked;
      renderGrid();
      scheduleAutosave();
    }
  });
});

applyBtn.addEventListener("click", applyEditsToSelected);

function setLockForSelected(locked) {
  if (state.selected.size === 0) return;
  state.photos = state.photos.map((photo) => {
    if (!state.selected.has(photo.id)) return photo;
    return { ...photo, locked };
  });
  renderGrid();
  setActive(state.activeId);
  scheduleAutosave();
}

lockBtn.addEventListener("click", () => setLockForSelected(true));
unlockBtn.addEventListener("click", () => setLockForSelected(false));

clearActiveBtn.addEventListener("click", () => {
  if (!state.activeId) return;
  state.selected.delete(state.activeId);
  state.activeId = null;
  setActive(null);
  updateCount();
  renderGrid();
  scheduleAutosave();
});

clearBtn.addEventListener("click", () => {
  const shouldClear = confirm("Reset semua foto dan pilihan?");
  if (!shouldClear) return;
  resetAll();
});

exportBtn.addEventListener("click", () => {
  const selected = state.photos.filter((photo) => state.selected.has(photo.id));
  if (selected.length === 0) {
    exportOutput.value = "Belum ada foto terpilih.";
  } else {
    const albumCount = state.photos.filter((photo) => photo.forAlbum).length;
    const editCount = state.photos.filter((photo) => photo.needsEdit).length;
    const albumWarning =
      albumCount < 34
        ? `\n\n[PERINGATAN] Album kurang ${34 - albumCount} foto dari target.`
        : albumCount > 37
        ? `\n\n[PERINGATAN] Album melebihi ${albumCount - 37} foto.`
        : "";
    const editWarning =
      state.limit && state.limit > 0
        ? `\n\n[INFO] Edit: ${editCount}/${state.limit} foto.`
        : "";
    const lines = selected.map((photo, index) => {
      const label = isClientMode ? "Client" : PICKED_LABEL[photo.pickedBy];
      const edited = photo.edited ? "Edited" : "Belum edit";
      const caption = photo.caption ? `Caption: ${photo.caption}` : "Caption: -";
      const notes = photo.notes ? `Catatan: ${photo.notes}` : "Catatan: -";
      const statusLine = isClientMode
        ? `Dipilih: ${label}`
        : `Status: ${label} | ${edited}`;
      const extra = [
        photo.needsEdit ? "Untuk Edit" : null,
        photo.forAlbum ? "Masuk Album" : null,
      ].filter(Boolean).join(", ");
      const extraLine = extra ? `Tag: ${extra}` : "Tag: -";
      return `${index + 1}. ${photo.name}\n${statusLine}\n${extraLine}\n${caption}\n${notes}\n`;
    });
    exportOutput.value = lines.join("\n") + albumWarning + editWarning;
  }
  exportModal.classList.remove("hidden");
});

if (exportBtnDock) {
  exportBtnDock.addEventListener("click", () => {
    exportBtn.click();
  });
}

if (resetBtnDock) {
  resetBtnDock.addEventListener("click", () => {
    clearBtn.click();
  });
}

closeExport.addEventListener("click", () => {
  exportModal.classList.add("hidden");
});

copyExport.addEventListener("click", async () => {
  await navigator.clipboard.writeText(exportOutput.value);
});

downloadExport.addEventListener("click", () => {
  const blob = new Blob([exportOutput.value], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "selected-photos.txt";
  a.click();
  URL.revokeObjectURL(url);
});

prevPageBtn.addEventListener("click", () => {
  if (state.page > 1) {
    state.page -= 1;
    renderGrid();
  }
});

nextPageBtn.addEventListener("click", () => {
  state.page += 1;
  renderGrid();
});

if (loadMoreBtn) {
  loadMoreBtn.addEventListener("click", () => {
    state.page += 1;
    renderGrid();
  });
}

if (donePickBtn) {
  donePickBtn.addEventListener("click", () => {
    exportBtn.click();
  });
}

pageSizeSelect.addEventListener("change", () => {
  state.pageSize = Number(pageSizeSelect.value);
  state.page = 1;
  renderGrid();
});

if (limitInput) {
  limitInput.addEventListener("change", () => {
    if (isClientMode) return;
    saveLimitForFolder();
  });
}

if (limitLock) {
  limitLock.addEventListener("change", () => {
    if (isClientMode) return;
    saveLimitForFolder();
  });
}

if (copyClientLinkBtn) {
  copyClientLinkBtn.addEventListener("click", async () => {
    if (!state.limit || state.limit <= 0) {
      alert("Isi batas pilihan dulu sebelum copy link client.");
      return;
    }
    const url = new URL(window.location.href);
    url.pathname = url.pathname.replace(/\/vendor\.html$/, "/client.html");
    url.searchParams.set("limit", String(state.limit));
    url.searchParams.set("lock", "1");
    await navigator.clipboard.writeText(url.toString());
    alert("Link client dengan limit sudah dicopy.");
  });
}

function applyClientSelection(text) {
  if (!text) return;
  const names = new Set();
  const tagMap = new Map();
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const numbered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (numbered) {
      const name = numbered[1].trim();
      names.add(name);
      tagMap.set(name, { needsEdit: false, forAlbum: false });
      return;
    }
    if (trimmed.startsWith("Tag:")) {
      const lastName = Array.from(names).slice(-1)[0];
      if (lastName) {
        const tags = trimmed.replace("Tag:", "").toLowerCase();
        const current = tagMap.get(lastName) || { needsEdit: false, forAlbum: false };
        current.needsEdit = tags.includes("edit");
        current.forAlbum = tags.includes("album");
        tagMap.set(lastName, current);
      }
      return;
    }
    if (trimmed.includes(".") && !trimmed.includes("Status:")) {
      names.add(trimmed);
    }
  });

  if (names.size === 0) return;
  state.selected.clear();
  state.photos.forEach((photo) => {
    if (names.has(photo.name)) {
      state.selected.add(photo.id);
      const tags = tagMap.get(photo.name);
      if (tags) {
        photo.needsEdit = tags.needsEdit;
        photo.forAlbum = tags.forAlbum;
      }
    }
  });
  updateCount();
  renderGrid();
  setActive(state.activeId);
  scheduleAutosave();
}

hydrateSidebarUser();
renderGrid();
setActive(null);
updateCount();

if (welcomeModal && welcomeClose) {
  welcomeClose.addEventListener("click", () => {
    welcomeModal.classList.add("hidden");
  });
}

if (themeToggle) {
  const key = "photoPicker.theme";
  const saved = localStorage.getItem(key) || "light";
  document.body.setAttribute("data-theme", saved);
  themeToggle.textContent = saved === "dark" ? "Light" : "Dark";

  themeToggle.addEventListener("click", () => {
    const next = document.body.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.body.setAttribute("data-theme", next);
    localStorage.setItem(key, next);
    themeToggle.textContent = next === "dark" ? "Light" : "Dark";
  });
}

if (isClientMode) {
  try {
    const raw = localStorage.getItem("photoPicker.clientProfile");
    if (raw) {
      const profile = JSON.parse(raw);
      if (profile?.driveLink && folderInput && !folderInput.value) {
        folderInput.value = profile.driveLink;
        const folderId = extractFolderId(profile.driveLink);
        if (folderId) {
          loadFromFolderId(folderId);
        }
      }
      if (profile?.name) {
        const info = document.getElementById("limitInfo");
        if (info && info.textContent.includes("Batas edit belum diatur vendor")) {
          info.textContent = `Klien: ${profile.name}. Batas edit mengikuti vendor.`;
        }
      }
      if (profile?.weddingDate && albumInfo) {
        albumInfo.textContent = `Album: 0 foto (target 34-37). Tanggal pernikahan: ${profile.weddingDate}`;
      }
    }
  } catch (error) {
    // ignore malformed local cache
  }
}

if (batchEditBtn) {
  batchEditBtn.addEventListener("click", () => applyBatchTags({ edit: true, album: false }));
}
if (batchAlbumBtn) {
  batchAlbumBtn.addEventListener("click", () => applyBatchTags({ edit: false, album: true }));
}
if (batchClearBtn) {
  batchClearBtn.addEventListener("click", () => applyBatchTags({ edit: false, album: false }));
}


if (editPickToggle) {
  editPickToggle.addEventListener("change", () => {
    if (editPickToggle.checked) {
      if (state.limit && state.limit > 0) {
        const { currentEdit, willAdd } = getEditCounts();
        if (currentEdit + willAdd > state.limit) {
          editPickToggle.checked = false;
          alert("Batas edit sudah tercapai. Kurangi pilihan edit.");
        }
      }
    }
    scheduleAutosave();
  });
}

if (albumPickToggle) {
  albumPickToggle.addEventListener("change", () => {
    if (albumPickToggle.checked) {
      const { currentAlbum, willAdd } = getAlbumCounts();
      if (currentAlbum + willAdd > 37) {
        albumPickToggle.checked = false;
        alert("Batas album maksimal 37 foto. Kurangi pilihan album.");
      }
    }
    scheduleAutosave();
  });
}

if (vendorSettingsModal) {
  const openSettings = () => vendorSettingsModal.classList.remove("hidden");
  const closeSettings = () => vendorSettingsModal.classList.add("hidden");
  openVendorSettings?.addEventListener("click", openSettings);
  openSettingsBtn?.addEventListener("click", openSettings);
  closeVendorSettings?.addEventListener("click", closeSettings);
  vendorSettingsModal.addEventListener("click", (event) => {
    if (event.target === vendorSettingsModal) {
      closeSettings();
    }
  });
}

function setVendorView(view) {
  if (isClientMode || !vendorMainLayout || !pickerPanel || !monitorPanel || !dashboardQuickPanel) return;
  const isDashboard = view !== "picker";
  pickerPanel.style.display = isDashboard ? "none" : "";
  monitorPanel.style.display = isDashboard ? "" : "none";
  dashboardQuickPanel.style.display = isDashboard ? "" : "none";
  vendorMainLayout.classList.toggle("single-col", !isDashboard);
  navVendorDashboard?.classList.toggle("active", isDashboard);
  navVendorPicker?.classList.toggle("active", !isDashboard);
  localStorage.setItem("photoPicker.vendorView", isDashboard ? "dashboard" : "picker");
}

if (!isClientMode && navVendorDashboard && navVendorPicker) {
  navVendorDashboard.addEventListener("click", () => setVendorView("dashboard"));
  navVendorPicker.addEventListener("click", () => setVendorView("picker"));
  gotoPickerBtn?.addEventListener("click", () => setVendorView("picker"));
  const savedView = localStorage.getItem("photoPicker.vendorView") || "dashboard";
  setVendorView(savedView);
}
