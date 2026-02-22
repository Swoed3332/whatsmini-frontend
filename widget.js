// ================= CONFIG =================
const API_BASE = "https://whatsmini.onrender.com";
const WS_BASE = API_BASE
  .replace("https://", "wss://")
  .replace("http://", "ws://");

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
async function api(path, method = "GET", body = null) {
  const res = await fetch(API_BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => ({}));
  return { res, data };
}

// ================= REGISTER =================
$("btnRegister").onclick = async (e) => {
  e.preventDefault();

  const user = $("username").value.trim();
  const pass = $("password").value;

  if (!user || !pass) {
    $("authStatus").innerText = "Boş alan var.";
    return;
  }

  const { res, data } = await api("/api/register", "POST", {
    username: user,
    password: pass
  });

  if (!res.ok) {
    $("authStatus").innerText = data.detail || "Register error";
    return;
  }

  $("authStatus").innerText = "Register OK ✅ Login yap.";
};

// ================= LOGIN =================
$("btnLogin").onclick = async (e) => {
  e.preventDefault();

  const user = $("username").value.trim();
  const pass = $("password").value;

  if (!user || !pass) {
    $("authStatus").innerText = "Boş alan var.";
    return;
  }

  try {
    const { res, data } = await api("/api/login", "POST", {
      username: user,
      password: pass
    });

    if (!res.ok) {
      $("authStatus").innerText = data.detail || "Login error";
      return;
    }

    token = data.token;
    username = data.username;
    saveSession();

    $("authStatus").innerText = "Login OK ✅";
    showChat();
    connectWS();

  } catch (err) {
    $("authStatus").innerText = "Network error ❌";
  }
};

// ================= LOGOUT =================
$("btnLogout").onclick = (e) => {
  e.preventDefault();

  if (ws) ws.close();
  clearSession();
  $("messages").innerHTML = "";
  showAuth();
};

// ================= WEBSOCKET =================
function connectWS() {
  if (!token) return;

  ws = new WebSocket(`${WS_BASE}/ws?token=${encodeURIComponent(token)}`);

  ws.onopen = () => {
    addMsg("WS bağlı ✅");
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      addMsg(`${msg.from}: ${msg.text}`);
    } catch {
      addMsg(e.data);
    }
  };

  ws.onerror = () => {
    addMsg("WS hata ❌");
  };

  ws.onclose = () => {
    addMsg("WS kapandı ❌");
  };
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

  if (!to || !text) return;

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
