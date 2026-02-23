import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  addDoc,
  arrayUnion,
  serverTimestamp,
  limit,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBxXfO1RA6VKhyzCq7Py7ihhhwdH0aXXE0",
  authDomain: "lensaparty-photo-picker.firebaseapp.com",
  projectId: "lensaparty-photo-picker",
  storageBucket: "lensaparty-photo-picker.firebasestorage.app",
  messagingSenderId: "541447508123",
  appId: "1:541447508123:web:006c5c80da852533a7f63e",
  measurementId: "G-HXR1G62L1S",
};

const CENTRAL_ADMIN_EMAILS = new Set([
  "lensaparty.fg@gmail.com",
  "mrezawijayakusumah@gmail.com",
]);

const REQUIRE_CLIENT_APPROVAL = false;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const ROLE_RESOLVE_TIMEOUT_MS = 1500;
const LOGOUT_FLAG_KEY = "photoPicker.forceLogout";
const LOCAL_CLIENTS_KEY = "photoPicker.localClients";
const FIRESTORE_QUERY_TIMEOUT_MS = 4000;
const FIRESTORE_WRITE_TIMEOUT_MS = 5000;

function isLocalRuntime() {
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function normalizeBranchId(value) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, "-");
}

function normalizeClientCode(value) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function safeId(value) {
  return (value || "").toString().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
}

