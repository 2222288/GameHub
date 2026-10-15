import { useState, type FormEvent } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { adminApi } from '@/api/admin';
import { errorMessage } from '@/api/http';
import { useAuth } from '@/stores/auth';
export default function AdminLoginPage() {
  const token = useAuth((state) => state.token);
  const setToken = useAuth((state) => state.setToken);
  const navigate = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (token) return <Navigate to="/admin" replace />;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const response = await adminApi.login(username.trim(), password);
      setToken(response.token);
      navigate('/admin', { replace: true });
    } catch (error) {
      const message = errorMessage(error, '登录失败，请稍后重试。');
      setError(message === 'invalid username or password' ? '用户名或密码错误' : message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#f3e3db,#ffffff_55%)] p-4">
      <form onSubmit={submit} className="glass w-full max-w-sm rounded-2xl p-7 shadow-2xl">
        <Link to="/" className="text-2xl font-black">
          Game<span className="text-brand">Hub</span>
        </Link>
        <h1 className="mt-6 text-xl font-bold">管理员登录</h1>
        <p className="mt-2 text-sm text-ink-2">登录后管理游戏、分类和资源。</p>
        <label className="mt-6 block text-sm text-ink-2">
          用户名
          <input
            autoComplete="username"
            required
            maxLength={64}
            className="admin-input mt-2"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label className="mt-4 block text-sm text-ink-2">
          密码
          <input
            type="password"
            autoComplete="current-password"
            required
            className="admin-input mt-2"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="mt-4 text-sm text-err">
            {error}
          </p>
        )}
        <button className="btn btn-primary mt-6 w-full" disabled={busy}>
          {busy ? '正在登录…' : '登录'}
        </button>
      </form>
    </div>
  );
}
