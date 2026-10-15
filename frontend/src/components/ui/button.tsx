import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';
export function Button({ className, ...p }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn('btn btn-primary', className)} {...p} />;
}
