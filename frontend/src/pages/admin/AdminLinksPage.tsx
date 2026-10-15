import { useEffect, useState } from 'react';
import { adminApi } from '@/api/admin';
import type { AdminResourceLink } from '@/types';
import { DataTable } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/StatusBadge';

type EditState = Pick<
  AdminResourceLink,
  'id' | 'gameVersionId' | 'provider' | 'url' | 'password' | 'version' | 'status' | 'sortOrder'
>;

export default function AdminLinksPage() {
  const [items, setItems] = useState<AdminResourceLink[]>([]);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<EditState | null>(null);
  const [error, setError] = useState(false);
  const load = () => {
    setError(false);
    adminApi
      .links(status, q)
      .then(setItems)
      .catch(() => setError(true));
  };
  useEffect(load, [status]);

  const saveEdit = async () => {
    if (!edit) return;
    await adminApi.updateLink(edit.id, {
      provider: edit.provider,
      url: edit.url,
      password: edit.password || '',
      version: edit.version || '',
      status: edit.status,
      sortOrder: edit.sortOrder,
      gameVersionId: edit.gameVersionId ?? null,
    });
    setEdit(null);
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-black">资源链接管理</h1>
      <div className="my-5 flex flex-wrap gap-3">
        <input
          className="admin-input max-w-sm"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          placeholder="搜索游戏、资源来源或 URL"
        />
        <select
          className="admin-input max-w-xs"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">全部状态</option>
          {['ACTIVE', 'UNKNOWN', 'BROKEN', 'DISABLED'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button className="btn btn-secondary" onClick={load}>
          搜索
        </button>
      </div>

      {edit && (
        <div className="card mb-5 grid gap-3 p-4 md:grid-cols-6">
          <input
            className="admin-input"
            value={edit.provider}
            onChange={(e) => setEdit({ ...edit, provider: e.target.value })}
            placeholder="provider"
          />
          <input
            className="admin-input md:col-span-2"
            value={edit.url}
            onChange={(e) => setEdit({ ...edit, url: e.target.value })}
            placeholder="URL"
          />
          <input
            className="admin-input"
            value={edit.password || ''}
            onChange={(e) => setEdit({ ...edit, password: e.target.value })}
            placeholder="提取码"
          />
          <input
            className="admin-input"
            value={edit.version || ''}
            onChange={(e) => setEdit({ ...edit, version: e.target.value })}
            placeholder="版本"
          />
          <input
            className="admin-input"
            type="number"
            value={edit.sortOrder}
            onChange={(e) => setEdit({ ...edit, sortOrder: Number(e.target.value) })}
            placeholder="排序"
          />
          <select
            className="admin-input"
            value={edit.status}
            onChange={(e) => setEdit({ ...edit, status: e.target.value as EditState['status'] })}
          >
            {['ACTIVE', 'UNKNOWN', 'BROKEN', 'DISABLED'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <div className="flex gap-2 md:col-span-5">
            <button className="btn btn-primary" onClick={saveEdit}>
              保存编辑
            </button>
            <button className="btn btn-secondary" onClick={() => setEdit(null)}>
              取消
            </button>
          </div>
        </div>
      )}

      {error ? (
        <div className="card p-6 text-err">加载失败</div>
      ) : (
        <DataTable
          headers={['游戏名称', '平台', 'URL', '状态', '举报次数', '最后检查', '更新时间', '操作']}
        >
          {items.map((x) => (
            <tr key={x.id}>
              <td className="px-4 py-3 font-semibold">{x.gameName}</td>
              <td className="px-4 py-3">{x.provider}</td>
              <td className="max-w-xs truncate px-4 py-3 text-ink-3" title={x.url}>
                {x.url}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={x.status} />
              </td>
              <td className="px-4 py-3">{x.reportCount}</td>
              <td className="px-4 py-3 text-ink-3">
                {x.lastCheckedAt ? new Date(x.lastCheckedAt).toLocaleDateString() : '-'}
              </td>
              <td className="px-4 py-3 text-ink-3">
                {new Date(x.updatedAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <button className="text-brand" onClick={() => setEdit({ ...x })}>
                    编辑
                  </button>
                  <button
                    className="text-err"
                    onClick={async () => {
                      if (confirm('确定删除该资源链接？')) {
                        await adminApi.deleteLink(x.id);
                        load();
                      }
                    }}
                  >
                    删除
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
