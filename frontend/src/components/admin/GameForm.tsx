import { errorMessage } from '@/api/http';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Category, GameDetail, Tag } from '@/types';
import { CategorySelector } from './CategorySelector';
import { TagSelector } from './TagSelector';
const C = (...x: number[]) => String.fromCharCode(...x);
type Req = {
  type: 'MINIMUM' | 'RECOMMENDED';
  os: string;
  cpu: string;
  gpu: string;
  memory: string;
  storage: string;
};
type Form = {
  name: string;
  englishName: string;
  slug: string;
  aliases: string;
  summary: string;
  description: string;
  developer: string;
  publisher: string;
  releaseDate: string;
  categoryId: number;
  coverUrl: string;
  bannerUrl: string;
  coverHueOverride: number | '';
  wallEnabled: boolean;
  currentVersion: string;
  fileSize: string;
  versionUpdateDate: string;
  versionNotes: string;
  tagIds: number[];
  platforms: string[];
  languages: string[];
  requirements: Req[];
};
const emptyReq = (type: 'MINIMUM' | 'RECOMMENDED'): Req => ({
  type,
  os: 'Windows 10 64-bit',
  cpu: '',
  gpu: '',
  memory: '8 GB',
  storage: '',
});
const empty: Form = {
  name: '',
  englishName: '',
  slug: '',
  aliases: '',
  summary: '',
  description: '',
  developer: '',
  publisher: '',
  releaseDate: '',
  categoryId: 0,
  coverUrl: '',
  bannerUrl: '',
  coverHueOverride: '',
  wallEnabled: true,
  currentVersion: '1.0.0',
  fileSize: '',
  versionUpdateDate: '',
  versionNotes: '',
  tagIds: [],
  platforms: ['Windows'],
  languages: [C(31616, 20307, 20013, 25991)],
  requirements: [emptyReq('MINIMUM'), emptyReq('RECOMMENDED')],
};
export function GameForm({
  game,
  categories,
  tags,
  onSubmit,
}: {
  game?: GameDetail;
  categories: Category[];
  tags: Tag[];
  onSubmit: (data: Form) => Promise<void>;
}) {
  const initial = useMemo<Form>(() => {
    if (!game) return empty;
    return {
      name: game.name,
      englishName: game.englishName || '',
      slug: game.slug,
      aliases: game.aliases || '',
      summary: game.summary,
      description: game.description || '',
      developer: game.developer || '',
      publisher: game.publisher || '',
      releaseDate: game.releaseDate || '',
      categoryId: game.categoryId || categories.find((x) => x.name === game.category)?.id || 0,
      coverUrl: game.coverUrl || '',
      bannerUrl: game.bannerUrl || '',
      coverHueOverride: game.coverHueOverride ?? '',
      wallEnabled: game.wallEnabled ?? true,
      currentVersion: game.currentVersion || '',
      fileSize: game.fileSize || '',
      versionUpdateDate: game.versionUpdateDate || '',
      versionNotes: game.versionNotes || '',
      tagIds: game.tagIds?.length
        ? game.tagIds
        : tags.filter((t) => game.tags.includes(t.name)).map((t) => t.id),
      platforms: game.platforms,
      languages: game.languages,
      requirements: ['MINIMUM', 'RECOMMENDED'].map((type) => {
        const r = game.requirements.find((x) => x.type === type);
        return {
          type: type as Req['type'],
          os: r?.os || '',
          cpu: r?.cpu || '',
          gpu: r?.gpu || '',
          memory: r?.memory || '',
          storage: r?.storage || '',
        };
      }),
    };
  }, [game, categories, tags]);
  const [f, setF] = useState<Form>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setF(initial), [initial]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const toggle = (k: 'platforms' | 'languages', v: string) =>
    set(k, f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v]);
  const req = (idx: number, k: keyof Req, v: string) =>
    set(
      'requirements',
      f.requirements.map((x, i) => (i === idx ? { ...x, [k]: v } : x)),
    );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      await onSubmit(f);
    } catch (error) {
      setError(errorMessage(error, '保存失败，请检查填写内容后重试。'));
    } finally {
      setBusy(false);
    }
  };
  const fields: [keyof Form, string, string][] = [
    ['name', C(20013, 25991, 21517, 31216), 'text'],
    ['englishName', C(33521, 25991, 21517, 31216), 'text'],
    ['slug', 'Slug', 'text'],
    ['aliases', C(21035, 21517), 'text'],
    ['summary', C(19968, 21477, 35805, 31616, 20171), 'text'],
    ['developer', C(24320, 21457, 21830), 'text'],
    ['publisher', C(21457, 34892, 21830), 'text'],
    ['releaseDate', C(21457, 34892, 26085, 26399), 'date'],
    ['currentVersion', C(24403, 21069, 29256, 26412), 'text'],
    ['fileSize', C(25991, 20214, 22823, 23567), 'text'],
    ['versionUpdateDate', C(29256, 26412, 26356, 26032, 26085, 26399), 'date'],
    ['versionNotes', C(29256, 26412, 35828, 26126), 'text'],
  ];
  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="card grid gap-4 p-5 md:grid-cols-2">
        {fields.map(([k, label, type]) => (
          <label className={k === 'summary' ? 'md:col-span-2' : ''} key={k}>
            <span className="mb-1.5 block text-sm text-ink-2">{label}</span>
            <input
              className="admin-input"
              type={type}
              required={k === 'name' || k === 'slug' || k === 'summary'}
              value={String(f[k] ?? '')}
              onChange={(e) => set(k, e.target.value as never)}
            />
          </label>
        ))}
        <label className="md:col-span-2">
          <span className="mb-1.5 block text-sm text-ink-2">
            {C(35814, 32454, 20171, 32461)} (Markdown)
          </span>
          <textarea
            className="admin-input min-h-40"
            value={f.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </label>
        <label>
          <span className="mb-1.5 block text-sm text-ink-2">{C(20998, 31867)}</span>
          <CategorySelector
            items={categories}
            value={f.categoryId}
            onChange={(v) => set('categoryId', v)}
          />
        </label>
        <label>
          <span className="mb-1.5 block text-sm text-ink-2">Cover URL</span>
          <input
            className="admin-input"
            value={f.coverUrl}
            onChange={(e) => set('coverUrl', e.target.value)}
          />
        </label>
        <label className="md:col-span-2">
          <span className="mb-1.5 block text-sm text-ink-2">Banner URL</span>
          <input
            className="admin-input"
            value={f.bannerUrl}
            onChange={(e) => set('bannerUrl', e.target.value)}
          />
        </label>
        <div className="md:col-span-2 grid gap-4 rounded-xl border border-line p-4 md:grid-cols-2">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={f.wallEnabled}
              onChange={(event) => set('wallEnabled', event.target.checked)}
            />
            <span className="text-sm text-ink-2">显示在首页背景墙</span>
          </label>
          <label>
            <span className="mb-1.5 block text-sm text-ink-2">手动色相（0–359，可留空）</span>
            <input
              className="admin-input"
              type="number"
              min="0"
              max="359.9999"
              step="0.1"
              value={f.coverHueOverride}
              placeholder={
                game?.coverHue == null ? '等待封面分析' : `自动：${game.coverHue.toFixed(1)}°`
              }
              onChange={(event) =>
                set('coverHueOverride', event.target.value === '' ? '' : Number(event.target.value))
              }
            />
          </label>
          {game?.coverAccent && (
            <div className="md:col-span-2 flex flex-wrap items-center gap-3 text-xs text-ink-2">
              <span
                className="h-6 w-6 rounded-full border border-line"
                style={{ background: game.coverAccent }}
                aria-label={`自动强调色 ${game.coverAccent}`}
              />
              <span>自动色相 {game.coverHue?.toFixed(1)}°</span>
              <span>彩度 {game.coverChroma?.toFixed(3)}</span>
              <span>亮度 {game.coverLightness?.toFixed(3)}</span>
              <span>可信度 {Math.round((game.coverColorConfidence || 0) * 100)}%</span>
            </div>
          )}
        </div>
      </div>
      <div className="card p-5">
        <div className="mb-3 text-sm text-ink-2">{C(26631, 31614)}</div>
        <TagSelector items={tags} value={f.tagIds} onChange={(v) => set('tagIds', v)} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Choice
          title={C(24179, 21488)}
          items={['Windows', 'macOS', 'Linux', 'VR', 'Emulator']}
          selected={f.platforms}
          onClick={(v) => toggle('platforms', v)}
        />
        <Choice
          title={C(35821, 35328)}
          items={[
            C(31616, 20307, 20013, 25991),
            C(32321, 20307, 20013, 25991),
            'English',
            C(26085, 25991),
            C(38889, 25991),
            C(22810, 35821, 35328),
          ]}
          selected={f.languages}
          onClick={(v) => toggle('languages', v)}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {f.requirements.map((r, i) => (
          <div className="card p-5" key={r.type}>
            <h3 className="mb-4 font-bold">{r.type}</h3>
            {(['os', 'cpu', 'gpu', 'memory', 'storage'] as const).map((k) => (
              <label className="mb-3 block" key={k}>
                <span className="mb-1 block text-xs uppercase text-ink-3">{k}</span>
                <input
                  className="admin-input"
                  value={r[k]}
                  onChange={(e) => req(i, k, e.target.value)}
                />
              </label>
            ))}
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-err">
          {error}
        </p>
      )}
      <button className="btn btn-primary" disabled={busy || !f.categoryId}>
        {busy ? C(20445, 23384, 20013, 8230, 8230) : C(20445, 23384, 28216, 25103)}
      </button>
    </form>
  );
}
function Choice({
  title,
  items,
  selected,
  onClick,
}: {
  title: string;
  items: string[];
  selected: string[];
  onClick: (v: string) => void;
}) {
  return (
    <div className="card p-5">
      <div className="mb-3 text-sm text-ink-2">{title}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((v) => (
          <button
            type="button"
            onClick={() => onClick(v)}
            className={`badge ${selected.includes(v) ? 'border-brand bg-brand-soft text-brand' : ''}`}
            key={v}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
