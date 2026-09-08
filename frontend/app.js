const loginScreen = document.getElementById("login-screen");
const chatScreen = document.getElementById("chat-screen");
const usernameInput = document.getElementById("username-input");
const joinBtn = document.getElementById("join-btn");
const loginError = document.getElementById("login-error");

const messagesEl = document.getElementById("messages");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const statusText = document.getElementById("status-text");
const meLabel = document.getElementById("me-label");

// Backend is reached via the same hostname the page was loaded from
// (whoever's machine is hosting docker compose), just on port 8000.
// This works whether you're on LAN or WiFi, as long as you're on the
// same local network as the host.
const BACKEND_HOST = window.location.hostname;
const WS_URL = `ws://${BACKEND_HOST}:8000/ws/`;
const API_URL = `http://${BACKEND_HOST}:8000/api`;

let username = "";
let socket = null;

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function addMessage(msg) {
  const row = document.createElement("div");
  row.className = "msg-row " + (msg.username === username ? "mine" : "theirs");

  const name = document.createElement("div");
  name.className = "msg-name";
  name.textContent = msg.username;

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.textContent = msg.text;

  const time = document.createElement("div");
  time.className = "msg-time";
  time.textContent = msg.created_at ? fmtTime(msg.created_at) : "";

  row.appendChild(name);
  row.appendChild(bubble);
  row.appendChild(time);
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addSystemMessage(text) {
  const div = document.createElement("div");
  div.className = "system-msg";
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function loadHistory() {
  try {
    const res = await fetch(`${API_URL}/messages`);
    const data = await res.json();
    data.forEach(addMessage);
  } catch (e) {
    addSystemMessage("couldn't load history :(");
  }
}

function connect() {
  socket = new WebSocket(WS_URL + encodeURIComponent(username));

  socket.onopen = () => {
    statusText.textContent = "connected";
  };

  socket.onclose = () => {
    statusText.textContent = "disconnected — retrying...";
    setTimeout(connect, 2000);
  };

  socket.onerror = () => {
    statusText.textContent = "connection error";
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "message") {
      addMessage(data);
    } else if (data.type === "system") {
      addSystemMessage(data.text);
    }
  };
}

async function join() {
  const name = usernameInput.value.trim();
  if (!name) {
    loginError.textContent = "type a name first!";
    return;
  }
  username = name;
  meLabel.textContent = "you: " + username;

  loginScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");

  await loadHistory();
  connect();
}

joinBtn.addEventListener("click", join);
usernameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") join();
});

messageForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text || !socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ text }));
  messageInput.value = "";
});
