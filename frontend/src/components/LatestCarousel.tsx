import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import type { GameCard } from '@/types';
import { Artwork } from './Artwork';
import { formatDate } from '@/utils/format';

/** One full-width cover per slide; native scroll snap also supports touch gestures. */
export function LatestCarousel({ games }: { games: GameCard[] }) {
  const [current, setCurrent] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [touching, setTouching] = useState(false);
  const [rotationStopped, setRotationStopped] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const root = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const currentRef = useRef(0);
  const count = games.length;
  const hasGames = count > 0;
  const active = Math.min(current, Math.max(0, count - 1));

  useEffect(() => {
    // Keyboard users should open the game they just selected, even after an arrow-key change.
    const rail = viewport.current;
    if (rail?.querySelector('.latest-slide[aria-hidden="true"] .latest-item:focus')) {
      rail
        .querySelector<HTMLAnchorElement>('.latest-slide[aria-hidden="false"] .latest-item')
        ?.focus({ preventScroll: true });
    }
  }, [active]);

  const goTo = useCallback(
    (next: number, behavior?: ScrollBehavior) => {
      if (!count) return;
      const target = ((next % count) + count) % count;
      viewport.current?.scrollTo({
        left: target * viewport.current.clientWidth,
        behavior: behavior ?? (reducedMotion ? 'instant' : 'smooth'),
      });
      currentRef.current = target;
      setCurrent(target);
    },
    [count, reducedMotion],
  );

  useEffect(() => {
    const realign = () => goTo(Math.min(currentRef.current, Math.max(0, count - 1)), 'instant');
    realign();
    window.addEventListener('resize', realign, { passive: true });
    return () => window.removeEventListener('resize', realign);
  }, [count, goTo]);

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), {
      threshold: 0.1,
    });
    observer.observe(node);
    const visibility = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', visibility);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(motion.matches);
    motion.addEventListener?.('change', updateMotion);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      motion.removeEventListener?.('change', updateMotion);
    };
  }, [hasGames]);

  useEffect(() => {
    if (
      count < 2 ||
      hovered ||
      focused ||
      touching ||
      rotationStopped ||
      !onScreen ||
      !pageVisible ||
      reducedMotion
    )
      return;
    const timer = window.setInterval(() => goTo(currentRef.current + 1), 5200);
    return () => window.clearInterval(timer);
  }, [
    count,
    hovered,
    focused,
    touching,
    rotationStopped,
    onScreen,
    pageVisible,
    reducedMotion,
    goTo,
  ]);

  if (!count) return null;

  return (
    <div
      ref={root}
      className="latest-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="最近更新游戏"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        goTo(currentRef.current + (event.key === 'ArrowRight' ? 1 : -1));
      }}
    >
      <div className="latest-stage">
        <div
          ref={viewport}
          className="latest-viewport"
          onScroll={(event) => {
            const rail = event.currentTarget;
            if (!rail.clientWidth) return;
            const index = Math.max(
              0,
              Math.min(count - 1, Math.round(rail.scrollLeft / rail.clientWidth)),
            );
            currentRef.current = index;
            setCurrent(index);
          }}
          onTouchStart={() => setTouching(true)}
          onTouchEnd={() => setTouching(false)}
          onTouchCancel={() => setTouching(false)}
          aria-label="最近更新封面，支持左右滑动和方向键切换"
        >
          <div className="latest-rail">
            {games.map((game, index) => (
              <div
                className="latest-slide"
                key={game.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`第 ${index + 1} 张，共 ${count} 张`}
                aria-hidden={index !== active}
              >
                <Link
                  className="latest-item"
                  to={`/games/${encodeURIComponent(game.slug)}`}
                  tabIndex={index === active ? 0 : -1}
                  aria-label={`查看 ${game.name} 的详情`}
                >
                  <div
                    className={`latest-item-art${game.bannerUrl && !game.bannerUrl.startsWith('placeholder://') ? '' : ' latest-item-poster'}`}
                  >
                    <div className="latest-art-backdrop" aria-hidden="true">
                      <Artwork url={game.coverUrl} name={game.name} />
                    </div>
                    <Artwork
                      url={game.bannerUrl}
                      fallbackUrl={game.coverUrl}
                      name={game.name}
                      priority={index === active || index === (active + 1) % count}
                      className="latest-art-main"
                    />
                    <span className="latest-item-index">
                      GAMEHUB SELECT / {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="latest-item-body">
                    <p className="latest-item-category">{game.category || '精选游戏'}</p>
                    <h3>{game.name}</h3>
                    {game.englishName && <p className="latest-item-english">{game.englishName}</p>}
                    <div className="latest-item-meta">
                      <time dateTime={game.updatedAt}>{formatDate(game.updatedAt)} 更新</time>
                      {game.currentVersion && <span>{game.currentVersion}</span>}
                    </div>
                    <span className="latest-item-detail">
                      查看游戏 <ArrowUpRight size={15} />
                    </span>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>
        {count > 1 && (
          <div className="latest-cover-controls">
            <button
              className="latest-nav latest-nav-prev"
              type="button"
              onClick={() => goTo(currentRef.current - 1)}
              aria-label="上一张封面"
            >
              <ChevronLeft size={24} strokeWidth={2.5} />
            </button>
            <button
              className="latest-nav latest-nav-next"
              type="button"
              onClick={() => goTo(currentRef.current + 1)}
              aria-label="下一张封面"
            >
              <ChevronRight size={24} strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
      <div className="latest-controls">
        <span className="latest-count" aria-hidden="true">
          {String(active + 1).padStart(2, '0')} <span>/ {String(count).padStart(2, '0')}</span>
        </span>
        {count > 1 && (
          <div className="latest-dots" aria-label="选择封面">
            {games.map((game, index) => (
              <button
                type="button"
                aria-label={`显示第 ${index + 1} 张封面：${game.name}`}
                aria-current={index === active ? 'true' : undefined}
                onClick={() => goTo(index)}
                key={game.id}
              />
            ))}
          </div>
        )}
        {count > 1 && !reducedMotion && (
          <button
            className="latest-rotation"
            type="button"
            aria-label={rotationStopped ? '继续自动切换' : '暂停自动切换'}
            aria-pressed={rotationStopped}
            onClick={() => setRotationStopped((value) => !value)}
          >
            {rotationStopped ? <Play size={13} /> : <Pause size={13} />}
          </button>
        )}
        <p
          className="sr-only"
          aria-live={focused || hovered || rotationStopped || reducedMotion ? 'polite' : 'off'}
          aria-atomic="true"
        >
          第 {active + 1} 张，共 {count} 张：{games[active].name}
        </p>
      </div>
    </div>
  );
}
