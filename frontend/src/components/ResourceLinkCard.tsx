import { useEffect, useRef, useState } from 'react';
import { Copy, ExternalLink, Flag } from 'lucide-react';
import type { ResourceLink } from '@/types';
import { publicApi } from '@/api/public';
import { errorMessage } from '@/api/http';
import { StatusBadge } from './StatusBadge';
import { formatDate } from '@/utils/format';
const reportReasons = [
  ['LINK_BROKEN', '链接失效'],
  ['PASSWORD_WRONG', '提取码错误'],
  ['CONTENT_WRONG', '内容错误'],
  ['OTHER', '其他'],
] as const;
type ReportReason = (typeof reportReasons)[number][0];
export function ResourceLinkCard({ link }: { link: ResourceLink }) {
  const [copied, setCopied] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<ReportReason>('LINK_BROKEN');
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [message, setMessage] = useState('');
  const copyTimer = useRef<number>();
  useEffect(
    () => () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    },
    [],
  );
  const open = async () => {
    if (opening) return;
    setOpening(true);
    setMessage('');
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    try {
      const result = await publicApi.click(link.id);
      const url = new URL(result.url);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('资源链接无效。');
      if (tab) tab.location.replace(url.href);
      else window.location.assign(url.href);
    } catch (error) {
      tab?.close();
      setMessage(errorMessage(error, '资源打开失败，请稍后重试。'));
    } finally {
      setOpening(false);
    }
  };
  const copy = async () => {
    if (!link.password) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(link.password);
      else {
        const input = document.createElement('textarea');
        input.value = link.password;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        try {
          if (!document.execCommand('copy')) throw new Error('请手动复制提取码。');
        } finally {
          input.remove();
        }
      }
      setCopied(true);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setMessage('复制失败，请手动复制上方提取码。');
    }
  };
  const submitReport = async () => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await publicApi.report(link.id, reason);
      setReporting(false);
      setMessage('感谢反馈，已提交。');
    } catch (error) {
      setMessage(errorMessage(error, '提交失败，请稍后重试。'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-bold">{link.provider}</div>
          <div className="mt-1 text-xs text-ink-3">更新 {formatDate(link.updatedAt)}</div>
        </div>
        <StatusBadge status={link.status} />
      </div>
      <div className="mt-4 grid gap-2 text-sm text-ink-2">
        <div>版本：{link.version || '-'}</div>
        {link.password && (
          <div className="flex items-center gap-2">
            提取码：<code className="rounded bg-panel px-2 py-1">{link.password}</code>
            <button
              onClick={copy}
              className="inline-flex items-center text-brand"
              aria-label="复制提取码"
            >
              <Copy size={15} />
              {copied && (
                <span className="ml-1 text-xs" role="status">
                  已复制
                </span>
              )}
            </button>
          </div>
        )}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          className="btn btn-primary"
          disabled={opening || link.status === 'DISABLED'}
          onClick={open}
        >
          <ExternalLink size={16} />
          {opening ? '正在打开…' : '打开资源'}
        </button>
        <button
          className="btn btn-secondary"
          aria-expanded={reporting}
          onClick={() => setReporting((value) => !value)}
        >
          <Flag size={15} />
          报告失效
        </button>
      </div>
      {message && (
        <p className="mt-4 text-sm text-ink-2" role="status">
          {message}
        </p>
      )}
      {reporting && (
        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-line p-3 sm:flex-row">
          <select
            className="input"
            aria-label="反馈原因"
            value={reason}
            onChange={(event) => setReason(event.target.value as ReportReason)}
          >
            {reportReasons.map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
          <button className="btn btn-secondary shrink-0" disabled={busy} onClick={submitReport}>
            {busy ? '提交中…' : '提交反馈'}
          </button>
        </div>
      )}
    </div>
  );
}
