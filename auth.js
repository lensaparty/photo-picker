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

// Mapping cabang: admin cabang + daftar client yang diizinkan untuk cabang tsb.
// Tambah cabang baru dengan format yang sama.
const BRANCH_ACCESS = {
  jakarta: {
    admins: ["admin.jakarta@lensaparty.com"],
    clients: ["client.jakarta.1@gmail.com", "client.jakarta.2@gmail.com"],
  },
  bandung: {
    admins: ["admin.bandung@lensaparty.com"],
    clients: ["client.bandung.1@gmail.com"],
  },
};

  // jakarta: {
  //   admins: ["admin.jakarta@lensaparty.com"],
  //   clients: ["client.jakarta.1@gmail.com", "client.jakarta.2@gmail.com"],
  // },
};

// Opsional: kalau ingin client harus disetujui dulu, ubah ke true
// lalu isi APPROVED_CLIENT_EMAILS.
const REQUIRE_CLIENT_APPROVAL = true;
const APPROVED_CLIENT_EMAILS = new Set([
  // "client1@email.com",
]);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function normalizeEmailSet(list = []) {
  return new Set(list.map(normalizeEmail).filter(Boolean));
}

function getBranchIdByAdminEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  for (const [branchId, cfg] of Object.entries(BRANCH_ACCESS)) {
    const admins = normalizeEmailSet(cfg?.admins || []);
    if (admins.has(normalized)) return branchId;
  }
  return null;
}

function getBranchIdByClientEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  for (const [branchId, cfg] of Object.entries(BRANCH_ACCESS)) {
    const clients = normalizeEmailSet(cfg?.clients || []);
    if (clients.has(normalized)) return branchId;
  }
  return null;
}

function isApprovedClientEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  if (APPROVED_CLIENT_EMAILS.has(normalized)) return true;
  return !!getBranchIdByClientEmail(normalized);
}

function persistUserScope({ role, branchId }) {
  localStorage.setItem("photoPicker.userRole", role);
  if (branchId) {
    localStorage.setItem("photoPicker.userBranch", branchId);
  } else {
    localStorage.removeItem("photoPicker.userBranch");
  }
}

function getUserRole(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return "guest";
  if (CENTRAL_ADMIN_EMAILS.has(normalized)) return "central_admin";
  if (getBranchIdByAdminEmail(normalized)) return "branch_admin";
  if (!REQUIRE_CLIENT_APPROVAL) return "client";
  if (isApprovedClientEmail(normalized)) return "client";
  return "blocked";
}

function isAdminRole(role) {
  return role === "central_admin" || role === "branch_admin";
}

function isAdminEmail(email) {
  if (!email) return false;
  return isAdminRole(getUserRole(email));
}

function redirectByRole(user) {
  if (!user) return;
  const normalized = normalizeEmail(user.email);
  const role = getUserRole(normalized);
  if (role === "blocked") {
    signOut(auth);
    const authError = document.getElementById("authError");
    if (authError) authError.textContent = "Akun belum diizinkan. Hubungi admin cabang/pusat.";
    return;
  }
  const branchId =
    role === "branch_admin"
      ? getBranchIdByAdminEmail(normalized)
      : role === "client"
        ? getBranchIdByClientEmail(normalized)
        : null;
  persistUserScope({ role, branchId });
  const target = isAdminRole(role) ? "vendor.html" : "client.html";
  window.location.replace(target);
}

export function initAuthPage() {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const googleBtn = document.getElementById("googleLogin");
  const authError = document.getElementById("authError");
  const tabLogin = document.getElementById("tabLogin");
  const tabRegister = document.getElementById("tabRegister");
  const forgotPassword = document.getElementById("forgotPassword");

  function showError(msg) {
    if (!authError) return;
    authError.textContent = msg || "";
  }

  function setTab(which) {
    const isLogin = which === "login";
    loginForm.style.display = isLogin ? "block" : "none";
    registerForm.style.display = isLogin ? "none" : "block";
    tabLogin.classList.toggle("active", isLogin);
    tabRegister.classList.toggle("active", !isLogin);
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
      redirectByRole(cred.user);
    } catch (err) {
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
      redirectByRole(cred.user);
    } catch (err) {
      showError("Gagal daftar. Cek format email atau password.");
    }
  });

  googleBtn?.addEventListener("click", async () => {
    showError("");
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      redirectByRole(cred.user);
    } catch (err) {
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
    } catch (err) {
      showError("Gagal kirim reset password. Cek email.");
    }
  });

  onAuthStateChanged(auth, (user) => {
    if (user) redirectByRole(user);
  });

  setTab("login");
}

export function guardPage(requiredRole) {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await signOut(auth);
      window.location.replace("index.html");
    });
  }

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.replace("index.html");
      return;
    }
    const normalized = normalizeEmail(user.email);
    const role = getUserRole(normalized);
    if (role === "blocked") {
      signOut(auth);
      window.location.replace("index.html");
      return;
    }
    const branchId =
      role === "branch_admin"
        ? getBranchIdByAdminEmail(normalized)
        : role === "client"
          ? getBranchIdByClientEmail(normalized)
          : null;
    persistUserScope({ role, branchId });
    const isAdmin = isAdminRole(role);
    if (requiredRole === "admin" && !isAdmin) {
      window.location.replace("client.html");
    }
    if (requiredRole === "user" && isAdmin) {
      window.location.replace("vendor.html");
    }
  });
}
