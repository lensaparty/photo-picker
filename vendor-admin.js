import {
  getCurrentUserScope,
  createClientRecord,
  listClientsForScope,
  updateClientProgress,
} from "./auth.js";

function byId(id) {
  return document.getElementById(id);
}

function showModeInfo(scope) {
  const info = byId("accountMgmtInfo");
  if (!info) return;
  if (scope.role === "central_admin" || scope.role === "branch_admin") {
    info.textContent = "Mode Vendor: tambah data klien dan pantau progres edit/delivery.";
  } else {
    info.textContent = "Role tidak punya akses manajemen akun.";
  }
}

function formatDateValue(value) {
  if (!value) return "-";
  if (typeof value === "string") return value;
  if (value?.toDate) return value.toDate().toISOString().slice(0, 10);
  return String(value);
}

function toDdMmYyyy(value) {
  if (!value) return "";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value).replace(/\D/g, "").slice(0, 8);
  const [, y, m, d] = match;
  return `${d}${m}${y}`;
}

async function renderClientList(scope) {
  const wrap = byId("clientMasterList");
  const statusWrap = byId("clientStatusList");
  const editedCount = byId("statusEditedCount");
  const deliveredCount = byId("statusDeliveredCount");
  const pendingCount = byId("statusPendingCount");
  const dashboardClientCount = byId("dashboardClientCount");
  if (!wrap) return;
  wrap.innerHTML = '<div class="muted">Memuat data klien...</div>';
  if (statusWrap) statusWrap.innerHTML = '<div class="muted">Memuat status client...</div>';
  try {
    const list = await listClientsForScope(scope);
    const editedTotal = list.filter((i) => i.edited).length;
    const deliveredTotal = list.filter((i) => i.delivered).length;
    const pendingTotal = Math.max(list.length - deliveredTotal, 0);
    if (editedCount) editedCount.textContent = String(editedTotal);
    if (deliveredCount) deliveredCount.textContent = String(deliveredTotal);
    if (pendingCount) pendingCount.textContent = String(pendingTotal);
    if (dashboardClientCount) dashboardClientCount.textContent = `${list.length} client`;

    if (!list.length) {
      wrap.innerHTML = '<div class="muted">Belum ada data klien.</div>';
      if (statusWrap) statusWrap.innerHTML = '<div class="muted">Belum ada client untuk dipantau.</div>';
      return;
    }
    const rows = list
      .map(
        (item) => `
        <div class="mini-row">
          <div class="client-cell-main">
            <strong>${item.name || "-"}</strong>
            <span class="muted">${item.phone || "-"}</span>
          </div>
          <div><span class="code-chip">${item.clientCode || "-"}</span></div>
          <div class="muted">${formatDateValue(item.weddingDate)}</div>
          <div class="table-actions">
            <button type="button" class="ghost" data-action="open-drive-mini" data-link="${item.driveLink || ""}">Drive</button>
            <button type="button" class="ghost" data-action="copy-code" data-code="${item.clientCode || ""}">Copy Kode</button>
          </div>
        </div>`
      )
      .join("");

    wrap.innerHTML = `
      <div class="mini-head">
        <span>Klien</span><span>Kode Login</span><span>Tanggal Nikah</span><span>Aksi</span>
      </div>
      ${rows}
    `;

    if (statusWrap) {
      statusWrap.innerHTML = list
        .map((item) => {
          const edited = item.edited ? "Edited" : "Belum Edit";
          const delivered = item.delivered ? "Delivered" : "Belum Kirim";
          return `
            <div class="client-status-card">
              <div class="client-status-head">
                <div>
                  <strong>${item.name || "-"}</strong>
                  <div class="muted">${item.clientCode || "-"}</div>
                </div>
                <div class="status-badges">
                  <span class="badge ${item.edited ? "ok" : ""}">${edited}</span>
                  <span class="badge ${item.delivered ? "ok" : ""}">${delivered}</span>
                </div>
              </div>
              <div class="client-status-meta muted">
                <span>HP: ${item.phone || "-"}</span>
                <span>Tanggal: ${formatDateValue(item.weddingDate)}</span>
              </div>
              <div class="client-status-actions">
                <button type="button" class="ghost" data-action="open-drive" data-id="${item.id}">Buka Drive</button>
                <button type="button" class="ghost" data-action="toggle-edited" data-id="${item.id}" data-next="${item.edited ? "0" : "1"}">
                  ${item.edited ? "Batal Edited" : "Tandai Edited"}
                </button>
                <button type="button" class="primary" data-action="toggle-delivered" data-id="${item.id}" data-next="${item.delivered ? "0" : "1"}">
                  ${item.delivered ? "Batalkan Kirim" : "Tandai Delivered"}
                </button>
              </div>
              <input type="hidden" data-drive="${item.id}" value="${item.driveLink || ""}" />
            </div>
          `;
        })
        .join("");
    }
  } catch (error) {
    wrap.innerHTML = '<div class="muted">Gagal memuat data klien.</div>';
    if (statusWrap) statusWrap.innerHTML = '<div class="muted">Gagal memuat status client.</div>';
  }
}

