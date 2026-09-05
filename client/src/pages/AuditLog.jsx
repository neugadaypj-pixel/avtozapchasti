import React, { useEffect, useState } from 'react';
import { API } from '../api.js';
import { useI18n } from '../i18n.jsx';
import { Empty, Spinner, Badge, fmtDate } from '../components/ui.jsx';

export function AuditLogPage() {
  const { t } = useI18n();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    API.audit.list()
      .then((r) => setLogs(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (loading) return <Spinner />;

  const actionLabels = {
    create: t('audit.create'),
    update: t('audit.update'),
    delete: t('audit.delete'),
    login: t('audit.login'),
    sell: t('audit.sell'),
    assign: t('audit.assign'),
    return: t('audit.return'),
    restock: t('audit.restock'),
    'worker-transfer': t('audit.worker_transfer'),
    order_create: t('audit.order_create'),
    order_confirm: t('audit.order_confirm'),
    expense: t('audit.expense'),
    confirm_payment: t('audit.confirm_payment'),
    debt_payment: t('audit.debt_payment'),
    clear_data: t('audit.clear_data'),
  };

  const actionTones = {
    create: 'success', update: 'info', delete: 'danger', login: 'gray',
    sell: 'success', assign: 'info', return: 'warn', restock: 'success',
    'worker-transfer': 'info', order_create: 'info', order_confirm: 'success',
    expense: 'warn', confirm_payment: 'success', debt_payment: 'success', clear_data: 'danger',
  };

  const entityLabels = {
    user: t('audit.entity_user'),
    part: t('audit.entity_part'),
    sale: t('audit.entity_sale'),
    transfer: t('audit.entity_transfer'),
    order: t('audit.entity_order'),
    category: t('audit.entity_category'),
    expense: t('audit.entity_expense'),
    debt_payment: t('audit.entity_debt_payment'),
    system: t('audit.entity_system'),
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>{t('nav.audit')}</h2>
          <p className="muted">{t('audit.subtitle')}</p>
        </div>
      </div>

      {logs.length === 0 ? (
        <Empty title={t('audit.empty')} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('common.date')}</th>
                <th>{t('audit.action')}</th>
                <th>{t('audit.object')}</th>
                <th>{t('audit.who')}</th>
                <th>{t('audit.details')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="muted nowrap">{fmtDate(l.created_at)}</td>
                  <td><Badge tone={actionTones[l.action] || 'gray'}>{actionLabels[l.action] || l.action}</Badge></td>
                  <td>{entityLabels[l.entity] || l.entity}{l.entity_id ? ` #${l.entity_id}` : ''}</td>
                  <td>{l.actor_name || '—'}</td>
                  <td className="muted">{typeof l.details === 'string' ? l.details : (l.details ? JSON.stringify(l.details) : '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
