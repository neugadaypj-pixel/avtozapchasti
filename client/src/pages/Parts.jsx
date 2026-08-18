import React, { useEffect, useMemo, useState } from 'react';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, Field, Modal, Empty, Spinner, Badge, fmtMoney, useToast } from '../components/ui.jsx';

export function PartsPage({ onNavigate }) {
  const { isAdmin } = useAuth();
  const toast = useToast();

  const [parts, setParts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brand, setBrand] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);

  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(null); // { mode: 'create'|'edit', part }

  async function load() {
    setLoading(true);
    try {
      const params = { search, category_id: categoryId, brand, low_stock: lowStock ? '1' : '', mine: onlyMine ? '1' : '' };
      const r = await API.parts.list(params);
      setParts(r.data);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    API.categories.list().then((r) => setCategories(r.data)).catch(() => {});
    if (isAdmin) API.users.list().then((r) => setWorkers(r.data.filter((u) => u.role === 'worker'))).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [search, categoryId, brand, lowStock, onlyMine]);

  async function openDetail(id) {
    try {
      const r = await API.parts.get(id);
      setDetail(r.data);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function savePart(payload) {
    try {
      if (form.mode === 'create') {
        await API.parts.create(payload);
        toast('Запчасть добавлена', 'success');
      } else {
        await API.parts.update(form.part.id, payload);
        toast('Изменения сохранены', 'success');
      }
      setForm(null);
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function removePart(id) {
    if (!confirm('Удалить запчасть? Это действие необратимо.')) return;
    try {
      await API.parts.remove(id);
      toast('Запчасть удалена', 'success');
      setDetail(null);
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  const brandOptions = useMemo(() => {
    const s = new Set();
    parts.forEach((p) => p.brand && s.add(p.brand));
    return [...s].sort();
  }, [parts]);

  return (
    <div className="page">
      <div className="page-head">
        <h2>{isAdmin ? 'Ehtiyot qismlar' : "Baza bo'yicha qidiruv"}</h2>
        <p className="muted">
          {isAdmin ? 'Ehtiyot qismlar katalogini boshqarish' : "Butun baza bo'yicha qidiring va kimda borligini ko'ring"}
        </p>
        {isAdmin && (
          <Button onClick={() => setForm({ mode: 'create', part: null })}>+ Ehtiyot qism qo'shish</Button>
        )}
      </div>

      <div className="filter-bar">
        <input
          className="input search-input"
          placeholder="Nomi, artikul, brend bo'yicha qidiruv…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Все категории</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select className="input select" value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="">Все бренды</option>
          {brandOptions.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        {isAdmin && (
          <label className="check">
            <input type="checkbox" checked={lowStock} onChange={(e) => setLowStock(e.target.checked)} />
            Только мало остатков
          </label>
        )}
        {!isAdmin && (
          <label className="check">
            <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
            Только мои
          </label>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading ? (
        <Spinner />
      ) : parts.length === 0 ? (
        <Empty title="Ничего не найдено">Попробуйте изменить параметры поиска</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table table-hover">
            <thead>
              <tr>
                <th>Nomi</th>
                <th>Artikul</th>
                <th>Brend</th>
                <th>Kategoriya</th>
                <th>Narxi</th>
                <th>Mavjudligi</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {parts.map((p) => (
                <tr key={p.id} onClick={() => openDetail(p.id)}>
                  <td>
                    <div className="list-title">{p.name}</div>
                    {p.low_stock && <Badge tone="warn">kam</Badge>}
                  </td>
                  <td className="muted">{p.sku || '—'}</td>
                  <td>{p.brand || '—'}</td>
                  <td className="muted">{p.category_name || '—'}</td>
                  <td className="nowrap">{fmtMoney(p.sell_price)}</td>
                  <td>
                    <Badge tone={p.total > 0 ? 'success' : 'gray'}>
                      {p.total} dona
                    </Badge>
                    {p.workers.length > 0 && (
                      <span className="small muted" style={{ marginLeft: 6 }}>
                        {p.workers.length} ishchida
                      </span>
                    )}
                  </td>
                  <td className="text-right">
                    <span className="chevron">›</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Детали запчасти */}
      <Modal open={!!detail} title={detail?.name || ''} onClose={() => setDetail(null)} wide>
        {detail && (
          <PartDetail
            part={detail}
            isAdmin={isAdmin}
            workers={workers}
            onEdit={() => setForm({ mode: 'edit', part: detail })}
            onDelete={() => removePart(detail.id)}
            onClose={() => setDetail(null)}
            onRefresh={() => openDetail(detail.id)}
          />
        )}
      </Modal>

      {/* Форма добавления/редактирования */}
      <Modal
        open={!!form}
        title={form?.mode === 'create' ? 'Новая запчасть' : 'Редактировать запчасть'}
        onClose={() => setForm(null)}
        wide
      >
        {form && (
          <PartForm
            part={form.part}
            categories={categories}
            onSave={savePart}
            onCancel={() => setForm(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function PartDetail({ part, isAdmin, workers, onEdit, onDelete, onClose, onRefresh }) {
  const toast = useToast();

  async function doSell(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const qty = Number(fd.get('quantity'));
    const price = Number(fd.get('unit_price'));
    try {
      await API.sales.create({
        part_id: part.id, quantity: qty, unit_price: price,
        client_name: fd.get('client_name'), client_phone: fd.get('client_phone'),
        note: fd.get('note'),
        payment_type: fd.get('payment_type'),
        payment_status: fd.get('payment_status'),
      });
      toast('Sotuv rasmiylashtirildi', 'success');
      onClose();
      onRefresh();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div>
      {part.image_url && (
        <img className="part-photo" src={part.image_url} alt={part.name} />
      )}
      <div className="detail-grid">
        <div className="detail-field"><span>Artikul</span><strong>{part.sku || '—'}</strong></div>
        <div className="detail-field"><span>Brend</span><strong>{part.brand || '—'}</strong></div>
        <div className="detail-field"><span>Kategoriya</span><strong>{part.category_name || '—'}</strong></div>
        <div className="detail-field"><span>Sotib olish narxi</span><strong>{fmtMoney(part.cost_price)}</strong></div>
        <div className="detail-field"><span>Sotuv narxi</span><strong>{fmtMoney(part.sell_price)}</strong></div>
        <div className="detail-field"><span>Jami mavjud</span><strong>{part.total} dona</strong></div>
      </div>

      {part.description && <p className="muted" style={{ marginTop: 12 }}>{part.description}</p>}

      <h4 className="section-title">Qayerda joylashgan</h4>
      <div className="availability">
        <div className={`avail-row ${part.warehouse > 0 ? 'avail-ok' : ''}`}>
          <span>🏭 Asosiy ombor</span>
          <Badge tone={part.warehouse > 0 ? 'success' : 'gray'}>{part.warehouse} dona</Badge>
        </div>
        {part.workers.map((w) => (
          <div className="avail-row" key={w.worker_id}>
            <span>👤 {w.full_name} · {w.city || '—'}</span>
            <Badge tone="success">{w.quantity} dona</Badge>
          </div>
        ))}
        {part.workers.length === 0 && part.warehouse === 0 && (
          <p className="muted">Ehtiyot qism hech kimda yo'q.</p>
        )}
      </div>

      {!isAdmin && (
        <>
          <h4 className="section-title">Sotuvni rasmiylashtirish</h4>
          <form onSubmit={doSell} className="form-grid">
            <Field label="Miqdor" required>
              <input name="quantity" type="number" min="1" className="input" placeholder="1" required />
            </Field>
            <Field label="Bir dona narxi">
              <input name="unit_price" type="number" min="0" className="input" defaultValue={part.sell_price} />
            </Field>
            <Field label="To'lov turi" required>
              <select name="payment_type" className="input select" required>
                <option value="cash">Naqd pul</option>
                <option value="card">Kartaga o'tkazish</option>
                <option value="bank">Bank hisobiga</option>
              </select>
            </Field>
            <Field label="Qachon to'lanadi?" required>
              <select name="payment_status" className="input select" required>
                <option value="paid">Darhol</option>
                <option value="pending">Keyinroq</option>
              </select>
            </Field>
            <Field label="Mijoz">
              <input name="client_name" className="input" placeholder="Mijoz ismi" />
            </Field>
            <Field label="Mijoz telefoni">
              <input name="client_phone" className="input" placeholder="+998 …" />
            </Field>
            <Field label="Izoh">
              <input name="note" className="input" placeholder="Izoh" />
            </Field>
            <div className="form-actions">
              <Button type="submit">Sotish</Button>
            </div>
          </form>
        </>
      )}

      {isAdmin && (
        <div className="detail-actions">
          <Button variant="secondary" onClick={onEdit}>✏️ Tahrirlash</Button>
          <Button variant="danger" onClick={onDelete}>🗑 O'chirish</Button>
        </div>
      )}
    </div>
  );
}

function PartForm({ part, categories, onSave, onCancel }) {
  const [name, setName] = useState(part?.name || '');
  const [sku, setSku] = useState(part?.sku || '');
  const [brand, setBrand] = useState(part?.brand || '');
  const [categoryId, setCategoryId] = useState(part?.category_id || '');
  const [costPrice, setCostPrice] = useState(part?.cost_price ?? '');
  const [sellPrice, setSellPrice] = useState(part?.sell_price ?? '');
  const [description, setDescription] = useState(part?.description || '');
  const [initialQty, setInitialQty] = useState('');
  const [imageUrl, setImageUrl] = useState(part?.image_url || '');
  const [uploading, setUploading] = useState(false);

  async function onFileChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const r = await API.uploads.image(file);
      setImageUrl(r.data.url);
    } catch (err) {
      alert('Не удалось загрузить фото: ' + err.message);
    } finally {
      setUploading(false);
    }
  }

  function submit(e) {
    e.preventDefault();
    onSave({
      name, sku, brand, category_id: categoryId || null,
      cost_price: costPrice, sell_price: sellPrice, description,
      image_url: imageUrl || null,
      initial_quantity: part ? undefined : (initialQty || 0),
    });
  }

  return (
    <form onSubmit={submit} className="form-grid">
      <Field label="Название" required>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Тормозные колодки" required />
      </Field>
      <Field label="Артикул (SKU)">
        <input className="input" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="BRK-001" />
      </Field>
      <Field label="Бренд">
        <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Toyota" />
      </Field>
      <Field label="Категория">
        <select className="input select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Без категории</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Закупочная цена">
        <input className="input" type="number" min="0" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="0" />
      </Field>
      <Field label="Цена продажи">
        <input className="input" type="number" min="0" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} placeholder="0" />
      </Field>
      {!part && (
        <Field label="Начальное количество на складе">
          <input className="input" type="number" min="0" value={initialQty} onChange={(e) => setInitialQty(e.target.value)} placeholder="0" />
        </Field>
      )}
      <Field label="Описание" hint="Необязательно">
        <textarea className="input textarea" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </Field>

      <div className="field field-photo">
        <span className="field-label">Фото запчасти <em className="req">*</em></span>
        <div className="photo-upload">
          {imageUrl ? (
            <img className="photo-preview" src={imageUrl} alt="Фото запчасти" />
          ) : (
            <div className="photo-placeholder">📷</div>
          )}
          <label className="photo-actions">
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onFileChange} hidden />
            <span className="btn btn-secondary btn-sm">{uploading ? 'Загрузка…' : imageUrl ? 'Заменить' : 'Загрузить'}</span>
          </label>
          {imageUrl && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setImageUrl('')}>Убрать</button>
          )}
        </div>
        <span className="field-hint">Желательно, но не обязательно. JPG, PNG или WEBP до 5 МБ.</span>
      </div>

      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Отмена</Button>
        <Button type="submit">{part ? 'Сохранить' : 'Добавить'}</Button>
      </div>
    </form>
  );
}
