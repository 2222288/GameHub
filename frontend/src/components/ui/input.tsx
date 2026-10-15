import type { InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';
export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('input', className)} {...p} />;
}
