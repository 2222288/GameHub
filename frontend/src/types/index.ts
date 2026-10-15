export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}
export interface Category {
  id: number;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  sortOrder: number;
  enabled: boolean;
  gameCount?: number;
}
export interface Tag {
  id: number;
  name: string;
  slug: string;
}
export interface GameCard {
  id: number;
  name: string;
  englishName?: string;
  slug: string;
  summary: string;
  coverUrl?: string;
  bannerUrl?: string;
  coverHue?: number;
  coverChroma?: number;
  coverLightness?: number;
  coverAccent?: string;
  coverColorConfidence?: number;
  category?: string;
  currentVersion?: string;
  status: string;
  viewCount: number;
  resourceClickCount: number;
  updatedAt: string;
  publishedAt?: string;
  tags: string[];
  platforms: string[];
  languages: string[];
}
export interface WallGame {
  id: number;
  name: string;
  slug: string;
  coverUrl?: string;
  hue: number;
  chroma?: number;
  lightness?: number;
  accentColor?: string;
  colorConfidence?: number;
}
export interface GameMedia {
  id: number;
  type: string;
  url: string;
  sortOrder: number;
}
export interface GameRequirement {
  id: number;
  type: 'MINIMUM' | 'RECOMMENDED';
  os?: string;
  cpu?: string;
  gpu?: string;
  memory?: string;
  storage?: string;
}
export interface ResourceLink {
  id: number;
  provider: string;
  password?: string;
  version?: string;
  status: 'ACTIVE' | 'UNKNOWN' | 'BROKEN' | 'DISABLED';
  sortOrder: number;
  lastCheckedAt?: string;
  updatedAt: string;
}
export interface GameDetail {
  id: number;
  name: string;
  englishName?: string;
  slug: string;
  aliases?: string;
  summary: string;
  description?: string;
  developer?: string;
  publisher?: string;
  releaseDate?: string;
  category?: string;
  categoryId: number;
  coverUrl?: string;
  bannerUrl?: string;
  coverHue?: number;
  coverChroma?: number;
  coverLightness?: number;
  coverAccent?: string;
  coverColorConfidence?: number;
  coverHueOverride?: number;
  wallEnabled?: boolean;
  currentVersion?: string;
  fileSize?: string;
  versionUpdateDate?: string;
  versionNotes?: string;
  status: string;
  viewCount: number;
  resourceClickCount: number;
  updatedAt: string;
  tags: string[];
  tagIds: number[];
  platforms: string[];
  languages: string[];
  screenshots: GameMedia[];
  requirements: GameRequirement[];
  resourceLinks: ResourceLink[];
}
export interface Dashboard {
  games: number;
  published: number;
  draft: number;
  offline: number;
  links: number;
  brokenLinks: number;
  todayViews: number;
  todayClicks: number;
  todaySearches: number;
  recentGames: Record<string, unknown>[];
  reports: Record<string, unknown>[];
  hotSearches: Record<string, unknown>[];
}

export interface AdminResourceLink {
  id: number;
  gameId: number;
  gameVersionId?: number;
  gameName: string;
  provider: string;
  url: string;
  password?: string;
  version?: string;
  status: 'ACTIVE' | 'UNKNOWN' | 'BROKEN' | 'DISABLED';
  sortOrder: number;
  reportCount: number;
  lastCheckedAt?: string;
  updatedAt: string;
}
export interface AdminReport {
  id: number;
  resourceLinkId: number;
  gameId?: number;
  gameName: string;
  provider: string;
  reason: string;
  status: string;
  createdAt: string;
  processedAt?: string;
}
