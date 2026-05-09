const socket = io();
let messages = ['Hello!'];
let onlineChart = null;
let chartData = {
  labels: [],
  online: [],
  kicked: []
};

const token = localStorage.getItem('token');
if (!token || token !== 'auth_ok') {
  window.location.href = '/';
}

socket.emit('auth', { token }, (res) => {
  if (!res || !res.success) {
    localStorage.removeItem('token');
    window.location.href = '/';
  }
});

socket.on('status', (status) => {
  const statusEl = document.getElementById('status-text');
  if (statusEl) {
    statusEl.textContent = status.status === 'running' ? 'Активен' : 'Остановлен';
    statusEl.style.color = status.status === 'running' ? '#00ff88' : '#888';
    statusEl.className = 'stat-value';
  }
  setText('total-bots', status.totalBots || 0);
  setText('online-bots', status.online || 0);
  setText('kicked-bots', status.kicked || 0);
  setText('messages-sent', status.messagesSent || 0);
  setText('errors-count', status.errors || 0);
  const uptime = status.uptime || 0;
  const hrs = Math.floor(uptime / 3600000);
  const mins = Math.floor((uptime % 3600000) / 60000);
  const secs = Math.floor((uptime % 60000) / 1000);
  setText('uptime', `${hrs}h ${mins}m ${secs}s`);
  const now = new Date().toLocaleTimeString();
  chartData.labels.push(now);
  chartData.online.push(status.online || 0);
  chartData.kicked.push(status.kicked || 0);
  if (chartData.labels.length > 60) { chartData.labels.shift(); chartData.online.shift(); chartData.kicked.shift(); }
  updateChart();
});

socket.on('log', (entry) => { addLogEntry(entry); });
socket.on('logs', (logs) => {
  const container = document.getElementById('log-container');
  if (container) { container.innerHTML = ''; logs.forEach(entry => addLogEntry(entry)); }
});

socket.on('manual_status', (status) => {
  const dot = document.getElementById('manual-status-dot');
  const text = document.getElementById('manual-status-text');
  if (!dot || !text) return;
  if (status.connected) { dot.className = 'status-dot connected'; text.textContent = 'Подключён как ' + (status.username || ''); text.style.color = '#00ff88'; }
  else if (status.connecting) { dot.className = 'status-dot disconnected'; text.textContent = 'Подключение...'; text.style.color = '#ffaa00'; }
  else { dot.className = 'status-dot disconnected'; text.textContent = 'Не подключён'; text.style.color = '#888'; }
});

socket.on('manual_message', (entry) => {
  if (entry.type === 'chat' || entry.type === 'raw') { addServerChatMessage(entry); }
  if (entry.type === 'sent' || entry.type === 'error' || entry.type === 'system') { addCommandChatMessage(entry); }
});

socket.on('manual_messages', (msgs) => {
  const serverChat = document.getElementById('server-chat');
  const cmdChat = document.getElementById('command-chat');
  if (!serverChat || !cmdChat) return;
  serverChat.innerHTML = ''; cmdChat.innerHTML = '';
  msgs.forEach(entry => {
    if (entry.type === 'chat' || entry.type === 'raw') { addServerChatMessage(entry); }
    if (entry.type === 'sent' || entry.type === 'error' || entry.type === 'system') { addCommandChatMessage(entry); }
  });
});

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

function initChart() {
  const canvas = document.getElementById('onlineChart');
  if (!canvas) return;
  onlineChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels: chartData.labels, datasets: [
      { label: 'Онлайн', data: chartData.online, borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,0.05)', borderWidth: 2, tension: 0.3, fill: true, pointRadius: 0 },
      { label: 'Кикнуто', data: chartData.kicked, borderColor: '#ff4444', backgroundColor: 'rgba(255,68,68,0.05)', borderWidth: 2, tension: 0.3, fill: true, pointRadius: 0 }
    ]},
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 200 },
      scales: { x: { grid: { color: '#1a1a2e' }, ticks: { color: '#666', maxTicksLimit: 10 } }, y: { grid: { color: '#1a1a2e' }, ticks: { color: '#666', beginAtZero: true } } },
      plugins: { legend: { labels: { color: '#00ff88' } } }
    }
  });
}
function updateChart() { if (onlineChart) { onlineChart.data.labels = chartData.labels; onlineChart.data.datasets[0].data = chartData.online; onlineChart.data.datasets[1].data = chartData.kicked; onlineChart.update(); } }

function showTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  const tabEl = document.getElementById(tab);
  const navEl = document.getElementById('tab-' + tab);
  if (tabEl) tabEl.classList.add('active');
  if (navEl) navEl.classList.add('active');
}

function startBots() {
  const config = {
    host: document.getElementById('cfg-host').value, port: parseInt(document.getElementById('cfg-port').value),
    version: document.getElementById('cfg-version').value, baseUsername: document.getElementById('cfg-username').value,
    count: parseInt(document.getElementById('cfg-count').value), threadCount: parseInt(document.getElementById('cfg-threads').value),
    delayBetweenBotsSeconds: parseFloat(document.getElementById('cfg-delay').value), finalDelaySeconds: parseInt(document.getElementById('cfg-final-delay').value),
    messages: messages
  };
  fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, config }) });
  socket.emit('start', config);
}
function stopBots() { socket.emit('stop'); }
function renderMessages() { const list = document.getElementById('messages-list'); if (list) list.innerHTML = messages.map((msg,i) => '<div class="msg-item"><span>'+escapeHtml(msg)+'</span><button class="msg-del" onclick="removeMessage('+i+')">x</button></div>').join(''); }
function addMessage() { const input = document.getElementById('new-message'); if (input && input.value.trim()) { messages.push(input.value.trim()); input.value = ''; renderMessages(); } }
function removeMessage(i) { messages.splice(i,1); renderMessages(); }

