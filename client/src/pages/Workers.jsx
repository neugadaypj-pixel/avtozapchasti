import React, { useEffect, useState } from 'react';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n.jsx';
import { Button, Field, Modal, Empty, Spinner, Badge, useToast, useConfirm } from '../components/ui.jsx';

export function WorkersPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
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
        toast(t('workers.added'), 'success');
      } else {
        await API.users.update(form.worker.id, body);
        toast(t('workers.updated'), 'success');
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
      toast(w.is_active ? t('workers.blocked') : t('workers.unblocked'), 'success');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function remove(w) {
    if (!(await confirm({ message: `${t('workers.delete_confirm')} «${w.full_name}»?`, danger: true }))) return;
    try {
      await API.users.remove(w.id);
      toast(t('workers.deleted'), 'success');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>{t('workers.title')}</h2>
        <p className="muted">{t('workers.subtitle')}</p>
        <Button onClick={() => setForm({ mode: 'create', worker: null })}>+ {t('workers.add')}</Button>
      </div>

      {loading ? (
        <Spinner />
      ) : workers.length === 0 ? (
        <Empty title={t('workers.title')} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('workers.name')}</th>
                <th>{t('workers.username')}</th>
                <th>{t('workers.city')}</th>
                <th>{t('workers.phone')}</th>
                <th>{t('workers.role')}</th>
                <th>{t('workers.positions')}</th>
                <th>{t('common.status')}</th>
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
                      {w.role === 'admin' ? t('role.admin') : t('role.worker')}
                    </Badge>
                  </td>
                  <td>{w.stock_count}</td>
                  <td>
                    <Badge tone={w.is_active ? 'success' : 'danger'}>
                      {w.is_active ? t('role.active') : t('role.blocked')}
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
        title={form?.mode === 'create' ? t('workers.new') : t('common.edit')}
        onClose={() => setForm(null)}
      >
        {form && <WorkerForm worker={form.worker} onSave={save} onCancel={() => setForm(null)} />}
      </Modal>
    </div>
  );
}

function WorkerForm({ worker, onSave, onCancel }) {
  const { t } = useI18n();
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
      <Field label={t('workers.full_name')} required>
        <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t('workers.full_name')} required />
      </Field>
      <Field label={t('workers.username')} required>
        <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="login" required disabled={!!worker} />
      </Field>
      <Field label={worker ? t('workers.new_password') : t('workers.password')} required={!worker}>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required={!worker} autoComplete="new-password" />
      </Field>
      <Field label={t('workers.city')}>
        <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder={t('workers.city')} />
      </Field>
      <Field label={t('workers.phone')}>
        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 …" />
      </Field>
      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>{t('common.cancel')}</Button>
        <Button type="submit">{worker ? t('common.save') : t('common.create')}</Button>
      </div>
    </form>
  );
}
