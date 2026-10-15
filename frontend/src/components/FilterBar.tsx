import type { Category } from '@/types';

const C = (...x: number[]) => String.fromCharCode(...x);
const tags = [
  '',
  C(21160, 20316),
  'RPG',
  C(20882, 38505),
  C(31574, 30053),
  C(27169, 25311),
  C(31454, 36895),
  C(20307, 32946),
  C(24656, 24598),
  C(24320, 25918, 19990, 30028),
  C(32905, 40479),
  C(29983, 23384),
  '解谜',
];

export interface Filters {
  category: string;
  tag: string;
  platform: string;
  language: string;
  sort: string;
  size: string;
}

export function FilterBar({
  categories,
  value,
  onChange,
  showRelevance = false,
}: {
  categories: Category[];
  value: Filters;
  onChange: (x: Filters) => void;
  showRelevance?: boolean;
}) {
  const set = (k: keyof Filters, v: string) => onChange({ ...value, [k]: v });
  const sel = 'input';

  return (
    <div className="card bg-panel grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
      <select
        className={sel}
        aria-label="游戏分类"
        value={value.category}
        onChange={(e) => set('category', e.target.value)}
      >
        <option value="">{C(20840, 37096, 20998, 31867)}</option>
        {categories.map((c) => (
          <option value={c.id} key={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        className={sel}
        aria-label="游戏类型"
        value={value.tag}
        onChange={(e) => set('tag', e.target.value)}
      >
        {tags.map((x, i) => (
          <option key={i} value={x}>
            {x || C(20840, 37096, 31867, 22411)}
          </option>
        ))}
      </select>
      <select
        className={sel}
        aria-label="游戏平台"
        value={value.platform}
        onChange={(e) => set('platform', e.target.value)}
      >
        {['', 'Windows', 'macOS', 'Linux', 'VR', 'Emulator'].map((x) => (
          <option key={x} value={x}>
            {x || C(20840, 37096, 24179, 21488)}
          </option>
        ))}
      </select>
      <select
        className={sel}
        aria-label="游戏语言"
        value={value.language}
        onChange={(e) => set('language', e.target.value)}
      >
        {[
          '',
          C(31616, 20307, 20013, 25991),
          C(32321, 20307, 20013, 25991),
          'English',
          '日文',
          '韩文',
          C(22810, 35821, 35328),
        ].map((x) => (
          <option key={x} value={x}>
            {x || C(20840, 37096, 35821, 35328)}
          </option>
        ))}
      </select>
      <select
        className={sel}
        aria-label="排序方式"
        value={value.sort}
        onChange={(e) => set('sort', e.target.value)}
      >
        {showRelevance && <option value="relevance">相关度</option>}
        <option value="updated">{C(26368, 36817, 26356, 26032)}</option>
        <option value="published">{C(21457, 24067, 26102, 38388)}</option>
        <option value="views">{C(27983, 35272, 26368, 22810)}</option>
        <option value="resources">{C(36164, 28304, 33719, 21462, 26368, 22810)}</option>
        <option value="name">{C(21517, 31216, 25490, 24207)}</option>
      </select>
      <select
        className={sel}
        aria-label="每页数量"
        value={value.size}
        onChange={(e) => set('size', e.target.value)}
      >
        {['20', '40', '60'].map((x) => (
          <option key={x} value={x}>
            每页 {x} 款
          </option>
        ))}
      </select>
    </div>
  );
}
