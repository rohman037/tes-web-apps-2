export const WORKSPACE_TABS = [
  'tiktok',
  'prompt',
  'photo',
  'ideas',
  'shop_ideas',
  'extractor',
  'paket',
  'pengaturan',
] as const;

export type WorkspaceTabType = (typeof WORKSPACE_TABS)[number];

export const DEFAULT_WORKSPACE_TAB: WorkspaceTabType = 'pengaturan';

export function isWorkspaceTab(value: string | null | undefined): value is WorkspaceTabType {
  return Boolean(value && WORKSPACE_TABS.includes(value as WorkspaceTabType));
}

export function getWorkspaceTabHref(tab: WorkspaceTabType): string {
  if (tab === DEFAULT_WORKSPACE_TAB) {
    return '/workspace';
  }

  return `/tools/${tab}`;
}

export const ADMIN_TABS = [
  'overview',
  'clients',
  'login_activity',
  'packages',
  'custom_access',
  'apikeys',
  'ai_agents',
  'safe_learning',
  'payment_queue',
  'qris',
  'contact',
  'announcements',
  'live_generation',
  'prompt_formulas',
  'analytics_cost',
  'affiliates',
  'custom_login_ui',
  'system_backup',
] as const;

export type AdminTabType = (typeof ADMIN_TABS)[number];

export const DEFAULT_ADMIN_TAB: AdminTabType = 'overview';

export function isAdminTab(value: string | null | undefined): value is AdminTabType {
  return Boolean(value && ADMIN_TABS.includes(value as AdminTabType));
}

export function getAdminTabHref(tab: AdminTabType): string {
  if (tab === DEFAULT_ADMIN_TAB) {
    return '/admin';
  }

  return `/admin?tab=${tab}`;
}
