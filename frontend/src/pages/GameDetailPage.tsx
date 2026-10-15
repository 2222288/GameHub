import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import {
  CalendarDays,
  ChevronRight,
  Copy,
  Download,
  Eye,
  HardDrive,
  Hash,
  Images,
  Layers,
  Link2,
  MonitorSmartphone,
  PackageOpen,
  Tag as TagIcon,
  Users,
} from 'lucide-react';
import { publicApi } from '@/api/public';
import type { GameDetail, GameRequirement } from '@/types';
import { Artwork } from '@/components/Artwork';
import { GameCard } from '@/components/GameCard';
import { ImageGallery } from '@/components/ImageGallery';
import { ResourceLinkCard } from '@/components/ResourceLinkCard';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ErrorState } from '@/components/ErrorState';
import { formatDate, compact } from '@/utils/format';

/** 由服务商名派生稳定色相，让下载按钮像参考站那样一眼区分线路。 */
function providerHue(provider: string) {
  let hash = 0;
  for (let i = 0; i < provider.length; i += 1) hash = (hash * 31 + provider.charCodeAt(i)) % 360;
  return hash;
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="detail-info-row">
      <span className="detail-info-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="detail-info-label">{label}</div>
        <div className="detail-info-value">{value}</div>
      </div>
    </div>
  );
}

function RequirementTable({ title, data }: { title: string; data?: GameRequirement }) {
  const rows: Array<[string, string | undefined]> = data
    ? [
        ['操作系统', data.os],
        ['处理器', data.cpu],
        ['显卡', data.gpu],
        ['内存', data.memory],
        ['存储空间', data.storage],
      ]
    : [];
  return (
    <div className="card p-5">
      <h3 className="mb-1 flex items-center gap-2 font-bold">
        <Layers size={16} className="text-brand" />
        {title}
      </h3>
      {data ? (
        <dl className="mt-3 divide-y divide-line text-sm">
          {rows.map(([label, value]) =>
            value ? (
              <div className="grid grid-cols-[76px_1fr] gap-3 py-2.5" key={label}>
                <dt className="text-ink-3">{label}</dt>
                <dd className="text-ink">{value}</dd>
              </div>
            ) : null,
          )}
        </dl>
      ) : (
        <p className="mt-3 text-sm text-ink-3">暂未收录该配置，参考游戏官方说明。</p>
      )}
    </div>
  );
}

function RelatedGames({ categoryId, slug }: { categoryId: number; slug: string }) {
  const related = useQuery({
    queryKey: ['public', 'related', categoryId, slug],
    queryFn: ({ signal }) =>
      publicApi.games({ page: 1, size: 8, category: categoryId, sort: 'updated' }, { signal }),
    staleTime: 60_000,
  });
  const items = (related.data?.items || []).filter((game) => game.slug !== slug).slice(0, 4);
  if (!items.length) return null;
  return (
    <section className="detail-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">MORE IN {related.data?.items?.[0]?.category || 'THIS CATEGORY'}</p>
          <h2 className="section-title mt-2">同类推荐</h2>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((game) => (
          <GameCard game={game} key={game.id} />
        ))}
      </div>
    </section>
  );
}

