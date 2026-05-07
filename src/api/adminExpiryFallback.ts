import apiClient from './client';

export interface FallbackStats {
  enabled: boolean;
  fallback_squad_uuid: string | null;
  grace_days: number;
  total_days: number;
  expired_in_fallback: number;
  traffic_in_fallback: number;
  total_in_fallback: number;
}

export interface FallbackRestoreAllResponse {
  success: boolean;
  restored: number;
  failed: number;
  total: number;
}

export interface FallbackReconcileResponse {
  success: boolean;
  stats: Record<string, number | boolean>;
}

export interface CleanupOldExpiredResponse {
  success: boolean;
  deleted: number;
  skipped_with_balance: number;
  skipped_pending_purchase: number;
  total_candidates: number;
  months_threshold: number;
}

export const adminExpiryFallbackApi = {
  getStats: async (): Promise<FallbackStats> => {
    const response = await apiClient.get<FallbackStats>('/cabinet/admin/expiry-fallback/stats');
    return response.data;
  },

  restoreAll: async (): Promise<FallbackRestoreAllResponse> => {
    const response = await apiClient.post<FallbackRestoreAllResponse>(
      '/cabinet/admin/expiry-fallback/restore-all',
    );
    return response.data;
  },

  reconcile: async (): Promise<FallbackReconcileResponse> => {
    const response = await apiClient.post<FallbackReconcileResponse>(
      '/cabinet/admin/expiry-fallback/reconcile',
    );
    return response.data;
  },

  cleanupOldExpired: async (): Promise<CleanupOldExpiredResponse> => {
    const response = await apiClient.post<CleanupOldExpiredResponse>(
      '/cabinet/admin/expiry-fallback/cleanup-old-expired',
    );
    return response.data;
  },
};
