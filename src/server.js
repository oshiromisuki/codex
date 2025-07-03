const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, '..', 'data.json');

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    return { users: [], exchangeRate: { USDJPY: 150, lastUpdated: new Date().toISOString() } };
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '{}');
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let data = loadData();

function hashPassword(pwd) {
  return crypto.createHash('sha256').update(pwd).digest('hex');
}

function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

function parseBody(req, callback) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const parsed = JSON.parse(body || '{}');
      callback(null, parsed);
    } catch (e) {
      callback(e);
    }
  });
}

function getUserFromAuth(req) {
  const token = req.headers['x-session-token'];
  if (!token) return null;
  return data.users.find(u => u.token === token);
}

function handleApi(req, res) {
  if (req.url === '/api/signup' && req.method === 'POST') {
    parseBody(req, (err, body) => {
      if (err) { res.writeHead(400); return res.end('Bad JSON'); }
      const { username, password } = body;
      if (!username || !password) { res.writeHead(400); return res.end('Missing fields'); }
      if (data.users.find(u => u.username === username)) { res.writeHead(400); return res.end('User exists'); }
      const user = { id: generateId(), username, passwordHash: hashPassword(password), subscriptions: [], token: generateId() };
      data.users.push(user);
      saveData(data);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ token: user.token }));
    });
    return;
  }

  if (req.url === '/api/login' && req.method === 'POST') {
    parseBody(req, (err, body) => {
      if (err) { res.writeHead(400); return res.end('Bad JSON'); }
      const { username, password } = body;
      const user = data.users.find(u => u.username === username && u.passwordHash === hashPassword(password));
      if (!user) { res.writeHead(401); return res.end('Invalid credentials'); }
      user.token = generateId();
      saveData(data);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ token: user.token }));
    });
    return;
  }

  const user = getUserFromAuth(req);
  if (!user) { res.writeHead(401); return res.end('Unauthorized'); }

  if (req.url === '/api/subscriptions' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(user.subscriptions || []));
    return;
  }

  if (req.url === '/api/subscriptions' && req.method === 'POST') {
    parseBody(req, (err, body) => {
      if (err) { res.writeHead(400); return res.end('Bad JSON'); }
      const sub = Object.assign({ id: generateId(), usage: {} }, body);
      user.subscriptions = user.subscriptions || [];
      user.subscriptions.push(sub);
      saveData(data);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(sub));
    });
    return;
  }

  if (req.url.startsWith('/api/subscriptions/') && req.method === 'PUT') {
    const id = req.url.split('/').pop();
    parseBody(req, (err, body) => {
      if (err) { res.writeHead(400); return res.end('Bad JSON'); }
      const sub = user.subscriptions.find(s => s.id === id);
      if (!sub) { res.writeHead(404); return res.end('Not found'); }
      Object.assign(sub, body);
      saveData(data);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(sub));
    });
    return;
  }

  if (req.url.startsWith('/api/subscriptions/') && req.method === 'DELETE') {
    const id = req.url.split('/').pop();
    const idx = user.subscriptions.findIndex(s => s.id === id);
    if (idx === -1) { res.writeHead(404); return res.end('Not found'); }
    user.subscriptions.splice(idx, 1);
    saveData(data);
    res.writeHead(204); res.end();
    return;
  }

  if (req.url === '/api/usage' && req.method === 'POST') {
    parseBody(req, (err, body) => {
      if (err) { res.writeHead(400); return res.end('Bad JSON'); }
      const { id } = body;
      const sub = user.subscriptions.find(s => s.id === id);
      if (!sub) { res.writeHead(404); return res.end('Not found'); }
      const month = new Date().toISOString().slice(0,7);
      sub.usage[month] = (sub.usage[month] || 0) + 1;
      sub.lastUsed = new Date().toISOString();
      saveData(data);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(sub));
    });
    return;
  }

  if (req.url === '/api/notifications' && req.method === 'GET') {
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    const candidates = (user.subscriptions || []).filter(sub => {
      if (!sub.lastUsed) return true;
      return new Date(sub.lastUsed) < threeMonthsAgo;
    });
    const shuffled = candidates.sort(() => 0.5 - Math.random());
    const picked = shuffled.slice(0,3);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(picked));
    return;
  }

  if (req.url === '/api/exchangeRate' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data.exchangeRate));
    return;
  }

  res.writeHead(404); res.end('Not found');
}

function serveStatic(req, res) {
  const filePath = path.join(__dirname, '..', 'public', req.url === '/' ? 'index.html' : req.url);
  if (!fs.existsSync(filePath)) { res.writeHead(404); return res.end('Not found'); }
  const ext = path.extname(filePath).toLowerCase();
  const type = ext === '.html' ? 'text/html' : ext === '.js' ? 'application/javascript' : 'text/plain';
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    handleApi(req, res);
  } else {
    serveStatic(req, res);
  }
});

server.listen(3000, () => console.log('Server running on http://localhost:3000')); 
