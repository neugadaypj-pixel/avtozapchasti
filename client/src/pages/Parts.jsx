import React, { useEffect, useMemo, useState } from 'react';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n.jsx';
import { Button, Field, Modal, Empty, Spinner, Badge, fmtMoney, useToast, useConfirm, Select } from '../components/ui.jsx';

export function PartsPage({ onNavigate }) {
  const { isAdmin } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();

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
        toast(t('parts.created'), 'success');
      } else {
        await API.parts.update(form.part.id, payload);
        toast(t('parts.saved'), 'success');
      }
      setForm(null);
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function removePart(id) {
    if (!(await confirm({ message: t('parts.delete_confirm'), danger: true }))) return;
    try {
      await API.parts.remove(id);
      toast(t('parts.deleted'), 'success');
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
        <h2>{isAdmin ? t('parts.title_admin') : t('parts.title_worker')}</h2>
        <p className="muted">
          {isAdmin ? t('parts.subtitle_admin') : t('parts.subtitle_worker')}
        </p>
        {isAdmin && (
          <Button onClick={() => setForm({ mode: 'create', part: null })}>+ {t('parts.add')}</Button>
        )}
      </div>

      <div className="filter-bar">
        <input
          className="input search-input"
          placeholder={t('parts.search_placeholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} placeholder={t('parts.all_categories')}>
          <option value="">{t('parts.all_categories')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Select value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={t('parts.all_brands')}>
          <option value="">{t('parts.all_brands')}</option>
          {brandOptions.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </Select>
        {isAdmin && (
          <label className="check">
            <input type="checkbox" checked={lowStock} onChange={(e) => setLowStock(e.target.checked)} />
            {t('parts.only_low')}
          </label>
        )}
        {!isAdmin && (
          <label className="check">
            <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
            {t('parts.only_mine')}
          </label>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading ? (
        <Spinner />
      ) : parts.length === 0 ? (
        <Empty title={t('parts.nothing_found')}>{t('parts.nothing_found_hint')}</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table table-hover">
            <thead>
              <tr>
                <th>{t('parts.name')}</th>
                <th>{t('parts.sku')}</th>
                <th>{t('parts.brand')}</th>
                <th>{t('parts.shelf')}</th>
                <th>{t('parts.category')}</th>
                <th>{t('common.price')}</th>
                <th>{t('parts.availability')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {parts.map((p) => (
                <tr key={p.id} onClick={() => openDetail(p.id)}>
                  <td>
                    <div className="list-title">{p.name}</div>
                    {p.low_stock && <Badge tone="warn">{t('parts.low')}</Badge>}
                  </td>
                  <td className="muted">{p.sku || '—'}</td>
                  <td>{p.brand || '—'}</td>
                  <td>{p.shelf || '—'}</td>
                  <td className="muted">{p.category_name || '—'}</td>
                  <td className="nowrap">{fmtMoney(p.sell_price)} · {p.sell_currency || 'UZS'}</td>
                  <td>
                    <Badge tone={p.total > 0 ? 'success' : 'gray'}>
                      {p.total} {t('common.pieces')}
                    </Badge>
                    {p.workers.length > 0 && (
                      <span className="small muted" style={{ marginLeft: 6 }}>
                        {p.workers.length} {t('parts.in_workers')}
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
        title={form?.mode === 'create' ? t('parts.new') : t('parts.edit_title')}
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
  const { t } = useI18n();
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
      toast(t('mystock.sold'), 'success');
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
        <div className="detail-field"><span>{t('parts.sku')}</span><strong>{part.sku || '—'}</strong></div>
        <div className="detail-field"><span>{t('parts.brand')}</span><strong>{part.brand || '—'}</strong></div>
        <div className="detail-field"><span>{t('parts.category')}</span><strong>{part.category_name || '—'}</strong></div>
        <div className="detail-field"><span>{t('parts.shelf')}</span><strong>{part.shelf || '—'}</strong></div>
        <div className="detail-field"><span>{t('parts.cost_price')}</span><strong>{fmtMoney(part.cost_price)} · {part.cost_currency || 'UZS'}</strong></div>
        <div className="detail-field"><span>{t('parts.sell_price')}</span><strong>{fmtMoney(part.sell_price)} · {part.sell_currency || 'UZS'}</strong></div>
        <div className="detail-field"><span>{t('parts.total_available')}</span><strong>{part.total} {t('common.pieces')}</strong></div>
      </div>

      {part.description && <p className="muted" style={{ marginTop: 12 }}>{part.description}</p>}

      <h4 className="section-title">{t('parts.where')}</h4>
      <div className="availability">
        <div className={`avail-row ${part.warehouse > 0 ? 'avail-ok' : ''}`}>
          <span>🏭 {t('parts.warehouse')}</span>
          <Badge tone={part.warehouse > 0 ? 'success' : 'gray'}>{part.warehouse} {t('common.pieces')}</Badge>
        </div>
        {part.workers.map((w) => (
          <div className="avail-row" key={w.worker_id}>
            <span>👤 {w.full_name} · {w.city || '—'}</span>
            <Badge tone="success">{w.quantity} {t('common.pieces')}</Badge>
          </div>
        ))}
        {part.workers.length === 0 && part.warehouse === 0 && (
          <p className="muted">{t('parts.no_one')}</p>
        )}
      </div>

      {!isAdmin && (
        <>
          <h4 className="section-title">{t('sale.form')}</h4>
          <form onSubmit={doSell} className="form-grid">
            <Field label={t('sale.quantity')} required>
              <input name="quantity" type="number" min="1" className="input" placeholder="1" required />
            </Field>
            <Field label={t('sale.unit_price')}>
              <input name="unit_price" type="number" min="0" className="input" defaultValue={part.sell_price} />
            </Field>
            <Field label={t('sale.payment_type')} required>
              <Select name="payment_type" defaultValue="cash" required>
                <option value="cash">{t('sale.cash')}</option>
                <option value="card">{t('sale.card')}</option>
                <option value="bank">{t('sale.bank')}</option>
              </Select>
            </Field>
            <Field label={t('sale.payment_when')} required>
              <Select name="payment_status" defaultValue="paid" required>
                <option value="paid">{t('sale.paid_now')}</option>
                <option value="pending">{t('sale.paid_later')}</option>
              </Select>
            </Field>
            <Field label={t('sale.client')}>
              <input name="client_name" className="input" placeholder={t('sale.client_placeholder')} />
            </Field>
            <Field label={t('sale.client_phone')}>
              <input name="client_phone" className="input" placeholder="+998 …" />
            </Field>
            <Field label={t('sale.note')}>
              <input name="note" className="input" placeholder={t('sale.note_placeholder')} />
            </Field>
            <div className="form-actions">
              <Button type="submit">{t('sale.sell')}</Button>
            </div>
          </form>
        </>
      )}

      {isAdmin && (
        <div className="detail-actions">
          <Button variant="secondary" onClick={onEdit}>✏️ {t('parts.edit')}</Button>
          <Button variant="danger" onClick={onDelete}>🗑 {t('parts.delete')}</Button>
        </div>
      )}
    </div>
  );
}

function PartForm({ part, categories, onSave, onCancel }) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const [name, setName] = useState(part?.name || '');
  const [sku, setSku] = useState(part?.sku || '');
  const [brand, setBrand] = useState(part?.brand || '');
  const [categoryId, setCategoryId] = useState(part?.category_id || '');
  const [costPrice, setCostPrice] = useState(part?.cost_price ?? '');
  const [sellPrice, setSellPrice] = useState(part?.sell_price ?? '');
  const [costCurrency, setCostCurrency] = useState(part?.cost_currency || 'UZS');
  const [sellCurrency, setSellCurrency] = useState(part?.sell_currency || 'UZS');
  const [shelf, setShelf] = useState(part?.shelf || '');
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
      await confirm({ message: t('parts.upload_error') + ' ' + err.message });
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
      shelf: shelf || null,
      cost_currency: costCurrency,
      sell_currency: sellCurrency,
      initial_quantity: part ? undefined : (initialQty || 0),
    });
  }

  return (
    <form onSubmit={submit} className="form-grid">
      <Field label={t('parts.name')} required>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('parts.name_placeholder')} required />
      </Field>
      <Field label={t('parts.sku')}>
        <input className="input" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="BRK-001" />
      </Field>
      <Field label={t('parts.brand')}>
        <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Toyota" />
      </Field>
      <Field label={t('parts.category')}>
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} placeholder={t('parts.no_category')}>
          <option value="">{t('parts.no_category')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </Field>
      <Field label={t('parts.shelf')} hint={t('common.optional')}>
        <input className="input" value={shelf} onChange={(e) => setShelf(e.target.value)} placeholder={t('parts.shelf_placeholder')} />
      </Field>
      <Field label={t('parts.cost_price')}>
        <input className="input" type="number" min="0" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="0" />
      </Field>
      <Field label={t('parts.cost_currency')}>
        <Select value={costCurrency} onChange={(e) => setCostCurrency(e.target.value)}>
          <option value="UZS">UZS</option>
          <option value="USD">USD</option>
        </Select>
      </Field>
      <Field label={t('parts.sell_price')}>
        <input className="input" type="number" min="0" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} placeholder="0" />
      </Field>
      <Field label={t('parts.sell_currency')}>
        <Select value={sellCurrency} onChange={(e) => setSellCurrency(e.target.value)}>
          <option value="UZS">UZS</option>
          <option value="USD">USD</option>
        </Select>
      </Field>
      {!part && (
        <Field label={t('parts.initial_qty')}>
          <input className="input" type="number" min="0" value={initialQty} onChange={(e) => setInitialQty(e.target.value)} placeholder="0" />
        </Field>
      )}
      <Field label={t('parts.description')} hint={t('common.optional')}>
        <textarea className="input textarea" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </Field>

      <div className="field field-photo">
        <span className="field-label">{t('parts.photo')} <em className="req">*</em></span>
        <div className="photo-upload">
          {imageUrl ? (
            <img className="photo-preview" src={imageUrl} alt={t('parts.photo')} />
          ) : (
            <div className="photo-placeholder">📷</div>
          )}
          <label className="photo-actions">
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onFileChange} hidden />
            <span className="btn btn-secondary btn-sm">{uploading ? t('common.loading') : imageUrl ? t('parts.replace_photo') : t('parts.upload_photo')}</span>
          </label>
          {imageUrl && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setImageUrl('')}>{t('parts.remove_photo')}</button>
          )}
        </div>
        <span className="field-hint">{t('parts.photo_hint')}</span>
      </div>

      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>{t('common.cancel')}</Button>
        <Button type="submit">{part ? t('common.save') : t('common.add')}</Button>
      </div>
    </form>
  );
}