function bindClientMasterActions() {
  const wrap = byId("clientMasterList");
  if (!wrap) return;
  wrap.addEventListener("click", async (event) => {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === "open-drive-mini") {
      const link = btn.dataset.link || "";
      if (link) window.open(link, "_blank", "noopener");
      return;
    }
    if (action === "copy-code") {
      const code = btn.dataset.code || "";
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code);
        alert("Kode client berhasil dicopy.");
      } catch (error) {
        alert("Gagal copy kode client.");
      }
    }
  });
}

function bindClientCreate(scope) {
  const btn = byId("createClientBtn");
  const notice = byId("clientCreateNotice");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    if (notice) notice.textContent = "";
    const payload = {
      name: byId("clientNameInput")?.value || "",
      phone: byId("clientPhoneInput")?.value || "",
      driveLink: byId("clientDriveLinkInput")?.value || "",
      weddingDate: toDdMmYyyy(byId("clientWeddingDateInput")?.value || ""),
      clientCode: byId("clientCodeInput")?.value || "",
    };

    try {
      await createClientRecord(payload, scope);
      byId("clientNameInput").value = "";
      byId("clientPhoneInput").value = "";
      byId("clientDriveLinkInput").value = "";
      byId("clientWeddingDateInput").value = "";
      byId("clientCodeInput").value = "";
      await renderClientList(scope);
      if (notice) notice.textContent = "Klien berhasil ditambahkan. Login pakai Kode Client.";
      alert("Klien berhasil ditambahkan.");
    } catch (error) {
      if (error.message === "code_exists") {
        if (notice) notice.textContent = "Peringatan: Kode client sudah dipakai. Pakai kode lain.";
        alert("Kode client sudah dipakai.");
      } else if (error.message === "invalid") {
        if (notice) notice.textContent = "Peringatan: isi semua data klien dulu.";
        alert("Lengkapi data klien dulu.");
      } else if (error.message === "forbidden") {
        if (notice) notice.textContent = "Peringatan: role kamu tidak punya akses.";
        alert("Role kamu tidak punya akses.");
      } else {
        if (notice) notice.textContent = "Peringatan: gagal menyimpan klien.";
        alert("Gagal menyimpan klien.");
      }
    }
  });
}

function bindClientStatusActions(scope) {
  const statusWrap = byId("clientStatusList");
  if (!statusWrap) return;
  statusWrap.addEventListener("click", async (event) => {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (!id) return;

    if (action === "open-drive") {
      const hidden = statusWrap.querySelector(`input[data-drive="${id}"]`);
      const link = hidden?.value || "";
      if (link) window.open(link, "_blank", "noopener");
      return;
    }

    try {
      btn.disabled = true;
      if (action === "toggle-edited") {
        const next = btn.dataset.next === "1";
        await updateClientProgress(id, { edited: next }, scope);
      }
      if (action === "toggle-delivered") {
        const next = btn.dataset.next === "1";
        await updateClientProgress(id, { delivered: next, deliveredAt: next ? new Date().toISOString() : null }, scope);
      }
      await renderClientList(scope);
    } catch (error) {
      alert("Gagal update status client.");
    } finally {
      btn.disabled = false;
    }
  });
}

export async function initVendorAdminPanel() {
  const panel = byId("accountMgmtPanel");
  if (!panel) return;
  const scope = getCurrentUserScope();
  showModeInfo(scope);
  bindClientCreate(scope);
  bindClientMasterActions();
  bindClientStatusActions(scope);
  await renderClientList(scope);
}