export default function GameDetailPage() {
  const { slug = '' } = useParams();
  const result = useQuery({
    queryKey: ['public', 'detail', slug],
    queryFn: ({ signal }) => publicApi.detail(slug, { signal }),
    staleTime: 0,
  });
  const g = result.data as GameDetail | undefined;

  if (result.isError)
    return (
      <div className="container-page py-16">
        <ErrorState retry={() => void result.refetch()} />
      </div>
    );
  if (!g)
    return (
      <div className="container-page py-10">
        <LoadingSkeleton count={4} />
      </div>
    );

  const accent = g.coverAccent || '#b8432e';
  const minimum = g.requirements.find((x) => x.type === 'MINIMUM');
  const recommended = g.requirements.find((x) => x.type === 'RECOMMENDED');
  const totalDownloads = g.resourceLinks.length;
  const copyShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard?.writeText(url);
    } catch {
      /* 剪贴板不可用时静默降级，链接本身已可见 */
    }
  };

  return (
    <div className="detail-page" style={{ '--accent': accent } as React.CSSProperties}>
      <section className="detail-hero">
        {g.bannerUrl && (
          <div className="detail-hero-media" aria-hidden="true">
            <Artwork url={g.bannerUrl} name="" />
          </div>
        )}
        <div className="detail-hero-scrim" aria-hidden="true" />
        <div className="detail-hero-glow" aria-hidden="true" />
        <div className="container-page detail-hero-inner">
          <nav className="detail-crumb" aria-label="面包屑">
            <Link to="/">首页</Link>
            <ChevronRight size={13} aria-hidden="true" />
            <Link to={`/games?category=${g.categoryId}`}>{g.category || '游戏库'}</Link>
            <ChevronRight size={13} aria-hidden="true" />
            <span aria-current="page">{g.name}</span>
          </nav>

          <div className="detail-hero-grid">
            <div className="detail-cover">
              <Artwork url={g.coverUrl} name={`${g.name} 封面`} priority />
            </div>

            <div className="detail-headline">
              <div className="flex flex-wrap gap-2">
                {g.category && <span className="detail-chip detail-chip-accent">{g.category}</span>}
                {g.currentVersion && <span className="detail-chip">{g.currentVersion}</span>}
                {g.languages.map((lang) => (
                  <span className="detail-chip" key={lang}>
                    {lang}
                  </span>
                ))}
                {g.platforms.map((platform) => (
                  <span className="detail-chip" key={platform}>
                    {platform}
                  </span>
                ))}
              </div>

              <h1 className="detail-title">{g.name}</h1>
              {g.englishName && <p className="detail-english">{g.englishName}</p>}
              <p className="detail-summary">{g.summary}</p>

              <dl className="detail-metrics">
                <div>
                  <dt>
                    <CalendarDays size={14} /> 更新时间
                  </dt>
                  <dd>{formatDate(g.updatedAt)}</dd>
                </div>
                <div>
                  <dt>
                    <Eye size={14} /> 浏览
                  </dt>
                  <dd>{compact(g.viewCount)}</dd>
                </div>
                <div>
                  <dt>
                    <Download size={14} /> 资源点击
                  </dt>
                  <dd>{compact(g.resourceClickCount)}</dd>
                </div>
                {g.fileSize && (
                  <div>
                    <dt>
                      <HardDrive size={14} /> 文件大小
                    </dt>
                    <dd>{g.fileSize}</dd>
                  </div>
                )}
              </dl>

              <div className="detail-actions">
                <a className="detail-btn-primary" href="#resources">
                  <Download size={17} />
                  查看下载资源
                </a>
                <button type="button" className="detail-btn-ghost" onClick={copyShare}>
                  <Copy size={16} />
                  复制本页链接
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container-page detail-body">
        <div className="detail-main">
          <section className="detail-section" id="intro">
            <h2 className="section-title">游戏介绍</h2>
            <div className="card prose max-w-none p-6 prose-headings:text-ink prose-p:text-ink-2 prose-li:text-ink-2 prose-blockquote:border-brand prose-blockquote:text-ink-2">
              <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                {g.description || g.summary}
              </ReactMarkdown>
            </div>
          </section>

          {g.screenshots.length > 0 && (
            <section className="detail-section" id="screenshots">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="section-title">
                  <Images size={17} className="mr-2 inline-block text-brand" />
                  游戏截图
                </h2>
                <span className="text-xs text-ink-3">{g.screenshots.length} 张</span>
              </div>
              <div className="mt-4">
                <ImageGallery items={g.screenshots} name={g.name} />
              </div>
            </section>
          )}

          <section className="detail-section" id="requirements">
            <h2 className="section-title">配置需求</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <RequirementTable title="最低配置" data={minimum} />
              <RequirementTable title="推荐配置" data={recommended} />
            </div>
          </section>

          <section className="detail-section" id="resources">
            <h2 className="section-title">
              <Download size={17} className="mr-2 inline-block text-brand" />
              下载资源
            </h2>
            <p className="mt-2 text-sm text-ink-3">
              共 {totalDownloads} 条线路。下载后请放在全英文路径，解压后运行游戏主程序即可。
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {g.resourceLinks.length ? (
                g.resourceLinks.map((link) => <ResourceLinkCard link={link} key={link.id} />)
              ) : (
                <div className="card p-8 text-ink-3">
                  <PackageOpen size={20} className="mb-2" />
                  暂无可用资源，链接修复后会同步更新。
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="detail-side">
          <div className="card detail-info-card">
            <h2 className="detail-side-title">
              <MonitorSmartphone size={16} /> 游戏信息
            </h2>
            <InfoRow icon={<Hash size={15} />} label="中文名称" value={g.name} />
            <InfoRow icon={<Hash size={15} />} label="英文名称" value={g.englishName} />
            {g.aliases && <InfoRow icon={<Hash size={15} />} label="其他标题" value={g.aliases} />}
            <InfoRow icon={<Users size={15} />} label="开发" value={g.developer} />
            <InfoRow icon={<Users size={15} />} label="发行" value={g.publisher} />
            <InfoRow
              icon={<CalendarDays size={15} />}
              label="发行日期"
              value={g.releaseDate ? formatDate(g.releaseDate) : undefined}
            />
            <InfoRow icon={<Layers size={15} />} label="游戏分类" value={g.category} />
            <InfoRow icon={<Hash size={15} />} label="当前版本" value={g.currentVersion} />
            <InfoRow icon={<HardDrive size={15} />} label="文件大小" value={g.fileSize} />
            <InfoRow
              icon={<CalendarDays size={15} />}
              label="版本更新"
              value={g.versionUpdateDate ? formatDate(g.versionUpdateDate) : undefined}
            />
            <InfoRow
              icon={<Download size={15} />}
              label="资源线路"
              value={`${totalDownloads} 条`}
            />
          </div>

          {g.tags.length > 0 && (
            <div className="card detail-info-card">
              <h2 className="detail-side-title">
                <TagIcon size={16} /> 标签
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {g.tags.map((tag) => (
                  <span className="badge" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {g.resourceLinks.length > 0 && (
            <div className="card detail-info-card">
              <h2 className="detail-side-title">
                <Link2 size={16} /> 快速选路
              </h2>
              <ul className="detail-quick-links">
                {g.resourceLinks.map((link) => (
                  <li key={link.id}>
                    <a
                      href="#resources"
                      style={{ '--h': providerHue(link.provider) } as React.CSSProperties}
                    >
                      <span className="detail-quick-dot" aria-hidden="true" />
                      {link.provider}
                      {link.password && <em>提取码 {link.password}</em>}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {g.versionNotes && (
            <div className="card detail-info-card">
              <h2 className="detail-side-title">
                <PackageOpen size={16} /> 版本说明
              </h2>
              <p className="mt-3 whitespace-pre-line text-sm text-ink-2">{g.versionNotes}</p>
            </div>
          )}
        </aside>
      </div>

      <div className="container-page detail-related">
        <RelatedGames categoryId={g.categoryId} slug={g.slug} />
      </div>
    </div>
  );
}