function readLocalClients() {
  try {
    const raw = localStorage.getItem(LOCAL_CLIENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function writeLocalClients(list) {
  localStorage.setItem(LOCAL_CLIENTS_KEY, JSON.stringify(list));
}

function upsertLocalClient(client) {
  const list = readLocalClients();
  const key = normalizeClientCode(client.clientCodeLower || client.clientCode || "");
  const idx = list.findIndex((c) => normalizeClientCode(c.clientCodeLower || c.clientCode || "") === key);
  if (idx >= 0) list[idx] = { ...list[idx], ...client };
  else list.push(client);
  writeLocalClients(list);
}

function normalizeForLocalCache(client) {
  const code = normalizeClientCode(client?.clientCode || client?.clientCodeLower || "");
  return {
    ...client,
    id: client?.id || localClientId(code),
    clientCode: code || "",
    clientCodeLower: code || "",
    emailLower: normalizeEmail(client?.emailLower || client?.email || ""),
    branchId: normalizeBranchId(client?.branchId || "vendor"),
  };
}

function getLocalClientByCode(codeLower) {
  const list = readLocalClients();
  return list.find((c) => normalizeClientCode(c.clientCodeLower || c.clientCode || "") === normalizeClientCode(codeLower)) || null;
}

function getLocalClientByEmail(emailLower) {
  if (!emailLower) return null;
  const list = readLocalClients();
  return list.find((c) => (c.emailLower || "").toLowerCase() === emailLower) || null;
}

function listLocalClientsForScope(scope) {
  const role = scope?.role || "";
  const branchId = scope?.branchId || "";
  const list = readLocalClients();
  if (role === "branch_admin" && branchId) {
    return list.filter((c) => (c.branchId || "") === branchId);
  }
  if (role === "central_admin" || role === "branch_admin") {
    return list;
  }
  return [];
}

function mergeByClientCode(remoteList, localList) {
  const map = new Map();
  [...localList, ...remoteList].forEach((item) => {
    const key = (item.clientCodeLower || item.clientCode || item.id || Math.random()).toString().toLowerCase();
    map.set(key, item);
  });
  return Array.from(map.values());
}

function localClientId(clientCode) {
  return `local_${safeId(clientCode || `c_${Date.now()}`)}`;
}

async function withFirestoreTimeout(promise, ms = FIRESTORE_QUERY_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("firestore_timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function setErrorText(el, msg) {
  if (!el) return;
  el.textContent = msg || "";
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("role_resolve_timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function formatAuthError(error) {
  const code = error?.code || "";
  if (code.includes("auth/invalid-credential")) return "Email/password salah.";
  if (code.includes("auth/user-not-found")) return "Akun belum terdaftar.";
  if (code.includes("auth/wrong-password")) return "Password salah.";
  if (code.includes("auth/too-many-requests")) return "Terlalu banyak percobaan. Coba lagi sebentar.";
  if (code.includes("auth/popup-closed-by-user")) return "Popup Google ditutup sebelum selesai.";
  if (code.includes("auth/unauthorized-domain")) return "Domain belum diizinkan di Firebase Authentication.";
  if (String(error?.message || "").includes("Missing or insufficient permissions")) {
    return "Akses Firestore ditolak. Cek Firestore Rules.";
  }
  return error?.message || "Terjadi kesalahan saat login.";
}

function isAdminRole(role) {
  return role === "central_admin" || role === "branch_admin";
}

function persistUserScope({ role, branchId }) {
  localStorage.setItem("photoPicker.userRole", role);
  if (branchId) {
    localStorage.setItem("photoPicker.userBranch", branchId);
  } else {
    localStorage.removeItem("photoPicker.userBranch");
  }
}

function clearUserScope() {
  localStorage.removeItem("photoPicker.userRole");
  localStorage.removeItem("photoPicker.userBranch");
  localStorage.removeItem("photoPicker.clientProfile");
  localStorage.removeItem("photoPicker.clientSession");
  localStorage.removeItem("photoPicker.userEmail");
  localStorage.removeItem("photoPicker.userDisplay");
}

async function signOutQuickly() {
  try {
    await Promise.race([
      signOut(auth),
      new Promise((resolve) => setTimeout(resolve, 1200)),
    ]);
  } catch (_) {
    // ignore: redirect tetap harus jalan cepat
  }
}

async function getBranchByAdminEmail(emailLower) {
  const q = query(collection(db, "branches"), where("admins", "array-contains", emailLower), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

async function getClientByEmail(emailLower) {
  if (!emailLower) return null;
  try {
    const q = query(collection(db, "clients"), where("emailLower", "==", emailLower), limit(1));
    const snap = await withFirestoreTimeout(getDocs(q));
    if (snap.empty) return isLocalRuntime() ? getLocalClientByEmail(emailLower) : null;
    const d = snap.docs[0];
    const found = { id: d.id, ...d.data() };
    upsertLocalClient(normalizeForLocalCache(found));
    return found;
  } catch (_) {
    return isLocalRuntime() ? getLocalClientByEmail(emailLower) : null;
  }
}

async function getClientByCode(codeLower) {
  codeLower = normalizeClientCode(codeLower);
  if (!codeLower) return null;
  try {
    const q = query(collection(db, "clients"), where("clientCodeLower", "==", codeLower), limit(1));
    const snap = await withFirestoreTimeout(getDocs(q));
    if (!snap.empty) {
      const d = snap.docs[0];
      const found = { id: d.id, ...d.data() };
      upsertLocalClient(normalizeForLocalCache(found));
      return found;
    }

    // Fallback tambahan: sebagian data lama menyimpan kode di field clientCode.
    const qRaw = query(collection(db, "clients"), where("clientCode", "==", codeLower), limit(1));
    const rawSnap = await withFirestoreTimeout(getDocs(qRaw), 3500);
    if (!rawSnap.empty) {
      const d = rawSnap.docs[0];
      const found = { id: d.id, ...d.data() };
      upsertLocalClient(normalizeForLocalCache(found));
      return found;
    }

    // Fallback data lama tanpa clientCodeLower.
    const all = await withFirestoreTimeout(getDocs(collection(db, "clients")), 5500);
    const legacy = all.docs.find((docSnap) => {
      const data = docSnap.data() || {};
      const raw = (data.clientCode || "").toString().trim().toLowerCase();
      return raw === codeLower;
    });
    if (legacy) {
      const found = { id: legacy.id, ...legacy.data() };
      upsertLocalClient(normalizeForLocalCache(found));
      return found;
    }
  } catch (_) {
    // fallback local below
  }
  return isLocalRuntime() ? getLocalClientByCode(codeLower) : null;
}

async function getClientByCodeFast(codeLower) {
  if (!codeLower) return null;
  try {
    const q = query(collection(db, "clients"), where("clientCodeLower", "==", codeLower), limit(1));
    const snap = await withFirestoreTimeout(getDocs(q), 2500);
    if (!snap.empty) {
      const d = snap.docs[0];
      const found = { id: d.id, ...d.data() };
      upsertLocalClient(normalizeForLocalCache(found));
      return found;
    }
  } catch (_) {
    // fallback local below
  }
  return isLocalRuntime() ? getLocalClientByCode(codeLower) : null;
}

function setClientSession(profile) {
  const safeProfile = { ...profile };
  delete safeProfile.clientPin;
  delete safeProfile.clientPinRaw;
  localStorage.setItem("photoPicker.clientSession", JSON.stringify({
    id: safeProfile.id || "",
    branchId: safeProfile.branchId || "",
    clientCode: safeProfile.clientCode || "",
    name: safeProfile.name || "Client",
  }));
  localStorage.setItem("photoPicker.clientProfile", JSON.stringify(safeProfile));
  localStorage.setItem("photoPicker.userRole", "client");
  localStorage.removeItem("photoPicker.userBranch");
  localStorage.removeItem("photoPicker.userEmail");
  localStorage.setItem("photoPicker.userDisplay", safeProfile.name || "Client");
}

async function resolveContextByUser(user) {
  const email = normalizeEmail(user?.email);
  if (!email) return { role: "guest", branchId: null };

  if (CENTRAL_ADMIN_EMAILS.has(email)) {
    return { role: "central_admin", branchId: null };
  }

  const branch = await getBranchByAdminEmail(email);
  if (branch) return { role: "branch_admin", branchId: branch.id };

  if (!REQUIRE_CLIENT_APPROVAL) {
    return { role: "client", branchId: null };
  }

  const client = await getClientByEmail(email);
  if (!client) return { role: "blocked", branchId: null };
  return { role: "client", branchId: client.branchId || null };
}

async function handleLoginResult(user, loginMode, authError) {
  const email = normalizeEmail(user?.email);

  // Fast path untuk client: langsung masuk, validasi detail bisa menyusul di halaman app.
  if (loginMode === "client" && email && !CENTRAL_ADMIN_EMAILS.has(email)) {
    persistUserScope({ role: "client", branchId: null });
    window.location.replace("client.html");
    return true;
  }

  let context;
  try {
    context = await withTimeout(resolveContextByUser(user), ROLE_RESOLVE_TIMEOUT_MS);
  } catch (error) {
    const fallbackEmail = email;
    // Fallback cepat: kalau Firestore error saat mode client, tetap izinkan masuk client
    // agar login tidak mentok saat rules/index belum siap.
    if (loginMode === "client" && fallbackEmail && !CENTRAL_ADMIN_EMAILS.has(fallbackEmail)) {
      context = { role: "client", branchId: null };
    } else {
      await signOut(auth);
      setErrorText(authError, `Gagal baca role user. ${formatAuthError(error)}`);
      return false;
    }
  }
  if (context.role === "blocked") {
    await signOut(auth);
    setErrorText(authError, "Akun belum diizinkan. Hubungi admin pusat/cabang.");
    return false;
  }

  if (loginMode === "admin" && !isAdminRole(context.role)) {
    await signOut(auth);
    setErrorText(authError, "Akun ini bukan admin. Gunakan login client.");
    return false;
  }

  if (loginMode === "client" && isAdminRole(context.role)) {
    await signOut(auth);
    setErrorText(authError, "Akun admin harus login dari halaman admin.");
    return false;
  }

  persistUserScope(context);
  localStorage.setItem("photoPicker.userEmail", email);

  if (context.role === "client") {
    const profile = await getClientByEmail(normalizeEmail(user.email));
    if (profile) localStorage.setItem("photoPicker.clientProfile", JSON.stringify(profile));
  }

  window.location.replace(isAdminRole(context.role) ? "vendor.html" : "client.html");
  return true;
}

function initLoginPage({ mode }) {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const googleBtn = document.getElementById("googleLogin");
  const authError = document.getElementById("authError");
  const tabLogin = document.getElementById("tabLogin");
  const tabRegister = document.getElementById("tabRegister");
  const forgotPassword = document.getElementById("forgotPassword");
  const allowRegister = false;
  const allowGoogle = mode === "admin";
  let redirecting = false;

  function showError(msg) {
    setErrorText(authError, msg);
  }

  function setTab(which) {
    if (!allowRegister) {
      if (registerForm) registerForm.style.display = "none";
      if (tabRegister) tabRegister.style.display = "none";
      if (tabLogin) tabLogin.classList.add("active");
      if (loginForm) loginForm.style.display = "block";
      showError("");
      return;
    }
    const isLogin = which === "login";
    if (loginForm) loginForm.style.display = isLogin ? "block" : "none";
    if (registerForm) registerForm.style.display = isLogin ? "none" : "block";
    if (tabLogin) tabLogin.classList.toggle("active", isLogin);
    if (tabRegister) tabRegister.classList.toggle("active", !isLogin);
    showError("");
  }

  if (tabLogin) tabLogin.addEventListener("click", () => setTab("login"));
  if (tabRegister) tabRegister.addEventListener("click", () => setTab("register"));

  if (!allowGoogle && googleBtn) {
    googleBtn.style.display = "none";
  }

  if (mode === "client") {
    loginForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      showError("");
      const code = normalizeClientCode(document.getElementById("loginEmail")?.value || "");
      if (!code) {
        showError("Isi kode client.");
        return;
      }
      try {
        const profile = await getClientByCode(code);
        if (!profile) {
          showError("Kode client tidak ditemukan.");
          return;
        }
        if ((profile.status || "active") !== "active") {
          showError("Akun client tidak aktif.");
          return;
        }
        setClientSession(profile);
        window.location.replace("client.html");
      } catch (error) {
        showError(formatAuthError(error));
      }
    });

    if (forgotPassword) forgotPassword.style.display = "none";
    onAuthStateChanged(auth, () => {});
    setTab("login");
    return;
  }

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("");
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      if (!redirecting) {
        redirecting = true;
        await handleLoginResult(cred.user, mode, authError);
      }
    } catch (error) {
      redirecting = false;
      showError(formatAuthError(error));
    }
  });

  registerForm?.addEventListener("submit", (e) => e.preventDefault());

  googleBtn?.addEventListener("click", async () => {
    showError("");
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      if (!redirecting) {
        redirecting = true;
        await handleLoginResult(cred.user, mode, authError);
      }
    } catch (error) {
      redirecting = false;
      showError(formatAuthError(error));
    }
  });

  forgotPassword?.addEventListener("click", () => {
    showError("Reset password dilakukan oleh super admin.");
  });

  onAuthStateChanged(auth, async (user) => {
    if (sessionStorage.getItem(LOGOUT_FLAG_KEY) === "1") {
      sessionStorage.removeItem(LOGOUT_FLAG_KEY);
      await signOutQuickly();
      return;
    }
    if (!user) return;
    try {
      if (!redirecting) {
        redirecting = true;
        await handleLoginResult(user, mode, authError);
      }
    } catch (error) {
      redirecting = false;
      showError(formatAuthError(error));
    }
  });

  setTab("login");
}

export function initAdminAuthPage() {
  initLoginPage({ mode: "admin" });
}

export function initClientAuthPage() {
  initLoginPage({ mode: "client" });
}

export function getCurrentUserScope() {
  const role = localStorage.getItem("photoPicker.userRole") || "";
  const branchId = localStorage.getItem("photoPicker.userBranch") || "";
  if (role) {
    return { role, branchId };
  }
  const email = normalizeEmail(auth.currentUser?.email || "");
  if (CENTRAL_ADMIN_EMAILS.has(email)) {
    return { role: "central_admin", branchId: "" };
  }
  return { role: "", branchId: "" };
}

export async function createBranchAdmin(branchIdValue, emailValue, actorRole) {
  if (actorRole !== "central_admin") {
    throw new Error("forbidden");
  }
  const branchId = normalizeBranchId(branchIdValue);
  const email = normalizeEmail(emailValue);
  if (!branchId || !email) {
    throw new Error("invalid");
  }
  const ref = doc(db, "branches", branchId);
  await setDoc(
    ref,
    {
      admins: arrayUnion(email),
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function createClientRecord(payload, actor) {
  const role = actor?.role || "";
  const actorBranch = actor?.branchId || "";
  if (!isAdminRole(role)) throw new Error("forbidden");

  const name = (payload?.name || "").trim();
  const phone = (payload?.phone || "").trim();
  const driveLink = (payload?.driveLink || "").trim();
  const weddingDate = (payload?.weddingDate || "").trim();
  const clientCode = normalizeClientCode(payload?.clientCode);
  const email = normalizeEmail(payload?.email || "");
  let branchId = normalizeBranchId(payload?.branchId || "vendor");

  if (role === "branch_admin") {
    branchId = actorBranch || "vendor";
  }

  if (!name || !driveLink || !clientCode) {
    throw new Error("invalid");
  }

  // Untuk create baru, pakai query cepat (tanpa scan data lama) agar respons tidak lambat.
  const existingCode = await getClientByCodeFast(clientCode);
  if (existingCode) {
    // Jika kode sudah ada, treat sebagai update data client existing.
    // Penting: di public WAJIB berhasil update ke Firestore agar data sinkron lintas device.
    const updatedPayload = {
      name,
      phone: phone || "-",
      driveLink,
      weddingDate: weddingDate || "-",
      clientCode,
      clientCodeLower: clientCode,
      email: email || existingCode.email || "",
      emailLower: email || existingCode.emailLower || "",
      branchId: role === "branch_admin" ? (actorBranch || existingCode.branchId || "vendor") : (branchId || existingCode.branchId || "vendor"),
      status: existingCode.status || "active",
      updatedAt: new Date().toISOString(),
      updatedByRole: role,
      updatedByUid: auth.currentUser?.uid || "",
    };

    if (isLocalRuntime()) {
      upsertLocalClient(
        normalizeForLocalCache({
          ...existingCode,
          ...updatedPayload,
        })
      );
    }

    if (existingCode.id && !String(existingCode.id).startsWith("local_")) {
      try {
        await withFirestoreTimeout(
          updateDoc(doc(db, "clients", existingCode.id), {
            ...updatedPayload,
            updatedAt: serverTimestamp(),
            updatedByRole: role,
            updatedByUid: auth.currentUser?.uid || "",
          }),
          FIRESTORE_WRITE_TIMEOUT_MS
        );
      } catch (error) {
        if (isLocalRuntime()) return { saved: "updated_local_only", id: existingCode.id };
        const detail = `${error?.code || "no_code"} ${error?.message || ""}`.trim();
        throw new Error(`remote_required:${detail}`);
      }
    }

    return { saved: "updated_existing", id: existingCode.id };
  }
  if (email) {
    const existingEmail = await getClientByEmail(email);
    if (existingEmail) throw new Error("email_exists");
  }

  const localRecord = {
    name,
    email: email || "",
    emailLower: email || "",
    phone: phone || "-",
    driveLink,
    weddingDate: weddingDate || "-",
    clientCode,
    clientCodeLower: clientCode,
    edited: false,
    delivered: false,
    deliveredAt: null,
    branchId,
    status: "active",
    createdByRole: role,
    createdByUid: auth.currentUser?.uid || "",
    createdAt: new Date().toISOString(),
  };

  if (isLocalRuntime()) {
    // Local-only cache untuk development localhost.
    upsertLocalClient(
      normalizeForLocalCache({
        ...localRecord,
        id: localClientId(clientCode),
        source: "local",
      })
    );
  }

  try {
    const added = await withFirestoreTimeout(
      addDoc(collection(db, "clients"), {
        ...localRecord,
        createdAt: serverTimestamp(),
      }),
      FIRESTORE_WRITE_TIMEOUT_MS
    );
    if (isLocalRuntime()) {
      upsertLocalClient(
        normalizeForLocalCache({
          ...localRecord,
          id: added?.id || localClientId(clientCode),
          source: "remote",
        })
      );
    }
  } catch (error) {
    if (isLocalRuntime()) {
      // Tetap sukses lokal saat development localhost.
      return { saved: "local_only", reason: error?.message || "firestore_unavailable" };
    }
    const detail = `${error?.code || "no_code"} ${error?.message || ""}`.trim();
    throw new Error(`remote_required:${detail}`);
  }

  return { saved: "remote_and_local" };
}

export async function updateClientProgress(clientId, patch, actor) {
  if (!clientId) throw new Error("invalid");
  const role = actor?.role || "";
  if (!isAdminRole(role)) throw new Error("forbidden");
  const list = readLocalClients();
  const localIdx = list.findIndex((c) => c.id === clientId);
  if (localIdx >= 0) {
    list[localIdx] = {
      ...list[localIdx],
      ...patch,
      updatedAt: new Date().toISOString(),
      updatedByRole: role,
      updatedByUid: auth.currentUser?.uid || "",
    };
    writeLocalClients(list);
  }
  if (clientId.startsWith("local_")) return;

  const ref = doc(db, "clients", clientId);
  await withFirestoreTimeout(
    updateDoc(ref, {
      ...patch,
      updatedAt: serverTimestamp(),
      updatedByRole: role,
      updatedByUid: auth.currentUser?.uid || "",
    }),
    FIRESTORE_WRITE_TIMEOUT_MS
  );
}

export async function listClientsForScope(scope) {
  const role = scope?.role || "";
  const branchId = scope?.branchId || "";
  if (!isAdminRole(role)) return [];
  const localList = isLocalRuntime() ? listLocalClientsForScope(scope) : [];
  let remoteList = [];
  try {
    let q;
    if (role === "branch_admin") {
      q = query(collection(db, "clients"), where("branchId", "==", branchId));
    } else {
      q = query(collection(db, "clients"));
    }
    const snap = await withFirestoreTimeout(getDocs(q));
    remoteList = snap.docs.map((d) => ({ id: d.id, ...d.data(), source: "remote" }));
    remoteList.forEach((item) => upsertLocalClient(normalizeForLocalCache(item)));
  } catch (_) {
    remoteList = [];
  }

  const sourceList = isLocalRuntime() ? mergeByClientCode(remoteList, localList) : remoteList;
  return sourceList.sort((a, b) => {
    const aa = a?.createdAt?.toDate ? a.createdAt.toDate().getTime() : Date.parse(a?.createdAt || 0) || 0;
    const bb = b?.createdAt?.toDate ? b.createdAt.toDate().getTime() : Date.parse(b?.createdAt || 0) || 0;
    return bb - aa;
  });
}

export async function guardPage(requiredRole) {
  const loginTarget = requiredRole === "admin" ? "admin-login.html" : "client-login.html";
  const logoutTarget = loginTarget;
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      logoutBtn.disabled = true;
      sessionStorage.setItem(LOGOUT_FLAG_KEY, "1");
      clearUserScope();
      signOutQuickly();
      window.location.replace(logoutTarget);
    });
  }

  if (requiredRole === "user") {
    const raw = localStorage.getItem("photoPicker.clientSession");
    if (raw) {
      try {
        const session = JSON.parse(raw);
        if (session?.id) {
          persistUserScope({ role: "client", branchId: session.branchId || "" });
          localStorage.setItem("photoPicker.userDisplay", session.name || "Client");
          return;
        }
      } catch (_) {}
    }
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.replace(loginTarget);
      return;
    }
    let context;
    try {
      context = await resolveContextByUser(user);
    } catch (error) {
      await signOut(auth);
      alert(`Gagal validasi role user: ${formatAuthError(error)}`);
      window.location.replace(loginTarget);
      return;
    }
    if (context.role === "blocked") {
      await signOut(auth);
      window.location.replace(loginTarget);
      return;
    }
    persistUserScope(context);
    localStorage.setItem("photoPicker.userEmail", normalizeEmail(user.email));

    if (context.role === "client") {
      const profile = await getClientByEmail(normalizeEmail(user.email));
      if (profile) localStorage.setItem("photoPicker.clientProfile", JSON.stringify(profile));
    }

    const isAdmin = isAdminRole(context.role);
    if (requiredRole === "admin" && !isAdmin) {
      window.location.replace("client.html");
    }
    if (requiredRole === "user" && isAdmin) {
      window.location.replace("vendor.html");
    }
  });
}

