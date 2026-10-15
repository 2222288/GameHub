import { useEffect, useState } from 'react';
import { adminApi } from '@/api/admin';
import type { Category } from '@/types';

const blank = { name: '', slug: '', icon: 'Box', description: '', sortOrder: 0, enabled: true };

export default function AdminCategoriesPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [form, setForm] = useState(blank);
  const [edit, setEdit] = useState<number | null>(null);
  const [error, setError] = useState('');
  const load = () =>
    adminApi
      .categories()
      .then(setItems)
      .catch(() => setError('分类加载失败'));
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setError('');
    try {
      await adminApi.saveCategory(edit, form);
      setForm(blank);
      setEdit(null);
      load();
    } catch {
      setError('保存失败，请检查名称、slug 是否重复或字段是否合法');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-black">分类管理</h1>
      <div className="mt-5 grid gap-3 rounded-xl border border-line p-4 md:grid-cols-7">
        <input
          className="admin-input"
          placeholder="名称"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="admin-input"
          placeholder="slug"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
        />
        <input
          className="admin-input"
          placeholder="icon"
          value={form.icon}
          onChange={(e) => setForm({ ...form, icon: e.target.value })}
        />
        <input
          className="admin-input md:col-span-2"
          placeholder="描述"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <input
          className="admin-input"
          type="number"
          placeholder="排序"
          value={form.sortOrder}
          onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
        />
        <button className="btn btn-primary" onClick={save}>
          {edit ? '保存修改' : '新增'}
        </button>
      </div>
      {error && <div className="mt-3 text-sm text-err">{error}</div>}
      <div className="mt-5 grid gap-3">
        {items.map((x) => (
          <div className="card flex flex-wrap items-center gap-4 p-4" key={x.id}>
            <div className="min-w-36 font-bold">{x.name}</div>
            <code className="text-xs text-ink-3">{x.slug}</code>
            <span className="badge">排序 {x.sortOrder}</span>
            <div className="flex-1 text-sm text-ink-3">{x.description}</div>
            <span className="badge">{x.enabled ? '启用' : '停用'}</span>
            <button
              onClick={() => {
                setEdit(x.id);
                setForm({
                  name: x.name,
                  slug: x.slug,
                  icon: x.icon || 'Box',
                  description: x.description || '',
                  sortOrder: x.sortOrder,
                  enabled: x.enabled,
                });
              }}
            >
              编辑
            </button>
            <button
              className={x.enabled ? 'text-amber-600' : 'text-ok'}
              onClick={async () => {
                await adminApi.saveCategory(x.id, {
                  name: x.name,
                  slug: x.slug,
                  icon: x.icon || 'Box',
                  description: x.description || '',
                  sortOrder: x.sortOrder,
                  enabled: !x.enabled,
                });
                load();
              }}
            >
              {x.enabled ? '停用' : '启用'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
