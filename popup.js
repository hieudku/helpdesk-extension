const BASE_URL = "http://10.200.108.66:8080/api/v1";

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

// Send message
async function sendMessage() {
  const inputField = document.getElementById("input");
  const input = inputField.value.trim();

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

// New Chat (keeps storage, just adds divider)
document.getElementById("newChatBtn").addEventListener("click", () => {
  updateChatWindow(
    `<div class="message bot" style="text-align:center; width:100%; background:#eee; color:#555; border-radius:6px;">--- New Chat ---</div>`
  );
});

// Clear Chat (wipe everything)
document.getElementById("clearChatBtn").addEventListener("click", () => {
  document.getElementById("chatWindow").innerHTML = "";
  chrome.storage.local.remove("chatHistory");
});
