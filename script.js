const fileInput = document.getElementById("fileInput");
const folderInput = document.getElementById("folderInput");
const loadBtn = document.getElementById("loadBtn");
const grid = document.getElementById("grid");
const emptyState = document.getElementById("emptyState");
const countPill = document.getElementById("countPill");
const statusFilter = document.getElementById("statusFilter");
const searchInput = document.getElementById("searchInput");
const filterJpg = document.getElementById("filterJpg");
const filterRaw = document.getElementById("filterRaw");
const selectAllBtn = document.getElementById("selectAllBtn");
const clearBtn = document.getElementById("clearBtn");
const exportBtn = document.getElementById("exportBtn");
const pagination = document.getElementById("pagination");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const pageInfo = document.getElementById("pageInfo");
const pageSizeSelect = document.getElementById("pageSizeSelect");

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
const importInput = document.getElementById("importInput");
const importBtn = document.getElementById("importBtn");
const copyClientLinkBtn = document.getElementById("copyClientLinkBtn");
const limitBadge = document.getElementById("limitBadge");
const limitWarning = document.getElementById("limitWarning");
const albumInfo = document.getElementById("albumInfo");
const editPickToggle = document.getElementById("editPickToggle");
const albumPickToggle = document.getElementById("albumPickToggle");
const editCounter = document.getElementById("editCounter");
const albumCounter = document.getElementById("albumCounter");
const welcomeModal = document.getElementById("welcomeModal");
const welcomeClose = document.getElementById("welcomeClose");
const pinModal = document.getElementById("pinModal");
const pinInput = document.getElementById("pinInput");
const pinSubmit = document.getElementById("pinSubmit");
const pinHelp = document.getElementById("pinHelp");
const pinMessage = document.getElementById("pinMessage");
const pinSetInput = document.getElementById("pinSetInput");
const pinSetBtn = document.getElementById("pinSetBtn");
const pinResetBtn = document.getElementById("pinResetBtn");

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
};

let autosaveTimer = null;

const DRIVE_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbyGxjzwUcW-KxKm0M5pbR1kpkViqyzBWL76T4PRzppHX5ntF5BtpRyII8T3GZlK2ulplA/exec";
const FUNCTION_ENDPOINT = "/.netlify/functions/drive-list";

const PICKED_LABEL = {
  fg: "FG",
  vendor: "Vendor",
  unassigned: "Belum",
};

const RAW_EXTENSIONS = ["cr2", "cr3", "nef", "arw", "raf", "dng", "orf", "rw2"];

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
    needsEdit: false,
    forAlbum: false,
  };
}

function createPhotoFromDrive(file) {
  const ext = getExtension(file.name);
  const isJpg = ext === "jpg" || ext === "jpeg";
  const isRaw = RAW_EXTENSIONS.includes(ext);
  const thumbUrl = `https://drive.google.com/thumbnail?id=${file.id}&sz=w600`;
  const fullUrl = `https://drive.google.com/thumbnail?id=${file.id}&sz=w1600`;
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
    needsEdit: false,
    forAlbum: false,
  };
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
  updateLimitInfo();
  updateAlbumInfo();
  updateCounters();
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

function saveStateForFolder() {
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
    })),
  };
  localStorage.setItem(getStateKey(state.folderId), JSON.stringify(payload));
}

function restoreStateForFolder(folderId) {
  const raw = localStorage.getItem(getStateKey(folderId));
  if (!raw) return;
  try {
    const payload = JSON.parse(raw);
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
        };
      });
    }
  } catch (error) {
    localStorage.removeItem(getStateKey(folderId));
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
  return true;
}

