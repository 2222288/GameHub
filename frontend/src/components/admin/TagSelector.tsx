import type { Tag } from '@/types';
export function TagSelector({
  items,
  value,
  onChange,
}: {
  items: Tag[];
  value: number[];
  onChange: (v: number[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((t) => (
        <label
          key={t.id}
          className={`badge cursor-pointer ${value.includes(t.id) ? 'border-brand bg-brand-soft text-brand' : ''}`}
        >
          <input
            type="checkbox"
            className="mr-1"
            checked={value.includes(t.id)}
            onChange={(e) =>
              onChange(e.target.checked ? [...value, t.id] : value.filter((x) => x !== t.id))
            }
          />
          {t.name}
        </label>
      ))}
    </div>
  );
}
