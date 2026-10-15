import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { WallGame } from '@/types';
import { Artwork } from './Artwork';

type WallColumn = {
  key: string;
  items: WallGame[];
  duration: number;
  reverse: boolean;
  edge: number;
};

const NEUTRAL_BUCKET = 12;

const bucketFor = (game: WallGame) =>
  game.chroma != null && game.chroma < 0.025
    ? NEUTRAL_BUCKET
    : Math.floor((((game.hue ?? 0) + 360) % 360) / 30);

const circularDistance = (a: number, b: number) => {
  if (a === NEUTRAL_BUCKET || b === NEUTRAL_BUCKET) return a === b ? 0 : 6;
  return Math.min(Math.abs(a - b), 12 - Math.abs(a - b));
};

export function buildWallColumns(
  games: WallGame[],
  requestedColumns: number,
  minimumItems = 6,
): WallColumn[] {
  const columnCount = Math.max(3, Math.min(requestedColumns, 11));
  if (!games.length) return [];

  let groups = Array.from({ length: 13 }, (_, bucket) => ({
    bucket,
    items: games.filter((game) => bucketFor(game) === bucket),
  })).filter((group) => group.items.length);

  while (groups.length > columnCount) {
    const smallest = groups.reduce((best, group) =>
      group.items.length < best.items.length ? group : best,
    );
    const target = groups
      .filter((group) => group !== smallest)
      .reduce((best, group) =>
        circularDistance(group.bucket, smallest.bucket) <
        circularDistance(best.bucket, smallest.bucket)
          ? group
          : best,
      );
    target.items.push(...smallest.items);
    groups = groups.filter((group) => group !== smallest);
  }

  const allocations = new Map(groups.map((group) => [group.bucket, 1]));
  while ([...allocations.values()].reduce((sum, value) => sum + value, 0) < columnCount) {
    const next = groups.reduce((best, group) => {
      const score = group.items.length / (allocations.get(group.bucket) ?? 1);
      const bestScore = best.items.length / (allocations.get(best.bucket) ?? 1);
      return score > bestScore ? group : best;
    });
    allocations.set(next.bucket, (allocations.get(next.bucket) ?? 1) + 1);
  }

  const maxGroupSize = Math.max(...groups.map((group) => group.items.length));
  const lanes = groups.flatMap((group) => {
    const count = allocations.get(group.bucket) ?? 1;
    return Array.from({ length: count }, (_, laneIndex) => {
      const seed = group.items.filter((_, index) => index % count === laneIndex);
      const source = seed.length ? seed : group.items;
      const offset = laneIndex % source.length;
      const rotated = [...source.slice(offset), ...source.slice(0, offset)];
      const items = Array.from(
        { length: Math.max(6, minimumItems, rotated.length) },
        (_, index) => rotated[index % rotated.length],
      );
      return {
        bucket: group.bucket,
        density: group.items.length / maxGroupSize,
        items,
        laneIndex,
      };
    });
  });

  lanes.sort((a, b) => b.density - a.density || a.bucket - b.bucket || a.laneIndex - b.laneIndex);
  const positions = Array.from({ length: lanes.length }, (_, index) => index).sort((a, b) => {
    const middle = (lanes.length - 1) / 2;
    return Math.abs(a - middle) - Math.abs(b - middle) || a - b;
  });
  const ordered = new Array<(typeof lanes)[number]>(lanes.length);
  lanes.forEach((lane, index) => {
    ordered[positions[index]] = lane;
  });

  return ordered.map((lane, index) => {
    const middle = (ordered.length - 1) / 2;
    const edge = middle ? Math.abs(index - middle) / middle : 0;
    const waveBucket = lane.bucket === NEUTRAL_BUCKET ? 6 : lane.bucket;
    const wave = (Math.sin((waveBucket / 12) * Math.PI * 4) + 1) * 2.2;
    return {
      key: `${lane.bucket}-${lane.laneIndex}-${index}`,
      items: lane.items,
      duration: Math.round(56 - lane.density * 24 + edge * 10 + wave),
      reverse: index % 2 === 1,
      edge,
    };
  });
}

function columnCount(width: number) {
  if (width < 520) return 4;
  if (width < 760) return 5;
  if (width < 1100) return 7;
  if (width < 1500) return 9;
  return 11;
}