function parseMc(text) {
  const mc = { '0':'#000','1':'#00A','2':'#0A0','3':'#0AA','4':'#A00','5':'#A0A','6':'#FA0','7':'#AAA','8':'#555','9':'#55F','a':'#5F5','b':'#5FF','c':'#F55','d':'#F5F','e':'#FF5','f':'#FFF' };
  let r = '', d = 0, i = 0;
  while (i < text.length) {
    if (text[i] === '\u00A7' && i+1 < text.length) {
      const c = text[i+1].toLowerCase();
      if (c === 'r') { r += '</span>'.repeat(d); d = 0; }
      else if (c === 'l') { r += '<span style="font-weight:bold">'; d++; }
      else if (c === 'o') { r += '<span style="font-style:italic">'; d++; }
      else if (c === 'k') {}
      else if (mc[c]) { r += '</span>'.repeat(d); d = 0; r += '<span style="color:'+mc[c]+'">'; d++; }
      i += 2;
    } else {
      const ch = text[i];
      if (ch === '&') r += '&';
      else if (ch === '<') r += '<';
      else if (ch === '>') r += '>';
      else r += ch;
      i++;
    }
  }
  return r + '</span>'.repeat(d);
}

function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
function logout() { localStorage.removeItem('token'); window.location.href = '/'; }

function connectManualBot() {
  const username = document.getElementById('manual-username');
  const host = document.getElementById('manual-host');
  const port = document.getElementById('manual-port');
  const version = document.getElementById('manual-version');
  const joinmsg = document.getElementById('manual-joinmsg');
  if (!username || !host || !port || !version) return;
  socket.emit('connect_bot', {
    username: username.value || 'Bot',
    host: host.value || 'localhost',
    port: parseInt(port.value) || 19132,
    version: version.value || '1.20.80',
    joinMessage: joinmsg ? joinmsg.value : ''
  });
}
function disconnectManualBot() { socket.emit('disconnect_bot'); }
function sendCommand() { const input = document.getElementById('command-input'); if (input && input.value.trim()) { socket.emit('bot_command', input.value.trim()); input.value = ''; } }

function addLogEntry(entry) {
  const container = document.getElementById('log-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = 'log-entry log-' + (entry.type || 'info');
  const time = entry.time ? new Date(entry.time).toLocaleTimeString() : '';
  el.innerHTML = '<span class="log-time">[' + time + ']</span><span class="log-msg">' + parseMc(entry.message) + '</span>';

  container.appendChild(el);
  container.scrollTop = container.scrollHeight;

  while (container.children.length > 200) {
    container.removeChild(container.firstChild);
  }
}

function addServerChatMessage(entry) {
  const container = document.getElementById('server-chat');
  if (!container) return;

  const el = document.createElement('div');
  el.className = 'chat-msg msg-' + (entry.type || 'chat');
  const time = entry.time ? new Date(entry.time).toLocaleTimeString() : '';
  el.innerHTML = '<span class="msg-time">[' + time + ']</span>' + parseMc(entry.text);

  container.appendChild(el);
  container.scrollTop = container.scrollHeight;

  while (container.children.length > 200) {
    container.removeChild(container.firstChild);
  }
}

function addCommandChatMessage(entry) {
  const container = document.getElementById('command-chat');
  if (!container) return;

  const el = document.createElement('div');
  const type = entry.type === 'sent' ? 'sent' : (entry.type === 'error' ? 'error' : 'system');
  el.className = 'chat-msg msg-' + type;
  const time = entry.time ? new Date(entry.time).toLocaleTimeString() : '';
  el.innerHTML = '<span class="msg-time">[' + time + ']</span>' + parseMc(entry.text);

  container.appendChild(el);
  container.scrollTop = container.scrollHeight;

  while (container.children.length > 200) {
    container.removeChild(container.firstChild);
  }
}

fetch('/api/config?token=' + token).then(r => r.json()).then(data => {
  if (data.success && data.config) {
    const c = data.config;
    if (document.getElementById('cfg-host')) document.getElementById('cfg-host').value = c.host || 'localhost';
    if (document.getElementById('cfg-port')) document.getElementById('cfg-port').value = c.port || 19132;
    if (document.getElementById('cfg-version')) document.getElementById('cfg-version').value = c.version || '1.20.80';
    if (document.getElementById('cfg-username')) document.getElementById('cfg-username').value = c.baseUsername || 'Bot';
    if (document.getElementById('cfg-count')) document.getElementById('cfg-count').value = c.count || 10;
    if (document.getElementById('cfg-threads')) document.getElementById('cfg-threads').value = c.threadCount || 1;
    if (document.getElementById('cfg-delay')) document.getElementById('cfg-delay').value = c.delayBetweenBotsSeconds || 1;
    if (document.getElementById('cfg-final-delay')) document.getElementById('cfg-final-delay').value = c.finalDelaySeconds || 30;
    if (c.messages && c.messages.length) { messages = c.messages; renderMessages(); }
  }
});

renderMessages();
initChart();

setInterval(() => { socket.emit('getStatus'); socket.emit('get_manual_status'); }, 5000);