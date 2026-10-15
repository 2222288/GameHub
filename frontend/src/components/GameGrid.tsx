import type { GameCard as T } from '@/types';
import { GameCard } from './GameCard';
export function GameGrid({ games }: { games: T[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {games.map((g) => (
        <GameCard key={g.id} game={g} />
      ))}
    </div>
  );
}
