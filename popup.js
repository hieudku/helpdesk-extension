const BASE_URL = "http://10.200.108.66:8080/api/v1"; // backend
let loggedIn = false;

// Login
document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const output = document.getElementById("output");

  if (!email || !password) {
    output.textContent = "Please enter email and password.";
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/auths/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include"
    });

    if (!res.ok) throw new Error("HTTP " + res.status);

    loggedIn = true;

    // Hide login form
    document.getElementById("loginSection").style.display = "none";
    document.getElementById("loginTitle").style.display = "none";

    // Show welcome message
    const welcomeMsg = document.getElementById("welcomeMsg");
    welcomeMsg.textContent = `Hi, ${email}`;
    welcomeMsg.style.display = "block";

    // Enable chat
    document.getElementById("input").disabled = false;
    document.getElementById("sendBtn").disabled = false;

    output.textContent = ""; // clear old messages
  } catch (err) {
    output.textContent = "Login error: " + err.message;
  }
});

// Send message
document.getElementById("sendBtn").addEventListener("click", async () => {
  const input = document.getElementById("input").value.trim();
  const output = document.getElementById("output");

  if (!loggedIn) {
    output.textContent = "Please login first.";
    return;
  }
  if (!input) return;

  output.textContent = "Loading...";

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // send cookie from login
      body: JSON.stringify({
        model: "assistant-1---gemma312b", // load default model with knowledge loaded
        messages: [{ role: "user", content: input }]
      })
    });

    if (!res.ok) throw new Error("HTTP " + res.status);

    const data = await res.json();
    output.textContent = data?.choices?.[0]?.message?.content || JSON.stringify(data, null, 2);
  } catch (err) {
    output.textContent = "Error: " + err.message;
  }
});
