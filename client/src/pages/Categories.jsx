import React, { useEffect, useState } from 'react';
import { API } from '../api.js';
import { Button, Field, Modal, Empty, Spinner, Badge, useToast } from '../components/ui.jsx';

export function CategoriesPage() {
  const toast = useToast();
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
      toast('Категория добавлена', 'success');
      setShowAdd(false);
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function remove(cat) {
    if (!confirm(`«${cat.name}» kategoriyasini o'chirasizmi? Ehtiyot qismlar kategoriyasiz qoladi.`)) return;
    try {
      await API.categories.remove(cat.id);
      toast("Kategoriya o'chirildi", 'success');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>Kategoriyalar</h2>
        <p className="muted">Qulay qidiruv uchun ehtiyot qismlarni guruhlang</p>
        <Button onClick={() => setShowAdd(true)}>+ Kategoriya qo'shish</Button>
      </div>

      {loading ? (
        <Spinner />
      ) : categories.length === 0 ? (
        <Empty title="Kategoriyalar yo'q" />
      ) : (
        <div className="card">
          <div className="list">
            {categories.map((c) => (
              <div className="list-row" key={c.id}>
                <div>
                  <div className="list-title">🗂️ {c.name}</div>
                  <div className="muted small">Ehtiyot qismlar: {c.parts_count}</div>
                </div>
                <Button variant="danger" size="sm" onClick={() => remove(c)}>O'chirish</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={showAdd} title="Yangi kategoriya" onClose={() => setShowAdd(false)}>
        <CategoryForm onSave={add} onCancel={() => setShowAdd(false)} />
      </Modal>
    </div>
  );
}

function CategoryForm({ onSave, onCancel }) {
  const [name, setName] = useState('');

  function submit(e) {
    e.preventDefault();
    onSave(name.trim());
  }

  return (
    <form onSubmit={submit} className="form-grid">
      <Field label="Kategoriya nomi" required>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan, Dvigatel" required autoFocus />
      </Field>
      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Bekor qilish</Button>
        <Button type="submit">Qo'shish</Button>
      </div>
    </form>
  );
}
