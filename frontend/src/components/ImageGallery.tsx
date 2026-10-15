import type { GameMedia } from '@/types';
import { Artwork } from './Artwork';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
export function ImageGallery({ items, name }: { items: GameMedia[]; name: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (index !== null && index >= items.length) setIndex(null);
  }, [index, items.length]);
  if (!items.length) return null;
  const move = (delta: number) =>
    setIndex((current) =>
      current === null ? null : (current + delta + items.length) % items.length,
    );
  const active = index === null ? undefined : items[index];
  return (
    <Dialog
      open={Boolean(active)}
      onOpenChange={(open) => {
        if (!open) setIndex(null);
      }}
    >
      <div className="flex snap-x gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible lg:grid-cols-4">
        {items.map((item, position) => (
          <button
            key={item.id}
            onClick={(event) => {
              trigger.current = event.currentTarget;
              setIndex(position);
            }}
            aria-label={`查看 ${name} 截图 ${position + 1}`}
            className="aspect-video min-w-[78%] snap-center overflow-hidden rounded-xl border border-line md:min-w-0"
          >
            <Artwork url={item.url} name={`${name} 截图 ${position + 1}`} />
          </button>
        ))}
      </div>
      {active && (
        <DialogContent
          className="max-w-5xl p-3 sm:p-5"
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault();
              move(event.key === 'ArrowLeft' ? -1 : 1);
            }
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          <div className="sr-only">
            <DialogTitle>{name} 游戏截图</DialogTitle>
            <DialogDescription>
              截图 {index! + 1} / {items.length}，使用左右方向键切换，Escape 关闭。
            </DialogDescription>
          </div>
          <div className="aspect-video overflow-hidden rounded-lg">
            <Artwork url={active.url} name={`${name} 截图 ${index! + 1}`} priority />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <button
              className="btn btn-secondary"
              aria-label="上一张截图"
              onClick={() => move(-1)}
              disabled={items.length === 1}
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm text-ink-2" role="status">
              {index! + 1} / {items.length}
            </span>
            <button
              className="btn btn-secondary"
              aria-label="下一张截图"
              onClick={() => move(1)}
              disabled={items.length === 1}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
