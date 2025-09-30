const BASE_URL = "http://10.200.108.66:8080/api/v1";
let loggedIn = false;

// Restore chat history when popup opens
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get("chatHistory", (data) => {
    if (data.chatHistory) {
      document.getElementById("chatWindow").innerHTML = data.chatHistory;
      scrollChatToBottom();
    }
  });
});

// Scroll helper
function scrollChatToBottom() {
  const chatWindow = document.getElementById("chatWindow");
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Append + persist messages
function updateChatWindow(content) {
  const chatWindow = document.getElementById("chatWindow");
  chatWindow.innerHTML += content;
  scrollChatToBottom();
  chrome.storage.local.set({ chatHistory: chatWindow.innerHTML });
}

// Login
document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

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

    loggedIn = true;

    // Hide login form
    document.getElementById("loginSection").style.display = "none";
    document.getElementById("loginTitle").style.display = "none";

    // Show welcome
    const welcomeMsg = document.getElementById("welcomeMsg");
    welcomeMsg.textContent = `Hi, ${email}`;
    welcomeMsg.style.display = "block";

    // Enable chat
    document.getElementById("input").disabled = false;
    document.getElementById("sendBtn").disabled = false;

    updateChatWindow(
      `<div class="message bot"> Logged in successfully.</div>`
    );
  } catch (err) {
    updateChatWindow(
      `<div class="message error">Login error: ${err.message}</div>`
    );
  }
});

// Send message
async function sendMessage() {
  const inputField = document.getElementById("input");
  const input = inputField.value.trim();

  if (!loggedIn) {
    updateChatWindow(`<div class="message error">Please login first.</div>`);
    return;
  }
  if (!input) return;

  // Append user message
  updateChatWindow(`<div class="message user">${input}</div>`);
  inputField.value = "";

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
      data?.choices?.[0]?.message?.content ||
      "[No reply received from backend]";
    updateChatWindow(`<div class="message bot">${reply}</div>`);
  } catch (err) {
    updateChatWindow(
      `<div class="message error">Error: ${err.message}</div>`
    );
  }
}

document.getElementById("sendBtn").addEventListener("click", sendMessage);

// Allow Enter key to send
document.getElementById("input").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendMessage();
  }
});
