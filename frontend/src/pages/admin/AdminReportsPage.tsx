import { useEffect, useState } from 'react';
import { adminApi } from '@/api/admin';
import { DataTable } from '@/components/admin/DataTable';
import type { AdminReport } from '@/types';

export default function AdminReportsPage() {
  const [items, setItems] = useState<AdminReport[]>([]);
  const [status, setStatus] = useState('PENDING');
  const [error, setError] = useState(false);
  const load = () => {
    setError(false);
    adminApi
      .reports(status)
      .then(setItems)
      .catch(() => setError(true));
  };
  useEffect(load, [status]);

  return (
    <div>
      <h1 className="text-2xl font-black">举报管理</h1>
      <select
        className="admin-input my-5 max-w-xs"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        <option value="PENDING">PENDING</option>
        <option value="PROCESSED">PROCESSED</option>
        <option value="">ALL</option>
      </select>
      {error ? (
        <div className="card p-6 text-err">加载失败</div>
      ) : (
        <DataTable headers={['游戏', '资源来源', '举报原因', '举报时间', '状态', '操作']}>
          {items.map((x) => (
            <tr key={x.id}>
              <td className="px-4 py-3">{x.gameName}</td>
              <td className="px-4 py-3">{x.provider}</td>
              <td className="px-4 py-3">{x.reason}</td>
              <td className="px-4 py-3 text-ink-3">{new Date(x.createdAt).toLocaleString()}</td>
              <td className="px-4 py-3">{x.status}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {x.status === 'PENDING' && (
                    <button
                      className="text-brand"
                      onClick={async () => {
                        await adminApi.processReport(x.id);
                        load();
                      }}
                    >
                      标记已处理
                    </button>
                  )}
                  <select
                    className="admin-input w-32 py-1"
                    defaultValue=""
                    onChange={async (e) => {
                      if (e.target.value) {
                        await adminApi.setReportedLinkStatus(x.id, e.target.value);
                        e.target.value = '';
                        load();
                      }
                    }}
                  >
                    <option value="">修改链接状态</option>
                    {['ACTIVE', 'UNKNOWN', 'BROKEN', 'DISABLED'].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <button
                    className="text-err"
                    onClick={async () => {
                      if (confirm('确定删除该举报对应的资源链接？')) {
                        await adminApi.deleteReportedLink(x.id);
                        load();
                      }
                    }}
                  >
                    删除链接
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
