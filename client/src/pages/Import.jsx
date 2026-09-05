import React, { useState } from 'react';
import { API } from '../api.js';
import { useI18n } from '../i18n.jsx';
import { Button, Empty, Spinner, Badge, fmtMoney, useToast } from '../components/ui.jsx';

export function ImportPage({ onNavigate }) {
  const { t } = useI18n();
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  async function onAnalyze(e) {
    e.preventDefault();
    if (!file) {
      toast(t('import.no_file'), 'error');
      return;
    }
    setAnalyzing(true);
    setResult(null);
    try {
      const r = await API.import.analyze(file);
      setPreview(r.data.preview);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setAnalyzing(false);
    }
  }

  async function onConfirm() {
    if (!preview || preview.length === 0) return;
    setImporting(true);
    try {
      const r = await API.import.confirm(preview);
      toast(`${t('import.done')}: ${r.data.created}${r.data.errors?.length ? ` (${t('import.skipped')}: ${r.data.errors.length})` : ''}`, 'success');
      setResult(r.data);
      setPreview(null);
      setFile(null);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>{t('import.title')}</h2>
          <p className="muted">{t('import.subtitle')}</p>
        </div>
        <Button variant="secondary" onClick={() => onNavigate('parts')}>← {t('nav.parts')}</Button>
      </div>

      <section className="card">
        <form onSubmit={onAnalyze} className="form-grid">
          <div className="field">
            <span className="field-label">{t('import.choose')}</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="input"
              onChange={(e) => setFile(e.target.files && e.target.files[0])}
            />
            <span className="field-hint">{t('import.file_hint')}</span>
          </div>
          <div className="form-actions" style={{ alignSelf: 'flex-end' }}>
            <Button type="submit" disabled={analyzing}>
              {analyzing ? t('import.analyzing') : t('import.analyze')}
            </Button>
          </div>
        </form>
      </section>

      {analyzing && <Spinner />}

      {preview && preview.length > 0 && (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="card-head">
            <h3>{t('import.preview_title')}</h3>
            <Badge tone="info">{preview.length} {t('import.rows_found')}</Badge>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('parts.name')}</th>
                  <th>{t('parts.sku')}</th>
                  <th>{t('parts.brand')}</th>
                  <th>{t('parts.shelf')}</th>
                  <th>{t('common.quantity')}</th>
                  <th>{t('parts.cost_price')}</th>
                  <th>{t('parts.sell_price')}</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p, i) => (
                  <tr key={i}>
                    <td className="list-title">{p.name}</td>
                    <td className="muted">{p.sku || '—'}</td>
                    <td>{p.brand || '—'}</td>
                    <td>{p.shelf || '—'}</td>
                    <td>{p.quantity}</td>
                    <td className="nowrap">{fmtMoney(p.cost_price)}</td>
                    <td className="nowrap">{fmtMoney(p.sell_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-actions" style={{ marginTop: 12 }}>
            <Button variant="success" onClick={onConfirm} disabled={importing}>
              {importing ? t('common.loading') : `${t('import.confirm')} (${preview.length})`}
            </Button>
          </div>
        </section>
      )}

      {preview && preview.length === 0 && (
        <Empty title={t('import.nothing')} />
      )}

      {result && (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="card-head"><h3>{t('import.done')}</h3></div>
          <div className="list">
            <div className="list-row"><span>{t('import.done')}</span><strong>{result.created}</strong></div>
            {result.errors && result.errors.length > 0 && (
              <>
                <div className="list-row"><span>{t('import.skipped')}</span><strong>{result.errors.length}</strong></div>
                <div className="muted small" style={{ marginTop: 8 }}>
                  {result.errors.slice(0, 20).map((er, i) => (
                    <div key={i}>• {er.sku || '—'}: {er.error}</div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
