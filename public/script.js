let token = null;

function api(path, options = {}) {
  options.headers = options.headers || {};
  if (token) options.headers['X-Session-Token'] = token;
  return fetch(path, options).then(r => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json().catch(() => ({}));
  });
}

function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  api('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) })
    .then(res => { token = res.token; init(); })
    .catch(err => alert(err));
}

function signup() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  api('/api/signup', { method: 'POST', body: JSON.stringify({ username, password }) })
    .then(res => { token = res.token; init(); })
    .catch(err => alert(err));
}

function init() {
  document.getElementById('auth').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  loadSubs();
  loadNotifications();
}

function loadSubs() {
  api('/api/subscriptions').then(subs => {
    const ul = document.getElementById('subs');
    ul.innerHTML = '';
    subs.forEach(s => {
      const li = document.createElement('li');
      li.textContent = `${s.name} - ${s.amount} ${s.currency}`;
      const useBtn = document.createElement('button');
      useBtn.textContent = 'Used';
      useBtn.onclick = () => api('/api/usage', { method: 'POST', body: JSON.stringify({ id: s.id }) }).then(loadSubs);
      li.appendChild(useBtn);
      ul.appendChild(li);
    });
  });
}

function addSub() {
  const sub = {
    name: document.getElementById('name').value,
    amount: parseFloat(document.getElementById('amount').value),
    currency: document.getElementById('currency').value,
    paymentDate: document.getElementById('paymentDate').value,
    renewalDate: document.getElementById('renewalDate').value,
    category: document.getElementById('category').value
  };
  api('/api/subscriptions', { method: 'POST', body: JSON.stringify(sub) }).then(() => {
    document.getElementById('name').value = '';
    loadSubs();
  });
}

function loadNotifications() {
  api('/api/notifications').then(list => {
    const ul = document.getElementById('notify');
    ul.innerHTML = '';
    list.forEach(s => {
      const li = document.createElement('li');
      li.textContent = `Consider cancelling: ${s.name}`;
      ul.appendChild(li);
    });
  });
}
