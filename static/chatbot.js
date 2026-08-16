/* ═══════════════════════════════════════════════════
   CHATBOT JS — calls Groq API directly from browser
   Model: llama-3.3-70b-versatile
   FIXES:
   - Each message gets a unique streaming bubble ID
   - History items are clickable and restore chat
═══════════════════════════════════════════════════ */

const GROQ_API_KEY = "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";
const GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions";

let isSending      = false;
let msgCount       = 1;
let topicCount     = 0;
let sessionSeconds = 0;
let chatHistory    = [];
let savedSessions  = []; // array of {title, history:[{role,content}]}
let inputEl, sendBtn, messagesEl;

document.addEventListener('DOMContentLoaded', () => {
  inputEl    = document.getElementById('chat-input');
  sendBtn    = document.getElementById('send-btn');
  messagesEl = document.getElementById('chat-messages');

  if (!inputEl || !sendBtn || !messagesEl) {
    console.error('Chatbot: required elements not found.');
    return;
  }

  unlockInput();
  startSessionTimer();
  loadSessions();
});

// ── Lock / unlock ──
function lockInput() {
  isSending = true;
  if (inputEl) inputEl.disabled = true;
  if (sendBtn) sendBtn.disabled = true;
}
function unlockInput() {
  isSending = false;
  if (inputEl) inputEl.disabled = false;
  if (sendBtn) sendBtn.disabled = false;
  if (inputEl) inputEl.focus();
}

