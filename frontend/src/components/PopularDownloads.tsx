import { Link } from 'react-router-dom';
import type { CSSProperties } from 'react';
import type { GameCard } from '@/types';
import { Artwork } from './Artwork';
import { compact } from '@/utils/format';

const validNumber = (value: number | undefined) => typeof value === 'number' && Number.isFinite(value);

function posterPalette(game: GameCard) {
  const reliable = (game.coverColorConfidence ?? 0) >= 0.16 && validNumber(game.coverHue);
  if (!reliable) {
    return {
      '--poster-side': '#4b4a46',
      '--poster-bottom': '#3f3e3a',
      '--poster-text': '#fffaf2',
      '--poster-muted': '#e4dfd5',
    } as CSSProperties;
  }

  const hue = ((game.coverHue ?? 28) + 360) % 360;
  const chroma = Math.max(0.025, Math.min(game.coverChroma ?? 0.08, 0.13));
  const sourceLightness = Math.max(0.2, Math.min(game.coverLightness ?? 0.5, 0.82));
  const sideLightness = Math.max(0.33, Math.min(0.43, sourceLightness * 0.78));
  const bottomLightness = Math.max(0.28, sideLightness - 0.055);

  return {
    '--poster-side': `oklch(${sideLightness} ${chroma} ${hue})`,
    '--poster-bottom': `oklch(${bottomLightness} ${Math.max(0.02, chroma * 0.88)} ${hue})`,
    '--poster-text': '#fffaf2',
    '--poster-muted': '#e8e1d7',
  } as CSSProperties;
}

const isPureVerticalCjk = (value: string) =>
  /^[\u3400-\u9fff\u3000-\u303f\uff00-\uffef·・—–\s]+$/.test(value);

function DownloadCard({ game }: { game: GameCard }) {
  return (
    <Link
      className="popular-download-card"
      to={`/games/${encodeURIComponent(game.slug)}`}
      style={posterPalette(game)}
      aria-label={`查看 ${game.name}`}
      title={game.name}
    >
      <div className="popular-cover">
        <Artwork url={game.coverUrl} name={game.name} />
      </div>
      <div
        className={`popular-name-band${isPureVerticalCjk(game.name) ? '' : ' popular-name-band-sideways'}`}
      >
        <h3>{game.name}</h3>
      </div>
      <div className="popular-info-band">
        <span className="popular-kicker">
          {game.category || `${compact(game.resourceClickCount)} 次资源访问`}
        </span>
        {game.summary && <p className="popular-summary">{game.summary}</p>}
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
