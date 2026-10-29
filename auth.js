/* Auth Supabase untuk login dan pembatasan halaman. */
(() => {
  const LOGIN_PAGE = "login.html";
  const accounts = {
    admin123: { email: "admin123@biosiswa-task.example", role: "teacher" },
    siswa123: { email: "siswa123@biosiswa-task.example", role: "student" }
  };

  function client() {
    if (!window.supabase || !window.BIOSISWA_SUPABASE_URL ||
        window.BIOSISWA_SUPABASE_URL.includes("PASTE_") ||
        !window.BIOSISWA_SUPABASE_KEY || window.BIOSISWA_SUPABASE_KEY.includes("PASTE_")) {
      throw new Error("Isi Project URL dan Publishable/anon key di supabase-config.js terlebih dahulu.");
    }
    if (!window.__biosiswaSupabase) {
      window.__biosiswaSupabase = window.supabase.createClient(
        window.BIOSISWA_SUPABASE_URL, window.BIOSISWA_SUPABASE_KEY
      );
    }
    return window.__biosiswaSupabase;
  }

  function message(text, isError = false) {
    const el = document.getElementById("login-message");
    if (el) { el.textContent = text; el.style.color = isError ? "#b42318" : "#166534"; }
  }

  async function getProfile(sb, userId) {
    const { data, error } = await sb.from("profiles").select("username, role").eq("id", userId).single();
    if (error) throw new Error("Profil akun belum disiapkan di Supabase. Jalankan SQL dan pastikan akun sudah dibuat.");
    return data;
  }

  async function addLogout(sb) {
    const header = document.querySelector(".header");
    if (!header || header.querySelector("[data-logout]")) return;
    const button = document.createElement("button");
    button.className = "button button-secondary";
    button.textContent = "Keluar";
    button.dataset.logout = "true";
    button.addEventListener("click", async () => {
      await sb.auth.signOut();
      window.location.href = LOGIN_PAGE;
    });
    header.appendChild(button);
  }

  async function guardPages() {
    const page = document.body?.dataset.page;
    if (!page || page === "login") return;
    let sb;
    try { sb = client(); } catch (error) {
      window.location.replace(LOGIN_PAGE);
      return;
    }
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      window.location.replace(`${LOGIN_PAGE}?next=${encodeURIComponent(location.pathname.split("/").pop() || "index.html")}`);
      return;
    }
    try {
      const profile = await getProfile(sb, session.user.id);
      if (page === "teacher" && profile.role !== "teacher") { window.location.replace("siswa.html"); return; }
      if (page === "student" && profile.role !== "student") { window.location.replace("guru.html"); return; }
      await addLogout(sb);
    } catch (error) {
      alert(error.message);
      await sb.auth.signOut();
      window.location.replace(LOGIN_PAGE);
    }
  }

  async function setupLogin() {
    const form = document.getElementById("login-form");
    if (!form) return;
    try {
      const sb = client();
      const { data: { session } } = await sb.auth.getSession();
      if (session) {
        try {
          const profile = await getProfile(sb, session.user.id);
          window.location.replace(profile.role === "teacher" ? "guru.html" : "siswa.html");
          return;
        } catch (_) {}
      }
    } catch (error) { message(error.message, true); }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const username = document.getElementById("username").value.trim().toLowerCase();
      const password = document.getElementById("password").value;
      const account = accounts[username];
      if (!account) { message("Username tidak dikenal.", true); return; }
      const submit = document.getElementById("login-submit");
      submit.disabled = true; submit.textContent = "Memeriksa...";
      try {
        const sb = client();
        const { data, error } = await sb.auth.signInWithPassword({ email: account.email, password });
        if (error) throw error;
        const profile = await getProfile(sb, data.user.id);
        if (profile.role !== account.role || profile.username !== username) {
          await sb.auth.signOut();
          throw new Error("Role akun tidak sesuai. Periksa data profiles di Supabase.");
        }
        const next = new URLSearchParams(location.search).get("next");
        const allowed = ["index.html", "siswa.html", "guru.html", "koperasi.html"];
        window.location.replace(allowed.includes(next) ? next : (profile.role === "teacher" ? "guru.html" : "siswa.html"));
      } catch (error) {
        message(error.message || "Login gagal. Periksa username, password, dan konfigurasi Supabase.", true);
      } finally {
        submit.disabled = false; submit.textContent = "Login";
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (document.body?.dataset.page === "login") setupLogin();
    else guardPages();
  });
})();