// ── Format text ──
function formatText(t) {
  return String(t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code style="background:var(--purple-light);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:.85em">$1</code>')
    .replace(/\n/g, '<br>');
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

// ── Add a complete bubble (user or final bot) ──
function addBubble(text, sender) {
  const row      = document.createElement('div');
  row.className  = 'msg-row' + (sender === 'user' ? ' user' : '');
  const avatar   = document.createElement('div');
  avatar.className = 'msg-avatar ' + (sender === 'user' ? 'user' : 'bot');
  avatar.textContent = sender === 'user' ? '🙂' : '🐰';
  const col      = document.createElement('div');
  col.className  = 'msg-col';
  const bubble   = document.createElement('div');
  bubble.className = 'bubble ' + (sender === 'user' ? 'user' : 'bot');
  bubble.innerHTML = formatText(text);
  const time     = document.createElement('div');
  time.className = 'msg-time';
  time.textContent = getTime();
  col.appendChild(bubble);
  col.appendChild(time);
  row.appendChild(avatar);
  row.appendChild(col);
  messagesEl.appendChild(row);
  scrollToBottom();
  return bubble;
}

// ── Typing indicator ──
function showTyping() {
  const row      = document.createElement('div');
  row.className  = 'msg-row';
  row.id         = 'typing-row';
  row.innerHTML  =
    '<div class="msg-avatar bot">🐰</div>' +
    '<div class="msg-col">' +
      '<div class="bubble bot typing"><span></span><span></span><span></span></div>' +
    '</div>';
  messagesEl.appendChild(row);
  scrollToBottom();
}
function hideTyping() {
  const el = document.getElementById('typing-row');
  if (el) el.remove();
}

// ── FIX 1: Create a UNIQUE streaming bubble each time ──
function createStreamingBubble() {
  hideTyping();
  const uniqueId = 'sb-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  const row      = document.createElement('div');
  row.className  = 'msg-row';
  row.innerHTML  =
    '<div class="msg-avatar bot">🐰</div>' +
    '<div class="msg-col">' +
      `<div class="bubble bot" id="${uniqueId}"></div>` +
      '<div class="msg-time">' + getTime() + '</div>' +
    '</div>';
  messagesEl.appendChild(row);
  scrollToBottom();
  return document.getElementById(uniqueId); // returns the specific bubble element
}

function getTime() {
  const now = new Date();
  return now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
}

// ── MAIN SEND ──
async function sendMessage() {
  if (isSending) return;
  if (!inputEl) return;
  const text = inputEl.value.trim();
  if (!text) return;

  lockInput();
  inputEl.value = '';
  addBubble(text, 'user');
  updateMsgCount();
  showTyping();

  const groqMessages = [
    {
      role: 'system',
      content: 'You are a friendly, expert study tutor in FocusYou app. Explain concepts clearly with simple language, examples, and bullet points. Keep replies concise. Use emojis occasionally.'
    }
  ];
  chatHistory.slice(-16).forEach(m => groqMessages.push(m));
  groqMessages.push({ role: 'user', content: text });

  let accumulated = '';
  let bubbleEl    = null;
  let gotAnyText  = false;

  try {
    const res = await fetch(GROQ_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + GROQ_API_KEY
      },
      body: JSON.stringify({
        model:       'llama-3.3-70b-versatile',
        messages:    groqMessages,
        max_tokens:  1024,
        temperature: 0.7,
        stream:      true
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || 'API error ' + res.status);
    }

    // FIX 1: create a fresh unique bubble for THIS message
    bubbleEl = createStreamingBubble();

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer    = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const frames = buffer.split('\n\n');
      buffer = frames.pop();

      for (const frame of frames) {
        const line = frame.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;

        let obj;
        try { obj = JSON.parse(payload); } catch(e) { continue; }

        if (obj.error) {
          if (bubbleEl) bubbleEl.innerHTML = formatText('⚠️ ' + obj.error.message);
          gotAnyText = true;
          continue;
        }

        const token = obj?.choices?.[0]?.delta?.content || '';
        if (token) {
          accumulated += token;
          // FIX 1: update only THIS bubble, not any previous one
          if (bubbleEl) bubbleEl.innerHTML = formatText(accumulated);
          scrollToBottom();
          gotAnyText = true;
        }
      }
    }

    if (!gotAnyText) {
      hideTyping();
      addBubble("Hmm, I didn't get a response — please try again.", 'bot');
    } else {
      // Save to context
      chatHistory.push({ role: 'user',      content: text });
      chatHistory.push({ role: 'assistant', content: accumulated });
      if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);

      topicCount++;
      updateTopicCount();

      // FIX 2: save session after first exchange
      if (chatHistory.length === 2) {
        saveSession(text.length > 30 ? text.slice(0, 28) + '...' : text);
      } else {
        updateCurrentSession();
      }
    }
    updateMsgCount();

  } catch (err) {
    console.error('Chat error:', err);
    hideTyping();
    if (bubbleEl) {
      bubbleEl.innerHTML = formatText('⚠️ ' + (err.message || 'Something went wrong. Please try again!'));
    } else {
      addBubble('⚠️ ' + (err.message || 'Something went wrong. Please try again!'), 'bot');
    }
  } finally {
    unlockInput();
  }
}

// ── Chip / mood ──
function useChip(text) {
  if (isSending || !inputEl) return;
  inputEl.value = text;
  sendMessage();
}
function useMood(moodText) {
  if (isSending || !inputEl) return;
  inputEl.value = "I'm feeling " + moodText + " right now.";
  sendMessage();
}

// ── New chat ──
function newChat() {
  if (!messagesEl) return;
  // Save current session if it has messages
  if (chatHistory.length > 0) updateCurrentSession();

  chatHistory = [];
  msgCount = 1; topicCount = 0;

  messagesEl.innerHTML =
    '<div class="date-divider">Today</div>' +
    '<div class="msg-row">' +
      '<div class="msg-avatar bot">🐰</div>' +
      '<div class="msg-col">' +
        '<div class="bubble bot">Hey ' + (window.USERNAME || 'there') + '! 👋 Starting a fresh chat — what would you like to work on?</div>' +
        '<div class="msg-time">just now</div>' +
      '</div>' +
    '</div>';

  updateMsgCount();
  updateTopicCount();
  renderHistoryList();
  if (inputEl) inputEl.focus();
}

