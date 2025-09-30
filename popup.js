const BASE_URL = "http://10.200.108.66:8080/api/v1";
let loggedIn = false;

// --- Helpers ---
function scrollChatToBottom() {
  const chatWindow = document.getElementById("chatWindow");
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function renderMessage(content, sender = "bot") {
  const chatWindow = document.getElementById("chatWindow");

  const row = document.createElement("div");
  row.className = `messageRow ${sender}`;

  // avatar
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = sender === "user" ? "You" : "AI";

  // bubble
  const bubble = document.createElement("div");
  bubble.className = `message ${sender}`;
  bubble.textContent = content;

  // timestamp
  const time = document.createElement("div");
  time.className = "timestamp";
  time.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  bubble.appendChild(time);

  if (sender === "user") {
    row.appendChild(bubble);
    row.appendChild(avatar);
  } else {
    row.appendChild(avatar);
    row.appendChild(bubble);
  }

  chatWindow.appendChild(row);
  scrollChatToBottom();

  // persist
  chrome.storage.local.set({ chatHistory: chatWindow.innerHTML });
}

function showLoggedInUI(email) {
  loggedIn = true;
  document.getElementById("loginContainer").style.display = "none";
  document.getElementById("logoutBtn").style.display = "inline-block";
  document.getElementById("statusBar").textContent = `Connected as ${email}`;
  document.getElementById("statusBar").style.color = "#28a745";

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
    renderMessage("Please enter email and password.", "error");
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
    renderMessage("Logged in successfully. Nice to see you, how can I help?", "bot");

    if (remember) {
      chrome.storage.local.set({ savedEmail: email, savedPassword: password });
    } else {
      chrome.storage.local.remove(["savedEmail", "savedPassword"]);
    }
  } catch (err) {
    renderMessage(`Login error: ${err.message}`, "error");
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
    renderMessage("Please login first.", "error");
    return;
  }
  if (!input) return;

  renderMessage(input, "user");
  inputField.value = "";

  const thinkingId = Date.now();
  const chatWindow = document.getElementById("chatWindow");
  const thinkingBubble = document.createElement("div");
  thinkingBubble.className = "messageRow bot";
  thinkingBubble.id = `thinking-${thinkingId}`;
  thinkingBubble.innerHTML = `<div class="avatar">AI</div><div class="message bot">Typing...</div>`;
  chatWindow.appendChild(thinkingBubble);
  scrollChatToBottom();

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
    const reply = data?.choices?.[0]?.message?.content || "[No reply received from backend]";

    document.getElementById(`thinking-${thinkingId}`)?.remove();
    renderMessage(reply, "bot");
  } catch (err) {
    document.getElementById(`thinking-${thinkingId}`)?.remove();
    renderMessage(`Error: ${err.message}`, "error");
  }
  inputField.focus();
}

document.getElementById("sendBtn").addEventListener("click", sendMessage);

document.getElementById("input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// --- New chat ---
document.getElementById("newChatBtn").addEventListener("click", () => {
  renderMessage("--- New Chat ---", "bot");
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

    const ok = await checkAuth();
    if (!ok && data.savedEmail && data.savedPassword) {
      try {
        const res = await fetch(`${BASE_URL}/auths/signin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: data.savedEmail, password: data.savedPassword }),
          credentials: "include",
        });
        if (res.ok) {
          showLoggedInUI(data.savedEmail);
          renderMessage("Auto-login successful. Nice to see you, how can I help?", "bot");
        }
      } catch {}
    }
  });
});

// --- Dark Mode Toggle ---
const themeToggle = document.getElementById("toggle_checkbox");

chrome.storage.local.get("theme", (data) => {
  if (data.theme === "dark") {
    document.body.classList.add("dark-mode");
    themeToggle.checked = true;
  } else {
    document.body.classList.remove("dark-mode");
    themeToggle.checked = false;
  }
});

themeToggle.addEventListener("change", () => {
  if (themeToggle.checked) {
    document.body.classList.add("dark-mode");
    chrome.storage.local.set({ theme: "dark" });
  } else {
    document.body.classList.remove("dark-mode");
    chrome.storage.local.set({ theme: "light" });
  }
});
