import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, Field, Icon } from '../components/ui.jsx';

export function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(u, p) {
    setUsername(u);
    setPassword(p);
    setError('');
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo"><Icon name="parts" size={26} /></div>
        <h1 className="login-title">ZapChast</h1>
        <p className="login-subtitle">Войдите в аккаунт</p>

        <form onSubmit={onSubmit} className="login-form">
          <Field label="Логин" required>
            <input
              className="input input-lg"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Логин"
              autoFocus
              autoComplete="username"
            />
          </Field>
          <Field label="Пароль" required>
            <input
              className="input input-lg"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
              autoComplete="current-password"
            />
          </Field>

          {error && <div className="alert alert-error">{error}</div>}

          <Button type="submit" disabled={loading} className="btn-block btn-lg">
            {loading ? 'Входим…' : 'Войти'}
          </Button>
        </form>

        <div className="login-demo">
          <button type="button" className="demo-link" onClick={() => fillDemo('admin', 'admin123')}>
            Войти как администратор
          </button>
        </div>
      </div>
    </div>
  );
}
