import { AlertCircle } from 'lucide-react';
export function ErrorState({
  retry,
  message = '加载失败，请稍后重试。',
}: {
  retry: () => void;
  message?: string;
}) {
  return (
    <div className="card flex flex-col items-center gap-4 p-10 text-center" role="alert">
      <AlertCircle className="text-amber-600" size={28} />
      <p className="text-ink-2">{message}</p>
      <button className="btn btn-secondary" onClick={retry}>
        重新加载
      </button>
    </div>
  );
}
