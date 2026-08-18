import React, { useEffect, useState } from 'react';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, Field, Modal, Empty, Spinner, Badge, useToast } from '../components/ui.jsx';

export function WorkersPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // { mode, worker }

  async function load() {
    setLoading(true);
    try {
      const r = await API.users.list();
      setWorkers(r.data);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save(body) {
    try {
      if (form.mode === 'create') {
        await API.users.create(body);
        toast('Рабочий добавлен', 'success');
      } else {
        await API.users.update(form.worker.id, body);
        toast('Данные обновлены', 'success');
      }
      setForm(null);
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function toggleActive(w) {
    try {
      await API.users.update(w.id, { is_active: w.is_active ? 0 : 1 });
      toast(w.is_active ? 'Аккаунт заблокирован' : 'Аккаунт разблокирован', 'success');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function remove(w) {
    if (!confirm(`Удалить рабочего «${w.full_name}»?`)) return;
    try {
      await API.users.remove(w.id);
      toast('Рабочий удалён', 'success');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>Ishchilar</h2>
        <p className="muted">Turli shaharlardagi xodimlar uchun akkauntlar yarating</p>
        <Button onClick={() => setForm({ mode: 'create', worker: null })}>+ Ishchi qo'shish</Button>
      </div>

      {loading ? (
        <Spinner />
      ) : workers.length === 0 ? (
        <Empty title="Ishchilar hali yo'q" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Ism</th>
                <th>Login</th>
                <th>Shahar</th>
                <th>Telefon</th>
                <th>Rol</th>
                <th>Pozitsiyalar</th>
                <th>Holat</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => (
                <tr key={w.id}>
                  <td className="list-title">{w.full_name}</td>
                  <td className="muted">{w.username}</td>
                  <td>{w.city || '—'}</td>
                  <td className="muted">{w.phone || '—'}</td>
                  <td>
                    <Badge tone={w.role === 'admin' ? 'info' : 'gray'}>
                      {w.role === 'admin' ? 'Admin' : 'Ishchi'}
                    </Badge>
                  </td>
                  <td>{w.stock_count}</td>
                  <td>
                    <Badge tone={w.is_active ? 'success' : 'danger'}>
                      {w.is_active ? 'Faol' : 'Bloklangan'}
                    </Badge>
                  </td>
                  <td className="text-right">
                    <div className="row-actions">
                      <Button variant="secondary" size="sm" onClick={() => setForm({ mode: 'edit', worker: w })}>✏️</Button>
                      {w.id !== user.id && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => toggleActive(w)}>
                            {w.is_active ? '🔒' : '🔓'}
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => remove(w)}>🗑</Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!form}
        title={form?.mode === 'create' ? 'Yangi ishchi' : 'Tahrirlash'}
        onClose={() => setForm(null)}
      >
        {form && <WorkerForm worker={form.worker} onSave={save} onCancel={() => setForm(null)} />}
      </Modal>
    </div>
  );
}

function WorkerForm({ worker, onSave, onCancel }) {
  const [fullName, setFullName] = useState(worker?.full_name || '');
  const [username, setUsername] = useState(worker?.username || '');
  const [password, setPassword] = useState('');
  const [city, setCity] = useState(worker?.city || '');
  const [phone, setPhone] = useState(worker?.phone || '');

  function submit(e) {
    e.preventDefault();
    onSave({
      full_name: fullName,
      username,
      password: password || undefined,
      city,
      phone,
      role: 'worker',
    });
  }

  return (
    <form onSubmit={submit} className="form-grid">
      <Field label="To'liq ism" required>
        <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ism va familiya" required />
      </Field>
      <Field label="Login" required>
        <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="login" required disabled={!!worker} />
      </Field>
      <Field label={worker ? 'Yangi parol (majburiy emas)' : 'Parol'} required={!worker} hint={worker ? "O'zgartirmaslik uchun bo'sh qoldiring" : ''}>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required={!worker} autoComplete="new-password" />
      </Field>
      <Field label="Shahar">
        <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Masalan, Samarqand" />
      </Field>
      <Field label="Telefon">
        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 …" />
      </Field>
      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Bekor qilish</Button>
        <Button type="submit">{worker ? 'Saqlash' : 'Yaratish'}</Button>
      </div>
    </form>
  );
}
