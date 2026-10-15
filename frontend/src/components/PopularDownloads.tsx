import { Link } from 'react-router-dom';
import { Download, Eye, Folder } from 'lucide-react';
import type { GameCard } from '@/types';
import { Artwork } from './Artwork';
import { compact, formatDate } from '@/utils/format';

function DownloadCard({ game }: { game: GameCard }) {
  return (
    <Link className="popular-download-card" to={`/games/${encodeURIComponent(game.slug)}`}>
      <div className="popular-cover">
        <Artwork url={game.coverUrl} name={game.name} layout="natural" />
      </div>
      <div className="popular-copy">
        <time className="popular-date" dateTime={game.updatedAt}>
          {formatDate(game.updatedAt)}
        </time>
        <h3>{game.name}</h3>
        {game.summary && <p className="popular-summary">{game.summary}</p>}
        <div className="popular-meta">
          <span className="popular-category">
            <Folder size={14} aria-hidden="true" />
            {game.category || '游戏资源'}
          </span>
          <span aria-label={`${game.resourceClickCount} 次资源访问`} title="资源访问次数">
            <Download size={14} aria-hidden="true" />
            {compact(game.resourceClickCount)}
          </span>
          <span aria-label={`${game.viewCount} 次浏览`} title="浏览次数">
            <Eye size={14} aria-hidden="true" />
            {compact(game.viewCount)}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function PopularDownloads({ games }: { games: GameCard[] }) {
  return (
    <div className="popular-columns">
      {games.map((game) => (
        <DownloadCard game={game} key={game.id} />
      ))}
    </div>
  );
}
