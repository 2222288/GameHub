import type { GameCard as Game } from '@/types';
import { Link } from 'react-router-dom';
import { Eye, ArrowUpRight } from 'lucide-react';
import { Artwork } from './Artwork';
import { compact, formatDate } from '@/utils/format';
export function GameCard({ game }: { game: Game }) {
  const labels = [...new Set([game.category, ...game.tags.slice(0, 2)].filter(Boolean))];
  return (
    <Link
      to={`/games/${encodeURIComponent(game.slug)}`}
      className="premium-card card group overflow-hidden"
    >
      <div className="game-cover aspect-[2/3] overflow-hidden">
        <Artwork url={game.coverUrl} name={game.name} />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 min-h-10 font-bold leading-5">{game.name}</h3>
          <ArrowUpRight size={16} className="shrink-0 text-ink-3 group-hover:text-brand" />
        </div>
        <div className="mt-1 h-4 truncate text-xs text-ink-3">
          {game.englishName || game.category || '游戏'}
        </div>
        <div className="mt-4 flex min-h-6 flex-wrap gap-1.5">
          {labels.map((label) => (
            <span className="badge" key={label}>
              {label}
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-ink-2">
          <span className="inline-flex items-center gap-1">
            <Eye size={13} />
            {compact(game.viewCount)}
          </span>
          <span className="truncate">{game.currentVersion || '版本待更新'}</span>
        </div>
        <div className="mt-2 text-xs text-ink-3">更新于 {formatDate(game.updatedAt)}</div>
      </div>
    </Link>
  );
}