/**
 * The wall is animated by CSS so the duplicated sets meet without a seam.
 * Only a hovered / keyboard-focused lane changes speed. Adjusting the CSS
 * animation's playback rate preserves its current position while it eases to
 * a stop, and likewise avoids a jump when it starts moving again.
 */
function WallLane({
  column,
  selected,
  onHover,
  onFocus,
}: {
  column: WallColumn;
  selected: boolean;
  onHover: (active: boolean) => void;
  onFocus: (active: boolean) => void;
}) {
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = track.current;
    if (
      !node ||
      !('getAnimations' in node) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;

    const animation = node
      .getAnimations()
      .find((entry) => 'animationName' in entry && entry.animationName === 'wall-flow');
    if (!animation) return;

    const target = selected ? 0 : 1;
    const from = animation.playbackRate;
    if (Math.abs(from - target) < 0.001) return;

    // WAAPI changes the rate without restarting the underlying CSS animation.
    if (animation.playState === 'paused') {
      animation.updatePlaybackRate(Math.max(from, 0.001));
      animation.play();
    }

    const startedAt = performance.now();
    const duration = selected ? 620 : 720;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.max(0, Math.min(1, (now - startedAt) / duration));
      const ease = selected
        ? 1 - Math.pow(1 - progress, 3)
        : progress * progress * (3 - 2 * progress);
      animation.updatePlaybackRate(Math.max(0, from + (target - from) * ease));
      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      } else if (selected) {
        animation.pause();
      }
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [selected]);

  return (
    <div
      className="wall-column"
      data-selected={selected || undefined}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      onFocusCapture={() => onFocus(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onFocus(false);
      }}
    >
      <div
        ref={track}
        className={`wall-track ${column.reverse ? 'wall-track-reverse' : ''}`}
        style={{ '--wall-duration': `${column.duration}s` } as CSSProperties}
      >
        {[0, 1].map((copy) => (
          <div className="wall-column-set" aria-hidden={copy === 1} key={copy}>
            {column.items.map((game, index) => (
              <Link
                className="wall-cover"
                to={`/games/${encodeURIComponent(game.slug)}`}
                aria-label={`查看 ${game.name}`}
                key={`${copy}-${game.id}-${index}`}
                tabIndex={copy === 1 ? -1 : 0}
              >
                <Artwork
                  url={game.coverUrl}
                  name={game.name}
                  priority={copy === 0 && index === 0}
                />
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CoverWall({ games }: { games: WallGame[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [{ columns, minimumItems }, setWallSize] = useState(() => ({
    columns: columnCount(globalThis.innerWidth || 1280),
    minimumItems: 6,
  }));
  const [visible, setVisible] = useState(true);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const selectedKey = hoveredKey ?? focusedKey;
  const layout = useMemo(
    () => buildWallColumns(games, columns, minimumItems),
    [games, columns, minimumItems],
  );

  useLayoutEffect(() => {
    const node = root.current;
    const resize = () => {
      const width = node?.clientWidth || window.innerWidth || 1280;
      const height = node?.clientHeight || window.innerHeight;
      const nextColumns = columnCount(width);
      const nextMinimum = Math.max(6, Math.ceil(height / ((width / nextColumns) * 1.5)) + 1);
      setWallSize((previous) =>
        previous.columns === nextColumns && previous.minimumItems === nextMinimum
          ? previous
          : { columns: nextColumns, minimumItems: nextMinimum },
      );
    };
    resize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    if (node) observer?.observe(node);
    window.addEventListener('resize', resize, { passive: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting && !document.hidden);
      },
      { threshold: 0.02 },
    );
    observer.observe(node);
    const visibility = () =>
      setVisible(!document.hidden && node.getBoundingClientRect().bottom > 0);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  return (
    <div
      ref={root}
      className="cover-wall"
      data-offscreen={!visible || undefined}
      style={{ '--wall-columns': columns } as CSSProperties}
      aria-label="游戏封面背景墙"
    >
      {layout.map((column) => (
        <WallLane
          column={column}
          selected={selectedKey === column.key}
          onHover={(active) =>
            setHoveredKey((previous) =>
              active ? column.key : previous === column.key ? null : previous,
            )
          }
          onFocus={(active) =>
            setFocusedKey((previous) =>
              active ? column.key : previous === column.key ? null : previous,
            )
          }
          key={column.key}
        />
      ))}
    </div>
  );
}
