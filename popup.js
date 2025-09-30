const BASE_URL = "http://10.200.108.66:8080/api/v1";
let loggedIn = false;

// --- Helpers ---
function scrollChatToBottom() {
  const chatWindow = document.getElementById("chatWindow");
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function updateChatWindow(content) {
  const chatWindow = document.getElementById("chatWindow");
  chatWindow.innerHTML += content;
  scrollChatToBottom();
  chrome.storage.local.set({ chatHistory: chatWindow.innerHTML });
}

function showLoggedInUI(email) {
  loggedIn = true;
  document.getElementById("loginContainer").style.display = "none";

  document.getElementById("welcomeBar").style.display = "block";
  document.getElementById("welcomeMsg").textContent = `Hi, ${email}`;

  document.getElementById("input").disabled = false;
  document.getElementById("sendBtn").disabled = false;
}

// --- Check existing session ---
async function checkAuth() {
  try {
    const res = await fetch(`${BASE_URL}/auths/me`, {
      credentials: "include",
    });
    if (res.ok) {
      const data = await res.json();
      showLoggedInUI(data?.email || "User");
      return true;
    }
  } catch {}
  return false;
}

// --- Login ---
document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const remember = document.getElementById("rememberMe").checked;

  if (!email || !password) {
    updateChatWindow(
      `<div class="message error">Please enter email and password.</div>`
    );
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/auths/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });

    if (!res.ok) throw new Error("HTTP " + res.status);

    showLoggedInUI(email);
    updateChatWindow(`<div class="message bot">Logged in successfully.</div>`);

    // Save credentials only if remember is checked
    if (remember) {
      chrome.storage.local.set({ savedEmail: email, savedPassword: password });
    } else {
      chrome.storage.local.remove(["savedEmail", "savedPassword"]);
    }
  } catch (err) {
    updateChatWindow(
      `<div class="message error">Login error: ${err.message}</div>`
    );
  }
});

// --- Logout ---
document.getElementById("logoutBtn").addEventListener("click", async () => {
  try {
    await fetch(`${BASE_URL}/auths/signout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {}
  chrome.storage.local.remove(["chatHistory", "savedEmail", "savedPassword"]);
  location.reload();
});

// --- Send message ---
async function sendMessage() {
  const inputField = document.getElementById("input");
  const input = inputField.value.trim();

  if (!loggedIn) {
    updateChatWindow(`<div class="message error">Please login first.</div>`);
    return;
  }
  if (!input) return;

  updateChatWindow(`<div class="message user">${input}</div>`);
  inputField.value = "";

  const thinkingId = Date.now();
  updateChatWindow(
    `<div class="message bot" id="thinking-${thinkingId}">Typing...</div>`
  );

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        model: "assistant-1---gemma312b",
        messages: [{ role: "user", content: input }],
      }),
    });

    if (!res.ok) throw new Error("HTTP " + res.status);

    const data = await res.json();
    const reply =
      data?.choices?.[0]?.message?.content || "[No reply received from backend]";

    document.getElementById(`thinking-${thinkingId}`)?.remove();
    updateChatWindow(`<div class="message bot">${reply}</div>`);
  } catch (err) {
    document.getElementById(`thinking-${thinkingId}`)?.remove();
    updateChatWindow(
      `<div class="message error">Error: ${err.message}</div>`
    );
  }
  inputField.focus();
}

document.getElementById("sendBtn").addEventListener("click", sendMessage);

// Enter = Send, Shift+Enter = newline
document.getElementById("input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// --- New chat ---
document.getElementById("newChatBtn").addEventListener("click", () => {
  updateChatWindow(
    `<div class="message bot" style="text-align:center; width:100%; background:#eee; color:#555; border-radius:6px;">--- New Chat ---</div>`
  );
});

// --- Clear chat ---
document.getElementById("clearChatBtn").addEventListener("click", () => {
  document.getElementById("chatWindow").innerHTML = "";
  chrome.storage.local.remove("chatHistory");
});

// --- Restore chat + check session on load ---
document.addEventListener("DOMContentLoaded", async () => {
  chrome.storage.local.get(["chatHistory", "savedEmail", "savedPassword"], async (data) => {
    if (data.chatHistory) {
      document.getElementById("chatWindow").innerHTML = data.chatHistory;
      scrollChatToBottom();
    }

    // First try cookie/session
    const ok = await checkAuth();
    if (!ok && data.savedEmail && data.savedPassword) {
      // Auto re-login if saved credentials exist
      try {
        const res = await fetch(`${BASE_URL}/auths/signin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: data.savedEmail, password: data.savedPassword }),
          credentials: "include",
        });
        if (res.ok) {
          showLoggedInUI(data.savedEmail);
          updateChatWindow(`<div class="message bot">🔑 Auto-login successful.</div>`);
        }
      } catch {}
    }
  });
});