// ── Stats ──
function updateMsgCount() {
  msgCount = document.querySelectorAll('#chat-messages .msg-row').length || 1;
  const el = document.getElementById('msgCount');
  if (el) el.textContent = msgCount;
}
function updateTopicCount() {
  const el = document.getElementById('topicCount');
  if (el) el.textContent = topicCount;
}
function startSessionTimer() {
  setInterval(() => {
    sessionSeconds++;
    const m = Math.floor(sessionSeconds / 60);
    const s = sessionSeconds % 60;
    const el = document.getElementById('sessionTime');
    if (el) el.textContent = m + ':' + (s < 10 ? '0' : '') + s;
  }, 1000);
}

// ── FIX 2: Session history with full restore ──
function loadSessions() {
  try {
    savedSessions = JSON.parse(localStorage.getItem('fy_chat_sessions') || '[]');
  } catch(e) {
    savedSessions = [];
  }
  renderHistoryList();
}

function saveSession(title) {
  const session = {
    id:      Date.now(),
    title:   title,
    time:    getTime(),
    history: [...chatHistory]
  };
  savedSessions.unshift(session);
  if (savedSessions.length > 15) savedSessions = savedSessions.slice(0, 15);
  localStorage.setItem('fy_chat_sessions', JSON.stringify(savedSessions));
  renderHistoryList();
}

function updateCurrentSession() {
  if (savedSessions.length === 0) return;
  savedSessions[0].history = [...chatHistory];
  localStorage.setItem('fy_chat_sessions', JSON.stringify(savedSessions));
}

// FIX 2: Render history items with click handler that RESTORES the chat
function renderHistoryList() {
  const list = document.getElementById('historyList');
  if (!list) return;

  if (savedSessions.length === 0) {
    list.innerHTML = '<div style="font-size:.78rem;color:var(--text-muted);font-weight:600;padding:10px 6px;">No chats yet — start talking! 💬</div>';
    return;
  }

  list.innerHTML = '';
  savedSessions.forEach((session, i) => {
    const div       = document.createElement('div');
    div.className   = 'history-item' + (i === 0 ? ' active' : '');
    div.style.cursor = 'pointer';
    div.innerHTML   =
      `<div class="history-item-title">${session.title}</div>` +
      `<div class="history-item-sub">${session.time} · ${session.history.length / 2 | 0} exchanges</div>`;

    // FIX 2: clicking restores that session's messages
    div.addEventListener('click', () => {
      restoreSession(session, i);
    });

    list.appendChild(div);
  });
}

function restoreSession(session, idx) {
  if (!messagesEl) return;

  // Mark active
  document.querySelectorAll('.history-item').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });

  // Restore history array
  chatHistory = [...session.history];

  // Rebuild messages UI
  messagesEl.innerHTML = '<div class="date-divider">Restored Chat</div>';

  for (let i = 0; i < session.history.length; i++) {
    const m      = session.history[i];
    const sender = m.role === 'user' ? 'user' : 'bot';
    const row    = document.createElement('div');
    row.className = 'msg-row' + (sender === 'user' ? ' user' : '');
    const avatar  = document.createElement('div');
    avatar.className = 'msg-avatar ' + sender;
    avatar.textContent = sender === 'user' ? '🙂' : '🐰';
    const col     = document.createElement('div');
    col.className = 'msg-col';
    const bubble  = document.createElement('div');
    bubble.className = 'bubble ' + sender;
    bubble.innerHTML = formatText(m.content);
    const time    = document.createElement('div');
    time.className = 'msg-time';
    time.textContent = session.time;
    col.appendChild(bubble);
    col.appendChild(time);
    row.appendChild(avatar);
    row.appendChild(col);
    messagesEl.appendChild(row);
  }

  updateMsgCount();
  scrollToBottom();
  if (inputEl) inputEl.focus();
}

// ── Enter key ──
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && document.activeElement === inputEl) {
    e.preventDefault();
    sendMessage();
  }
});