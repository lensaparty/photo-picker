import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
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

const REQUIRE_CLIENT_APPROVAL = true;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function normalizeBranchId(value) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, "-");
}

function setErrorText(el, msg) {
  if (!el) return;
  el.textContent = msg || "";
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

async function getBranchByAdminEmail(emailLower) {
  const q = query(collection(db, "branches"), where("admins", "array-contains", emailLower), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

async function getClientByEmail(emailLower) {
  const q = query(collection(db, "clients"), where("emailLower", "==", emailLower), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
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
  const context = await resolveContextByUser(user);
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
  const allowRegister = mode === "client";

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

  tabLogin?.addEventListener("click", () => setTab("login"));
  tabRegister?.addEventListener("click", () => setTab("register"));

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("");
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await handleLoginResult(cred.user, mode, authError);
    } catch (error) {
      showError("Gagal login. Cek email dan password.");
    }
  });

  registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("");
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await handleLoginResult(cred.user, mode, authError);
    } catch (error) {
      showError("Gagal daftar. Cek format email atau password.");
    }
  });

  googleBtn?.addEventListener("click", async () => {
    showError("");
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      await handleLoginResult(cred.user, mode, authError);
    } catch (error) {
      showError("Gagal login dengan Google.");
    }
  });

  forgotPassword?.addEventListener("click", async () => {
    showError("");
    const email = document.getElementById("loginEmail").value.trim();
    if (!email) {
      showError("Masukkan email terlebih dahulu.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      showError("Link reset password sudah dikirim ke email.");
    } catch (error) {
      showError("Gagal kirim reset password. Cek email.");
    }
  });

  onAuthStateChanged(auth, async (user) => {
    if (user) await handleLoginResult(user, mode, authError);
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
  const email = normalizeEmail(payload?.email);
  const phone = (payload?.phone || "").trim();
  const driveLink = (payload?.driveLink || "").trim();
  const weddingDate = (payload?.weddingDate || "").trim();
  let branchId = normalizeBranchId(payload?.branchId);

  if (role === "branch_admin") {
    branchId = actorBranch;
  }

  if (!name || !email || !phone || !driveLink || !weddingDate || !branchId) {
    throw new Error("invalid");
  }

  const existing = await getClientByEmail(email);
  if (existing) throw new Error("exists");

  await addDoc(collection(db, "clients"), {
    name,
    email,
    emailLower: email,
    phone,
    driveLink,
    weddingDate,
    branchId,
    status: "active",
    createdByRole: role,
    createdByUid: auth.currentUser?.uid || "",
    createdAt: serverTimestamp(),
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
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await signOut(auth);
      window.location.replace("index.html");
    });
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.replace("index.html");
      return;
    }
    const context = await resolveContextByUser(user);
    if (context.role === "blocked") {
      await signOut(auth);
      window.location.replace("index.html");
      return;
    }
    persistUserScope(context);

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
