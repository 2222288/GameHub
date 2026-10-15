import { useEffect, useState } from 'react';
import { adminApi } from '@/api/admin';
import type { Dashboard } from '@/types';
import {
  AlertTriangle,
  Eye,
  FilePenLine,
  Gamepad2,
  Link2,
  MousePointerClick,
  Search,
  WifiOff,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const [d, setD] = useState<Dashboard | null>(null);
  const [error, setError] = useState(false);
  const load = () => {
    setError(false);
    adminApi
      .dashboard()
      .then(setD)
      .catch(() => setError(true));
  };
  useEffect(load, []);

  const cards = d
    ? ([
        ['游戏总数', d.games, Gamepad2],
        ['已发布游戏', d.published, Gamepad2],
        ['草稿', d.draft, FilePenLine],
        ['已下架', d.offline, WifiOff],
        ['资源链接', d.links, Link2],
        ['失效链接', d.brokenLinks, AlertTriangle],
        ['今日浏览', d.todayViews, Eye],
        ['今日资源点击', d.todayClicks, MousePointerClick],
        ['今日搜索', d.todaySearches, Search],
      ] as const)
    : [];

  if (error)
    return (
      <button className="btn btn-secondary" onClick={load}>
        Dashboard 加载失败，点击重试
      </button>
    );

  return (
    <div>
      <h1 className="text-2xl font-black">Dashboard</h1>
      <p className="mt-1 text-sm text-ink-3">关键数据与运行状态</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label, value, Icon]) => (
          <div className="card p-5" key={label}>
            <Icon className="mb-5 text-brand" />
            <div className="text-3xl font-black">{value}</div>
            <div className="mt-1 text-sm text-ink-3">{label}</div>
          </div>
        ))}
      </div>
      <div className="mt-7 grid gap-5 xl:grid-cols-3">
        <Panel title="最近新增游戏" rows={d?.recentGames || []} empty="暂无数据" />
        <Panel title="失效反馈" rows={d?.reports || []} empty="暂无待处理反馈" />
        <Panel title="热门搜索词" rows={d?.hotSearches || []} empty="暂无搜索数据" />
      </div>
    </div>
  );
}

function Panel({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Record<string, unknown>[];
  empty: string;
}) {
  return (
    <div className="card p-5">
      <h2 className="font-bold">{title}</h2>
      <div className="mt-4 space-y-3 text-sm">
        {rows.length ? (
          rows.map((r, i) => (
            <div className="rounded-lg bg-panel p-3 text-ink-2" key={i}>
              {Object.entries(r)
                .slice(0, 3)
                .map(([k, v]) => (
                  <div className="flex justify-between gap-3" key={k}>
                    <span className="text-ink-3">{k}</span>
                    <span className="truncate">{String(v)}</span>
                  </div>
                ))}
            </div>
          ))
        ) : (
          <div className="py-6 text-center text-ink-3">{empty}</div>
        )}
      </div>
    </div>
  );
}
