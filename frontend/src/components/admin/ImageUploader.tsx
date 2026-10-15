import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { adminApi } from '@/api/admin';
const C = (...x: number[]) => String.fromCharCode(...x);
export function ImageUploader({
  gameId,
  type,
  onUploaded,
}: {
  gameId: number;
  type: 'COVER' | 'BANNER' | 'SCREENSHOT';
  onUploaded: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) {
      alert(C(20165, 25903, 25345, 26684));
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      alert(C(25991, 20214, 19981, 33021, 36229, 36807, 49, 48, 77, 66));
      return;
    }
    const form = new FormData();
    form.append('gameId', String(gameId));
    form.append('type', type);
    form.append('file', f);
    setBusy(true);
    try {
      await adminApi.upload(form);
      onUploaded();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-semibold">{type}</div>
        <span className="text-xs text-ink-3">JPG / PNG / WEBP, 10MB</span>
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      <button
        className="btn btn-secondary w-full"
        disabled={busy}
        onClick={() => ref.current?.click()}
      >
        <UploadCloud size={17} />
        {busy ? C(19978, 20256, 20256, 20256) : C(19978, 20256, 22270, 29255)}
      </button>
    </div>
  );
}
