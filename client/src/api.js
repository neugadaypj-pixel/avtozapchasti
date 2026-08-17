const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { success: false, error: 'Неожиданный ответ сервера' };
    }
  }

  if (!res.ok) {
    const err = new Error((data && data.error) || `Ошибка ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const API = {
  login: (username, password) => api('/auth/login', { method: 'POST', body: { username, password } }),

  users: {
    list: () => api('/users'),
    create: (body) => api('/users', { method: 'POST', body }),
    update: (id, body) => api(`/users/${id}`, { method: 'PUT', body }),
    remove: (id) => api(`/users/${id}`, { method: 'DELETE' }),
  },
  categories: {
    list: () => api('/categories'),
    create: (name) => api('/categories', { method: 'POST', body: { name } }),
    remove: (id) => api(`/categories/${id}`, { method: 'DELETE' }),
  },
  parts: {
    list: (params = {}) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') q.set(k, v);
      });
      const qs = q.toString();
      return api(`/parts${qs ? `?${qs}` : ''}`);
    },
    get: (id) => api(`/parts/${id}`),
    create: (body) => api('/parts', { method: 'POST', body }),
    update: (id, body) => api(`/parts/${id}`, { method: 'PUT', body }),
    remove: (id) => api(`/parts/${id}`, { method: 'DELETE' }),
  },
  transfers: {
    list: () => api('/transfers'),
    assign: (body) => api('/transfers/assign', { method: 'POST', body }),
    return: (body) => api('/transfers/return', { method: 'POST', body }),
    restock: (body) => api('/transfers/restock', { method: 'POST', body }),
    workerTransfer: (body) => api('/transfers/worker-transfer', { method: 'POST', body }),
  },
  sales: {
    list: () => api('/sales'),
    create: (body) => api('/sales', { method: 'POST', body }),
  },
  uploads: {
    image: (file) => {
      const fd = new FormData();
      fd.append('image', file);
      return api('/uploads', { method: 'POST', body: fd });
    },
  },
  dashboard: () => api('/dashboard'),
};
