import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
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

const ADMIN_EMAILS = new Set([
  "lensaparty.fg@gmail.com",
  "mrezawijayakusumah@gmail.com",
]);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

function isAdminEmail(email) {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.toLowerCase());
}

function redirectByRole(user) {
  if (!user) return;
  const target = isAdminEmail(user.email) ? "vendor.html" : "client.html";
  window.location.replace(target);
}

export function initAuthPage() {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const googleBtn = document.getElementById("googleLogin");
  const authError = document.getElementById("authError");
  const tabLogin = document.getElementById("tabLogin");
  const tabRegister = document.getElementById("tabRegister");

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
    const isAdmin = isAdminEmail(user.email);
    if (requiredRole === "admin" && !isAdmin) {
      window.location.replace("client.html");
    }
    if (requiredRole === "user" && isAdmin) {
      window.location.replace("vendor.html");
    }
  });
}
