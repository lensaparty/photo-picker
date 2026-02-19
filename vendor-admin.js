import {
  getCurrentUserScope,
  createBranchAdmin,
  createClientRecord,
  listClientsForScope,
} from "./auth.js";

function byId(id) {
  return document.getElementById(id);
}

function normalizeBranchId(value) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, "-");
}

function showModeInfo(scope) {
  const info = byId("accountMgmtInfo");
  const branchInput = byId("clientBranchIdInput");
  const block = byId("createBranchAdminBlock");
  if (!info) return;

  if (scope.role === "central_admin") {
    info.textContent = "Mode Super Admin: bisa tambah admin cabang dan klien.";
    if (block) block.style.display = "";
    if (branchInput) branchInput.readOnly = false;
    return;
  }

  if (scope.role === "branch_admin") {
    info.textContent = `Mode Admin Cabang (${scope.branchId || "-"}): bisa tambah klien untuk cabang sendiri.`;
    if (block) block.style.display = "none";
    if (branchInput) {
      branchInput.value = scope.branchId || "";
      branchInput.readOnly = true;
    }
    return;
  }

  info.textContent = "Role tidak punya akses manajemen akun.";
}

function formatDateValue(value) {
  if (!value) return "-";
  if (typeof value === "string") return value;
  if (value?.toDate) return value.toDate().toISOString().slice(0, 10);
  return String(value);
}

async function renderClientList(scope) {
  const wrap = byId("clientMasterList");
  if (!wrap) return;
  wrap.innerHTML = '<div class="muted">Memuat data klien...</div>';
  try {
    const list = await listClientsForScope(scope);
    if (!list.length) {
      wrap.innerHTML = '<div class="muted">Belum ada data klien.</div>';
      return;
    }
    const rows = list
      .map(
        (item) => `
        <div class="mini-row">
          <div><strong>${item.name || "-"}</strong><br><span class="muted">${item.email || "-"}</span></div>
          <div>${item.branchId || "-"}</div>
          <div>${formatDateValue(item.weddingDate)}</div>
        </div>`
      )
      .join("");

    wrap.innerHTML = `
      <div class="mini-head">
        <span>Klien</span><span>Cabang</span><span>Tanggal Nikah</span>
      </div>
      ${rows}
    `;
  } catch (error) {
    wrap.innerHTML = '<div class="muted">Gagal memuat data klien.</div>';
  }
}

function bindBranchAdminCreate(scope) {
  const btn = byId("createBranchAdminBtn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    if (scope.role !== "central_admin") {
      alert("Hanya super admin yang bisa menambah admin cabang.");
      return;
    }
    const branchId = normalizeBranchId(byId("branchIdInput")?.value);
    const email = (byId("branchAdminEmailInput")?.value || "").trim();
    if (!branchId || !email) {
      alert("Isi Cabang ID dan Email Admin Cabang.");
      return;
    }
    try {
      await createBranchAdmin(branchId, email, scope.role);
      byId("branchAdminEmailInput").value = "";
      alert(`Admin cabang disimpan untuk cabang "${branchId}".`);
    } catch (error) {
      alert("Gagal menyimpan admin cabang.");
    }
  });
}

function bindClientCreate(scope) {
  const btn = byId("createClientBtn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const payload = {
      name: byId("clientNameInput")?.value || "",
      email: byId("clientEmailInput")?.value || "",
      phone: byId("clientPhoneInput")?.value || "",
      driveLink: byId("clientDriveLinkInput")?.value || "",
      weddingDate: byId("clientWeddingDateInput")?.value || "",
      branchId: byId("clientBranchIdInput")?.value || "",
    };

    try {
      await createClientRecord(payload, scope);
      byId("clientNameInput").value = "";
      byId("clientEmailInput").value = "";
      byId("clientPhoneInput").value = "";
      byId("clientDriveLinkInput").value = "";
      byId("clientWeddingDateInput").value = "";
      if (scope.role !== "branch_admin") byId("clientBranchIdInput").value = "";
      await renderClientList(scope);
      alert("Klien berhasil ditambahkan.");
    } catch (error) {
      if (error.message === "exists") {
        alert("Email klien sudah ada.");
      } else if (error.message === "invalid") {
        alert("Lengkapi data klien dulu.");
      } else if (error.message === "forbidden") {
        alert("Role kamu tidak punya akses.");
      } else {
        alert("Gagal menyimpan klien.");
      }
    }
  });
}

export async function initVendorAdminPanel() {
  const panel = byId("accountMgmtPanel");
  if (!panel) return;
  const scope = getCurrentUserScope();
  showModeInfo(scope);
  bindBranchAdminCreate(scope);
  bindClientCreate(scope);
  await renderClientList(scope);
}
