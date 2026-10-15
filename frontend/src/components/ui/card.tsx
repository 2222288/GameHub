import type { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';
export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card', className)} {...p} />;
}
