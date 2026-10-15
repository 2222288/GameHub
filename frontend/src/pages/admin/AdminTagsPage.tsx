import { useEffect, useState } from 'react';
import { adminApi } from '@/api/admin';
import type { Tag } from '@/types';
const C = (...x: number[]) => String.fromCharCode(...x);
export default function AdminTagsPage() {
  const [items, setItems] = useState<Tag[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [edit, setEdit] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const load = () => adminApi.tags(q).then(setItems);
  useEffect(() => {
    load();
  }, []);
  const save = async () => {
    await adminApi.saveTag(edit, { name, slug });
    setName('');
    setSlug('');
    setEdit(null);
    load();
  };
  return (
    <div>
      <h1 className="text-2xl font-black">{C(26631, 31614, 31649, 29702)}</h1>
      <div className="mt-5 flex flex-wrap gap-3">
        <input
          className="admin-input max-w-xs"
          placeholder={C(26631, 31614, 21517, 31216)}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="admin-input max-w-xs"
          placeholder="slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
        <button className="btn btn-primary" onClick={save}>
          {edit ? C(20445, 23384) : C(26032, 22686)}
        </button>
        <input
          className="admin-input ml-auto max-w-xs"
          placeholder={C(25628, 32034, 26631, 31614)}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        {items.map((x) => (
          <div className="card flex items-center gap-3 p-3" key={x.id}>
            <span>{x.name}</span>
            <code className="text-xs text-ink-3">{x.slug}</code>
            <button
              className="text-brand"
              onClick={() => {
                setEdit(x.id);
                setName(x.name);
                setSlug(x.slug);
              }}
            >
              {C(32534, 36753)}
            </button>
            <button
              className="text-err"
              onClick={async () => {
                try {
                  await adminApi.deleteTag(x.id);
                  load();
                } catch {
                  alert(
                    C(
                      26631,
                      31614,
                      27491,
                      22312,
                      34987,
                      20351,
                      29992,
                      65292,
                      26080,
                      27861,
                      30452,
                      25509,
                      21024,
                      38500,
                    ),
                  );
                }
              }}
            >
              {C(21024, 38500)}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
