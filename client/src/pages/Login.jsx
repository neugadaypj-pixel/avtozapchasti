import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n.jsx';
import { Button, Field, Icon } from '../components/ui.jsx';

export function Login() {
  const { login } = useAuth();
  const { t, lang, toggleLang } = useI18n();
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

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-lang">
          <button className="demo-link" onClick={toggleLang}>
            {lang === 'uz' ? 'Русский' : "O'zbekcha"}
          </button>
        </div>
        <div className="login-logo"><Icon name="parts" size={26} /></div>
        <h1 className="login-title">{t('app.name')}</h1>
        <p className="login-subtitle">{t('login.subtitle')}</p>

        <form onSubmit={onSubmit} className="login-form">
          <Field label={t('login.username')} required>
            <input
              className="input input-lg"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('login.username')}
              autoFocus
              autoComplete="username"
            />
          </Field>
          <Field label={t('login.password')} required>
            <input
              className="input input-lg"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('login.password')}
              autoComplete="current-password"
            />
          </Field>

          {error && <div className="alert alert-error">{error}</div>}

          <Button type="submit" disabled={loading} className="btn-block btn-lg">
            {loading ? t('login.signing') : t('login.signin')}
          </Button>
        </form>
      </div>
    </div>
  );
}
