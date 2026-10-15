import type { Category } from '@/types';
const C = (...x: number[]) => String.fromCharCode(...x);
export function CategorySelector({
  items,
  value,
  onChange,
}: {
  items: Category[];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <select
      className="admin-input"
      value={value || ''}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      <option value="">{C(35831, 36873, 25321, 20998, 31867)}</option>
      {items
        .filter((x) => x.enabled)
        .map((x) => (
          <option value={x.id} key={x.id}>
            {x.name}
          </option>
        ))}
    </select>
  );
}
