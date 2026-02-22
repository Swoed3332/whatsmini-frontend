// ================= CONFIG =================
const API_BASE = "https://whatsmini.onrender.com";
const WS_BASE = API_BASE.replace("https://", "wss://").replace("http://", "ws://");

// ================= STATE =================
let token = null;
let username = null;
let ws = null;

const $ = (id) => document.getElementById(id);

// ================= UI HELPERS =================
function showAuth() {
  $("auth").classList.remove("hidden");
  $("chat").classList.add("hidden");
}
function showChat() {
  $("auth").classList.add("hidden");
  $("chat").classList.remove("hidden");
}
function addMsg(text, who = "them") {
  const d = document.createElement("div");
  d.className = "msg " + (who === "me" ? "me" : "them");
  d.innerText = text;
  $("messages").appendChild(d);
  $("messages").scrollTop = $("messages").scrollHeight;
}
function setAuthStatus(t) {
  $("authStatus").innerText = t;
}

// ================= SESSION =================
function saveSession() {
  localStorage.setItem("wm_token", token);
  localStorage.setItem("wm_user", username);
}
function loadSession() {
  token = localStorage.getItem("wm_token");
  username = localStorage.getItem("wm_user");
}
function clearSession() {
  localStorage.removeItem("wm_token");
  localStorage.removeItem("wm_user");
  token = null;
  username = null;
}

// ================= API =================
async function wakeBackend() {
  try {
    await fetch(API_BASE + "/docs", { method: "GET" });
  } catch {}
}

async function api(path, method = "GET", body = null, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 30000; // 30s
  const retries = opts.retries ?? 3;
  const retryDelayMs = opts.retryDelayMs ?? 2000;

  if (method !== "GET") {
    await wakeBackend();
  }

  const url = API_BASE + path;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal
      });

      const raw = await res.text().catch(() => "");
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { raw };
      }

      return { res, data };
    } catch (err) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, retryDelayMs));
        continue;
      }
      const msg =
        err?.name === "AbortError"
          ? `Timeout (${timeoutMs}ms) - Render uyanıyor olabilir`
          : (err?.message || "Failed to fetch (CORS/Network)");
      throw new Error(msg);
    } finally {
      clearTimeout(t);
    }
  }
}

// ================= REGISTER =================
$("btnRegister").onclick = async (e) => {
  e.preventDefault();

  const user = $("username").value.trim();
  const pass = $("password").value;

  if (!user || !pass) {
    setAuthStatus("Boş alan var.");
    return;
  }

  try {
    const { res, data } = await api("/api/register", "POST", {
      username: user,
      password: pass
    }, { retries: 3, timeoutMs: 30000 });

    if (!res.ok) {
      const detail = data?.detail ?? data?.raw ?? `HTTP ${res.status}`;
      setAuthStatus("REGISTER ERROR: " + detail);
      return;
    }

    setAuthStatus("Register OK ✅ Login yap.");
  } catch (err) {
    setAuthStatus("REGISTER FAIL: " + err.message);
  }
};

// ================= LOGIN =================
$("btnLogin").onclick = async (e) => {
  e.preventDefault();

  const user = $("username").value.trim();
  const pass = $("password").value;

  if (!user || !pass) {
    setAuthStatus("Boş alan var.");
    return;
  }

  try {
    const { res, data } = await api("/api/login", "POST", {
      username: user,
      password: pass
    }, { retries: 3, timeoutMs: 30000 });

    if (!res.ok) {
      const detail = data?.detail ?? data?.raw ?? `HTTP ${res.status}`;
      setAuthStatus("LOGIN ERROR: " + detail);
      return;
    }

    token = data.token;
    username = data.username;
    saveSession();

    setAuthStatus("Login OK ✅");
    showChat();
    connectWS();
  } catch (err) {
    setAuthStatus("LOGIN FAIL: " + err.message);
  }
};

// ================= LOGOUT =================
$("btnLogout").onclick = (e) => {
  e.preventDefault();

  try { if (ws) ws.close(); } catch {}
  clearSession();
  $("messages").innerHTML = "";
  showAuth();
  setAuthStatus("Çıkış yapıldı.");
};

// ================= WEBSOCKET =================
function connectWS() {
  if (!token) return;

  ws = new WebSocket(`${WS_BASE}/ws?token=${encodeURIComponent(token)}`);

  ws.onopen = () => addMsg("WS bağlı ✅");

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg?.from && msg?.text) addMsg(`${msg.from}: ${msg.text}`);
      else addMsg(e.data);
    } catch {
      addMsg(e.data);
    }
  };

  ws.onerror = () => addMsg("WS hata ❌");
  ws.onclose = () => addMsg("WS kapandı ❌");
}

// ================= SEND MESSAGE =================
$("btnSend").onclick = (e) => {
  e.preventDefault();

  const to = $("toUser").value.trim();
  const text = $("msg").value;

  if (!ws || ws.readyState !== 1) {
    addMsg("WS bağlı değil.", "them");
    return;
  }
  if (!to) {
    addMsg("toUser boş.", "them");
    return;
  }
  if (!text) return;

  ws.send(JSON.stringify({ to, text }));
  addMsg(`Ben → ${to}: ${text}`, "me");
  $("msg").value = "";
};

// ================= AUTO RESTORE =================
(function init() {
  loadSession();
  if (token && username) {
    showChat();
    connectWS();
  } else {
    showAuth();
  }
})();