function getSelectionOwner(mode) {
  if (mode === "client") {
    const raw = localStorage.getItem("photoPicker.clientSession");
    if (raw) {
      try {
        const session = JSON.parse(raw);
        if (session?.id) return `client_${session.id}`;
        if (session?.clientCode) return `client_${safeId(session.clientCode)}`;
      } catch (_) {}
    }
  }
  const email = normalizeEmail(auth.currentUser?.email || "");
  if (!email) return "guest";
  if (mode === "client") return email;
  const role = localStorage.getItem("photoPicker.userRole") || "";
  if (role === "central_admin") return "central_admin";
  if (role === "branch_admin") {
    const branchId = localStorage.getItem("photoPicker.userBranch") || "";
    return branchId ? `branch_${branchId}` : "branch_admin";
  }
  return email;
}

function getSelectionDocRef(folderId, mode) {
  const owner = getSelectionOwner(mode);
  const docId = `${safeId(mode)}__${safeId(folderId)}__${safeId(owner)}`;
  return doc(db, "pickerStates", docId);
}

export async function loadSelectionState(folderId, mode) {
  if (!folderId) return null;
  const ref = getSelectionDocRef(folderId, mode);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  return data.payload || null;
}

export async function saveSelectionState(folderId, mode, payload) {
  if (!folderId) return;
  const ref = getSelectionDocRef(folderId, mode);
  await setDoc(
    ref,
    {
      folderId,
      mode,
      updatedAt: serverTimestamp(),
      payload,
    },
    { merge: true }
  );
}
