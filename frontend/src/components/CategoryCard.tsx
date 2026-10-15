import type { Category } from '@/types';
import { ArrowUpRight, Box, Gamepad2, Headset, Monitor, Sparkles, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Artwork } from './Artwork';

const icons = { Monitor, Headset, Wrench, Gamepad2, Sparkles, Box } as const;

export function CategoryCard({
  category,
  count,
  coverUrl,
}: {
  category: Category;
  count?: number;
  coverUrl?: string;
}) {
  const Icon = icons[(category.icon || 'Box') as keyof typeof icons] || Box;
  return (
    <Link to={`/games?category=${category.id}`} className="category-cover-card">
      <div className="category-cover-media">
        <Artwork url={coverUrl} name={category.name} />
        <div className="category-cover-icon">
          <Icon size={18} />
        </div>
      </div>
      <div className="category-cover-info">
        <div>
          <h3>{category.name}</h3>
          <p>{count ?? 0} 款游戏</p>
        </div>
        <ArrowUpRight className="category-cover-arrow" size={18} />
      </div>
    </Link>
  );
}
