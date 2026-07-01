import apiClient from './client';

export interface GoogleAtRiskUser {
  id: number;
  email: string;
  auth_type: string;
  has_telegram: boolean;
  blocked_bot: boolean;
}

export interface GoogleMigrationStats {
  total: number;
  google_only: number;
  with_password: number;
}

export interface GoogleMigrationRun {
  running: boolean;
  total: number;
  sent: number;
  failed: number;
  started_at: string | null;
  finished_at: string | null;
}

export interface GoogleMigrationStatus {
  stats: GoogleMigrationStats;
  run: GoogleMigrationRun;
}

export const adminGoogleMigrationApi = {
  getStatus: async (): Promise<GoogleMigrationStatus> => {
    const { data } = await apiClient.get<GoogleMigrationStatus>(
      '/cabinet/admin/google-migration/status',
    );
    return data;
  },
  sendInvites: async (): Promise<{ started: boolean }> => {
    const { data } = await apiClient.post<{ started: boolean }>(
      '/cabinet/admin/google-migration/send',
    );
    return data;
  },
  getAtRisk: async (): Promise<{ count: number; users: GoogleAtRiskUser[] }> => {
    const { data } = await apiClient.get<{ count: number; users: GoogleAtRiskUser[] }>(
      '/cabinet/admin/google-migration/at-risk',
    );
    return data;
  },
  sendTest: async (email: string): Promise<{ found: boolean; sent: boolean }> => {
    const { data } = await apiClient.post<{ found: boolean; sent: boolean }>(
      '/cabinet/admin/google-migration/send-test',
      { email },
    );
    return data;
  },
};
