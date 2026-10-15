import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '@/api/admin';
import type { Category, GameCard } from '@/types';
import { DataTable } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { Artwork } from '@/components/Artwork';
import { Pagination } from '@/components/Pagination';
import { formatDate } from '@/utils/format';

export default function AdminGamesPage() {
  const [items, setItems] = useState<GameCard[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [error, setError] = useState(false);

  const load = () => {
    setError(false);
    adminApi
      .games({
        page,
        size: 20,
        q: q || undefined,
        status: status || undefined,
        category: category || undefined,
      })
      .then((r) => {
        setItems(r.items);
        setPages(Math.max(1, r.pages));
      })
      .catch(() => setError(true));
  };

  useEffect(() => {
    adminApi.categories().then(setCategories);
  }, []);
  useEffect(load, [page, status, category]);

  const search = () => (page === 1 ? load() : setPage(1));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">游戏管理</h1>
          <p className="mt-1 text-sm text-ink-3">新增、编辑、发布、下架和删除游戏</p>
        </div>
        <Link className="btn btn-primary" to="/admin/games/create">
          + 新增游戏
        </Link>
      </div>

      <div className="my-5 flex flex-wrap gap-3">
        <input
          className="admin-input max-w-sm"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="搜索游戏名称"
        />
        <select
          className="admin-input max-w-48"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="">全部分类</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="admin-input max-w-44"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">全部状态</option>
          {['DRAFT', 'PUBLISHED', 'OFFLINE'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button className="btn btn-secondary" onClick={search}>
          搜索
        </button>
      </div>

      {error ? (
        <div className="card p-6 text-err">
          加载失败。
          <button className="ml-2 underline" onClick={load}>
            重试
          </button>
        </div>
      ) : (
        <>
          <DataTable
            headers={[
              '封面',
              '名称',
              '分类',
              '版本',
              '状态',
              '浏览',
              '资源点击',
              '更新时间',
              '操作',
            ]}
          >
            {items.map((g) => (
              <tr key={g.id} className="bg-panel/60">
                <td className="px-4 py-3">
                  <div className="h-12 w-20 overflow-hidden rounded">
                    <Artwork url={g.coverUrl} name={g.name} />
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold">{g.name}</td>
                <td className="px-4 py-3 text-ink-2">{g.category}</td>
                <td className="px-4 py-3">{g.currentVersion || '-'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={g.status} />
                </td>
                <td className="px-4 py-3">{g.viewCount}</td>
                <td className="px-4 py-3">{g.resourceClickCount}</td>
                <td className="px-4 py-3 text-ink-3">{formatDate(g.updatedAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {g.status === 'PUBLISHED' && (
                      <Link className="text-ink-2" to={`/games/${g.slug}`} target="_blank">
                        查看
                      </Link>
                    )}
                    <Link className="text-brand" to={`/admin/games/${g.id}/edit`}>
                      编辑
                    </Link>
                    {g.status !== 'PUBLISHED' && (
                      <button
                        onClick={async () => {
                          await adminApi.action(g.id, 'publish');
                          load();
                        }}
                      >
                        发布
                      </button>
                    )}
                    {g.status === 'PUBLISHED' && (
                      <button
                        onClick={async () => {
                          await adminApi.action(g.id, 'offline');
                          load();
                        }}
                      >
                        下架
                      </button>
                    )}
                    <button
                      className="text-err"
                      onClick={async () => {
                        if (confirm('确定删除该游戏？')) {
                          await adminApi.deleteGame(g.id);
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
          <Pagination page={page} pages={pages} onPage={setPage} />
        </>
      )}
    </div>
  );
}
