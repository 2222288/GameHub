import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { publicApi } from '@/api/public';
import { CoverWall } from '@/components/CoverWall';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LatestCarousel } from '@/components/LatestCarousel';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { PopularDownloads } from '@/components/PopularDownloads';
import { SearchBar } from '@/components/SearchBar';
import type { WallGame } from '@/types';

const isUsableBanner = (url?: string) => Boolean(url && !url.startsWith('placeholder://'));

export default function HomePage() {
  const popular = useQuery({
    queryKey: ['public', 'games', { page: 1, size: 60, sort: 'resources' }],
    queryFn: ({ signal }) => publicApi.games({ page: 1, size: 60, sort: 'resources' }, { signal }),
  });
  const wall = useQuery({
    queryKey: ['public', 'wall'],
    queryFn: ({ signal }) => publicApi.wall({ signal }),
  });

  const popularGames = popular.data?.items.slice(0, 6) ?? [];
  const focusGames = (popular.data?.items ?? []).filter((game) => isUsableBanner(game.bannerUrl)).slice(0, 6);
  const fallbackWall: WallGame[] = popularGames.map((game) => ({
    id: game.id,
    name: game.name,
    slug: game.slug,
    coverUrl: game.coverUrl,
    hue:
      game.coverHue ??
      (Array.from(game.name).reduce((value, char) => value + char.charCodeAt(0), 0) % 360),
    chroma: game.coverChroma,
    lightness: game.coverLightness,
    accentColor: game.coverAccent,
    colorConfidence: game.coverColorConfidence,
  }));
  const wallGames = wall.data?.length ? wall.data : fallbackWall;

  return (
    <div className="home-page">
      <section className="wall-hero page-transition" aria-labelledby="hero-title">
        <CoverWall games={wallGames} />
        <div className="hero-screen">
          <h1 id="hero-title" className="sr-only">
            搜索游戏资源
          </h1>
          <div className="hero-search-shell">
            <SearchBar large />
          </div>
          <a href="#latest" className="hero-scroll-cue">
            <span>向下发现更多</span>
            <ArrowDown size={15} />
          </a>
        </div>
        <div className="hero-bridge" aria-hidden="true" />
      </section>

      <div className="home-content-shell archive-canvas">
        <div className="home-content container-page">
          <section id="latest" className="home-focus-section">
            {popular.isPending ? (
              <div className="latest-loading skeleton" role="status" aria-label="正在加载焦点游戏" />
            ) : popular.isError ? (
              <ErrorState retry={() => void popular.refetch()} />
            ) : focusGames.length ? (
              <LatestCarousel games={focusGames} />
            ) : (
              <EmptyState />
            )}
          </section>

          <section id="popular" className="home-showcase-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">
                  <span className="section-number">01</span> MOST DOWNLOADED
                </p>
                <h2 className="section-title mt-2">热门下载</h2>
              </div>
              <Link className="section-more" to="/games?sort=resources">
                查看排行 <ArrowUpRight size={16} />
              </Link>
            </div>
            {popular.isPending ? (
              <LoadingSkeleton count={6} variant="posters" />
            ) : popular.isError ? (
              <ErrorState retry={() => void popular.refetch()} />
            ) : popularGames.length ? (
              <PopularDownloads games={popularGames} />
            ) : (
              <EmptyState />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
