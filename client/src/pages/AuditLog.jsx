import React, { useEffect, useState } from 'react';
import { API } from '../api.js';
import { Empty, Spinner, Badge, fmtDate } from '../components/ui.jsx';

const actionLabels = {
  create: 'Создание',
  update: 'Изменение',
  delete: 'Удаление',
  login: 'Вход',
  sell: 'Продажа',
  assign: 'Распределение',
  return: 'Возврат',
  restock: 'Приход',
  'worker-transfer': 'Передача между рабочими',
};

const actionTones = {
  create: 'success',
  update: 'info',
  delete: 'danger',
  login: 'gray',
  sell: 'success',
  assign: 'info',
  return: 'warn',
  restock: 'success',
  'worker-transfer': 'info',
};

const entityLabels = {
  user: 'Пользователь',
  part: 'Запчасть',
  sale: 'Продажа',
  transfer: 'Передача',
};

export function AuditLogPage() {
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

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Журнал действий</h2>
          <p className="muted">Кто и когда вносил изменения — полная история</p>
        </div>
      </div>

      {logs.length === 0 ? (
        <Empty title="Действий пока не было" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Действие</th>
                <th>Объект</th>
                <th>Кто</th>
                <th>Детали</th>
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
