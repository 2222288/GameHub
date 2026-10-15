import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { GameCard } from '@/types';

const bannerKey = (game: GameCard) => `${game.id}:${game.bannerUrl ?? ''}`;
const hasBanner = (game: GameCard) =>
  Boolean(game.bannerUrl && !game.bannerUrl.startsWith('placeholder://'));

/** Clean, manually controlled wide-banner carousel. */
export function LatestCarousel({ games }: { games: GameCard[] }) {
  const [current, setCurrent] = useState(0);
  const [failedBanners, setFailedBanners] = useState<Set<string>>(() => new Set());
  const root = useRef<HTMLDivElement>(null);
  const touchStart = useRef<number | null>(null);
  const restoreFocus = useRef(false);
  const usableGames = useMemo(
    () => games.filter((game) => hasBanner(game) && !failedBanners.has(bannerKey(game))),
    [failedBanners, games],
  );
  const count = usableGames.length;
  const active = Math.min(current, Math.max(0, count - 1));
  const activeGameKey = count ? bannerKey(usableGames[active]) : '';

  const goTo = useCallback(
    (next: number) => {
      if (!count) return;
      setCurrent(((next % count) + count) % count);
    },
    [count],
  );

  const rejectBanner = useCallback(
    (game: GameCard) => {
      const rejectedKey = bannerKey(game);
      const rejectedIndex = usableGames.findIndex((item) => bannerKey(item) === rejectedKey);
      const focusedLink = root.current?.querySelector<HTMLAnchorElement>(
        '.latest-slide[aria-hidden="false"] .latest-item',
      );
      if (rejectedIndex === active && focusedLink?.contains(document.activeElement)) {
        restoreFocus.current = true;
      }
      if (
        rejectedIndex >= 0 &&
        (rejectedIndex < active || (rejectedIndex === active && active === count - 1))
      ) {
        setCurrent((value) => Math.max(0, value - 1));
      }
      setFailedBanners((previous) => {
        if (previous.has(rejectedKey)) return previous;
        const next = new Set(previous);
        next.add(rejectedKey);
        return next;
      });
    },
    [active, count, usableGames],
  );

  useEffect(() => {
    setCurrent((value) => Math.min(value, Math.max(0, count - 1)));
  }, [count]);

  useEffect(() => {
    setFailedBanners((previous) => {
      const available = new Set(games.map(bannerKey));
      const next = new Set([...previous].filter((key) => available.has(key)));
      return next.size === previous.size ? previous : next;
    });
  }, [games]);

  useEffect(() => {
    const activeLink = root.current?.querySelector<HTMLAnchorElement>(
      '.latest-slide[aria-hidden="false"] .latest-item',
    );
    const focusedSlide = root.current?.querySelector(
      '.latest-slide[aria-hidden="true"] .latest-item:focus',
    );
    if (focusedSlide || restoreFocus.current) {
      activeLink?.focus({ preventScroll: true });
      restoreFocus.current = false;
    }
  }, [active, activeGameKey]);

  if (!count) {
    return (
      <div className="latest-empty" role="status">
        暂无可用焦点图片
      </div>
    );
  }

  return (
    <div
      ref={root}
      className="latest-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="焦点游戏"
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        goTo(active + (event.key === 'ArrowRight' ? 1 : -1));
      }}
      onTouchStart={(event) => {
        touchStart.current = event.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        if (touchStart.current == null) return;
        const end = event.changedTouches[0]?.clientX ?? touchStart.current;
        const delta = end - touchStart.current;
        touchStart.current = null;
        if (Math.abs(delta) >= 42) goTo(active + (delta < 0 ? 1 : -1));
      }}
      onTouchCancel={() => {
        touchStart.current = null;
      }}
    >
      <div className="latest-stage">
        {usableGames.map((game, index) => {
          const previous = (active - 1 + count) % count;
          const next = (active + 1) % count;
          const eager = index === active || index === previous || index === next;
          return (
            <div
              className="latest-slide"
              key={bannerKey(game)}
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
                <div className="latest-item-art">
                  <img
                    src={game.bannerUrl}
                    alt={game.name}
                    className="latest-art-main"
                    loading={eager ? 'eager' : 'lazy'}
                    decoding="async"
                    fetchPriority={index === active ? 'high' : 'auto'}
                    onError={() => rejectBanner(game)}
                  />
                </div>
              </Link>
            </div>
          );
        })}

        {count > 1 && (
          <>
            <button
              className="latest-nav latest-nav-prev"
              type="button"
              onClick={() => goTo(active - 1)}
              aria-label="上一张封面"
            >
              <ChevronLeft size={25} strokeWidth={2.4} />
            </button>
            <button
              className="latest-nav latest-nav-next"
              type="button"
              onClick={() => goTo(active + 1)}
              aria-label="下一张封面"
            >
              <ChevronRight size={25} strokeWidth={2.4} />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="latest-dots" aria-label="选择焦点游戏">
          {usableGames.map((game, index) => (
            <button
              type="button"
              aria-label={`显示第 ${index + 1} 张封面：${game.name}`}
              aria-current={index === active ? 'true' : undefined}
              onClick={() => goTo(index)}
              key={bannerKey(game)}
            />
          ))}
        </div>
      )}

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        第 {active + 1} 张，共 {count} 张：{usableGames[active].name}
      </p>
    </div>
  );
}
