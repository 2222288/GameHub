import { useState } from 'react';
import type { AdminResourceLink } from '@/types';
import { adminApi } from '@/api/admin';
import { StatusBadge } from '@/components/StatusBadge';
const C = (...x: number[]) => String.fromCharCode(...x);
export function ResourceEditor({
  gameId,
  items,
  onChanged,
}: {
  gameId: number;
  items: AdminResourceLink[];
  onChanged: () => void;
}) {
  const [provider, setProvider] = useState('Baidu Netdisk');
  const [url, setUrl] = useState('');
  const [password, setPassword] = useState('');
  const [version, setVersion] = useState('');
  const add = async () => {
    if (!url.trim()) return;
    await adminApi.addLink(gameId, {
      provider,
      url,
      password,
      version,
      status: 'ACTIVE',
      sortOrder: items.length + 1,
      gameVersionId: null,
    });
    setUrl('');
    setPassword('');
    onChanged();
  };
  return (
    <section className="mt-8">
      <h2 className="mb-4 text-xl font-bold">{C(36164, 28304, 38142, 25509)}</h2>
      <div className="card grid gap-3 p-4 md:grid-cols-5">
        <input
          className="admin-input"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          placeholder="provider"
        />
        <input
          className="admin-input md:col-span-2"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
        />
        <input
          className="admin-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={C(25552, 21462, 30721)}
        />
        <input
          className="admin-input"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          placeholder={C(29256, 26412)}
        />
        <button className="btn btn-primary md:col-span-5 md:w-fit" onClick={add}>
          {C(28155, 21152, 36164, 28304)}
        </button>
      </div>
      <div className="mt-4 grid gap-3">
        {items.map((x) => (
          <div className="card flex flex-col gap-3 p-4 md:flex-row md:items-center" key={x.id}>
            <div className="min-w-40 font-semibold">{x.provider}</div>
            <div className="min-w-0 flex-1 truncate text-sm text-ink-2">{x.url}</div>
            <StatusBadge status={x.status} />
            <input
              type="number"
              className="admin-input md:w-24"
              defaultValue={x.sortOrder}
              title="sortOrder"
              onBlur={async (e) => {
                const n = Number(e.target.value);
                if (n !== x.sortOrder) {
                  await adminApi.updateLink(x.id, {
                    provider: x.provider,
                    url: x.url,
                    password: x.password,
                    version: x.version,
                    status: x.status,
                    sortOrder: n,
                    gameVersionId: x.gameVersionId ?? null,
                  });
                  onChanged();
                }
              }}
            />
            <select
              className="admin-input md:w-36"
              value={x.status}
              onChange={async (e) => {
                await adminApi.updateLink(x.id, {
                  provider: x.provider,
                  url: x.url,
                  password: x.password,
                  version: x.version,
                  status: e.target.value,
                  sortOrder: x.sortOrder,
                  gameVersionId: x.gameVersionId ?? null,
                });
                onChanged();
              }}
            >
              {['ACTIVE', 'UNKNOWN', 'BROKEN', 'DISABLED'].map((s) => (
                <option value={s} key={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              className="btn btn-danger"
              onClick={async () => {
                if (confirm(C(30830, 23450, 21024, 38500, 35813, 38142, 25509, 65311))) {
                  await adminApi.deleteLink(x.id);
                  onChanged();
                }
              }}
            >
              {C(21024, 38500)}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