function renderGrid() {
  grid.innerHTML = "";
  const visible = state.photos.filter(matchesFilter);

  emptyState.style.display = state.photos.length === 0 ? "block" : "none";
  const totalPages = Math.max(1, Math.ceil(visible.length / state.pageSize));
  if (state.page > totalPages) state.page = totalPages;
  const startIndex = (state.page - 1) * state.pageSize;
  const pageItems = visible.slice(startIndex, startIndex + state.pageSize);
  pagination.classList.toggle("hidden", visible.length === 0);
  pageInfo.textContent = `Halaman ${state.page} / ${totalPages}`;
  prevPageBtn.disabled = state.page <= 1;
  nextPageBtn.disabled = state.page >= totalPages;

  pageItems.forEach((photo) => {
    const card = document.createElement("div");
    card.className = "card";
    if (state.selected.has(photo.id)) card.classList.add("selected");

    const thumbHtml = photo.isJpg
      ? `<img src="${photo.thumbUrl || photo.url}" alt="${photo.name}" referrerpolicy="no-referrer">`
      : `<div class="thumb-placeholder">RAW</div>`;
    card.innerHTML = `
      ${thumbHtml}
      <div class="meta">
        <strong>${photo.name}</strong>
        <div class="badges">
          <span class="badge">${PICKED_LABEL[photo.pickedBy]}</span>
          ${photo.edited ? `<span class="badge">Edited</span>` : ""}
          ${photo.caption ? `<span class="badge">Caption</span>` : ""}
          ${photo.locked ? `<span class="badge">Locked</span>` : ""}
          ${photo.isRaw ? `<span class="badge">RAW</span>` : ""}
          ${photo.needsEdit ? `<span class="badge">Edit</span>` : ""}
          ${photo.forAlbum ? `<span class="badge">Album</span>` : ""}
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

loadBtn.addEventListener("click", async () => {
  const folderId = extractFolderId(folderInput.value.trim());
  if (!folderId) {
    alert("Link folder Google Drive tidak valid.");
    return;
  }

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
    restoreStateForFolder(folderId);
    state.page = 1;
    renderGrid();
    updateCount();
    setActive(state.activeId);
  } catch (error) {
    alert(
      "Tidak bisa mengambil isi folder. Pastikan link publik, Apps Script sudah di-deploy sebagai Web App (Anyone), dan Netlify Function aktif.\n\nDetail: " +
        error.message
    );
  } finally {
    loadBtn.disabled = false;
    loadBtn.textContent = "Ambil Foto";
  }
});

if (statusFilter) {
  statusFilter.addEventListener("change", () => {
    state.page = 1;
    renderGrid();
  });
}
searchInput.addEventListener("input", () => {
  state.page = 1;
  renderGrid();
});
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

if (importBtn) {
  importBtn.addEventListener("click", () => {
    applyClientSelection(importInput.value);
  });
}

renderGrid();
setActive(null);
updateCount();

if (welcomeModal && welcomeClose) {
  welcomeClose.addEventListener("click", () => {
    welcomeModal.classList.add("hidden");
  });
}

function getPinKey() {
  return "photoPicker.vendorPin";
}

function requireVendorPin() {
  if (isClientMode || !pinModal) return;
  const params = new URLSearchParams(window.location.search);
  const urlPin = params.get("pin");
  const storedPin = localStorage.getItem(getPinKey());

  if (urlPin) {
    localStorage.setItem(getPinKey(), urlPin);
    return;
  }

  if (!storedPin) {
    return;
  }

  pinModal.classList.remove("hidden");
  if (pinMessage && storedPin) {
    pinMessage.textContent = "";
  }
}

requireVendorPin();

if (pinSubmit) {
  pinSubmit.addEventListener("click", () => {
    const storedPin = localStorage.getItem(getPinKey());
    if (!storedPin) {
      if (pinMessage) {
        pinMessage.textContent =
          "Belum ada PIN. Tambahkan ?pin=1234 sekali di URL vendor untuk set PIN.";
      }
      return;
    }
    if (pinInput.value === storedPin) {
      pinModal.classList.add("hidden");
      pinInput.value = "";
      if (pinMessage) pinMessage.textContent = "";
      return;
    }
    if (pinMessage) pinMessage.textContent = "PIN salah. Coba lagi.";
  });
}

if (pinHelp) {
  pinHelp.addEventListener("click", () => {
    if (pinMessage) {
      pinMessage.textContent =
        "Cara set PIN: buka vendor.html?pin=1234 lalu refresh. PIN akan tersimpan di browser.";
    }
  });
}

if (pinSetBtn && pinSetInput) {
  pinSetBtn.addEventListener("click", () => {
    const value = pinSetInput.value.trim();
    if (!value) {
      alert("Masukkan PIN terlebih dahulu.");
      return;
    }
    localStorage.setItem(getPinKey(), value);
    pinSetInput.value = "";
    alert("PIN vendor berhasil disimpan.");
  });
}

if (pinResetBtn) {
  pinResetBtn.addEventListener("click", () => {
    const ok = confirm(
      "Reset PIN? Jika lupa, kamu bisa reset dan set ulang PIN."
    );
    if (!ok) return;
    localStorage.removeItem(getPinKey());
    alert("PIN vendor berhasil di-reset. Set PIN baru jika perlu.");
  });
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
