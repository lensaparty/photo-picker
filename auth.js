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
  const q = query(collection(db, "clients"), where("emailLower", "==", emailLower), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

async function getClientByCode(codeLower) {
  if (!codeLower) return null;
  const q = query(collection(db, "clients"), where("clientCodeLower", "==", codeLower), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
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
  return {
    role: localStorage.getItem("photoPicker.userRole") || "",
    branchId: localStorage.getItem("photoPicker.userBranch") || "",
  };
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

  if (!name || !phone || !driveLink || !weddingDate || !clientCode) {
    throw new Error("invalid");
  }

  const existingCode = await getClientByCode(clientCode);
  if (existingCode) throw new Error("code_exists");
  if (email) {
    const existingEmail = await getClientByEmail(email);
    if (existingEmail) throw new Error("email_exists");
  }

  await addDoc(collection(db, "clients"), {
    name,
    email: email || "",
    emailLower: email || "",
    phone,
    driveLink,
    weddingDate,
    clientCode,
    clientCodeLower: clientCode,
    edited: false,
    delivered: false,
    deliveredAt: null,
    branchId,
    status: "active",
    createdByRole: role,
    createdByUid: auth.currentUser?.uid || "",
    createdAt: serverTimestamp(),
  });
}

export async function updateClientProgress(clientId, patch, actor) {
  if (!clientId) throw new Error("invalid");
  const role = actor?.role || "";
  if (!isAdminRole(role)) throw new Error("forbidden");
  const ref = doc(db, "clients", clientId);
  await updateDoc(ref, {
    ...patch,
    updatedAt: serverTimestamp(),
    updatedByRole: role,
    updatedByUid: auth.currentUser?.uid || "",
  });
}

export async function listClientsForScope(scope) {
  const role = scope?.role || "";
  const branchId = scope?.branchId || "";
  if (!isAdminRole(role)) return [];

  let q;
  if (role === "branch_admin") {
    q = query(collection(db, "clients"), where("branchId", "==", branchId));
  } else {
    q = query(collection(db, "clients"));
  }

  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const aa = a?.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const bb = b?.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
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
