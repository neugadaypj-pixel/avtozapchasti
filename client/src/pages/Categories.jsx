import React, { useEffect, useState } from 'react';
import { API } from '../api.js';
import { useI18n } from '../i18n.jsx';
import { Button, Field, Modal, Empty, Spinner, Badge, useToast, useConfirm } from '../components/ui.jsx';

export function CategoriesPage() {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await API.categories.list();
      setCategories(r.data);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function add(name) {
    try {
      await API.categories.create(name);
      toast(t('cat.added'), 'success');
      setShowAdd(false);
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function remove(cat) {
    if (!(await confirm({ message: `${t('cat.delete_confirm')} «${cat.name}»? ${t('cat.delete_hint')}`, danger: true }))) return;
    try {
      await API.categories.remove(cat.id);
      toast(t('cat.deleted'), 'success');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>{t('cat.title')}</h2>
        <p className="muted">{t('cat.subtitle')}</p>
        <Button onClick={() => setShowAdd(true)}>+ {t('cat.add')}</Button>
      </div>

      {loading ? (
        <Spinner />
      ) : categories.length === 0 ? (
        <Empty title={t('cat.title')} />
      ) : (
        <div className="card">
          <div className="list">
            {categories.map((c) => (
              <div className="list-row" key={c.id}>
                <div>
                  <div className="list-title">🗂️ {c.name}</div>
                  <div className="muted small">{t('parts.category')}: {c.parts_count}</div>
                </div>
                <Button variant="danger" size="sm" onClick={() => remove(c)}>{t('common.delete')}</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={showAdd} title={t('cat.new')} onClose={() => setShowAdd(false)}>
        <CategoryForm onSave={add} onCancel={() => setShowAdd(false)} />
      </Modal>
    </div>
  );
}

function CategoryForm({ onSave, onCancel }) {
  const { t } = useI18n();
  const [name, setName] = useState('');

  function submit(e) {
    e.preventDefault();
    onSave(name.trim());
  }

  return (
    <form onSubmit={submit} className="form-grid">
      <Field label={t('cat.name')} required>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('cat.name')} required autoFocus />
      </Field>
      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>{t('common.cancel')}</Button>
        <Button type="submit">{t('common.add')}</Button>
      </div>
    </form>
  );
}
