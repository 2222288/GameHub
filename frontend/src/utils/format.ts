export const formatDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('zh-CN') : '-';
export const compact = (n = 0) => new Intl.NumberFormat('zh-CN', { notation: 'compact' }).format(n);
