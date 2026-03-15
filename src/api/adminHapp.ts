import apiClient from './client';

// ============== Interfaces ==============

export interface HappStatus {
  module_enabled: boolean;
  remnawave_sync_enabled: boolean;
  providers_count: number;
  active_features: string[];
}

export interface HappSetting {
  key: string;
  label: string;
  hint: string;
  type: 'bool' | 'str' | 'choice' | 'int';
  category: string;
  group: string | null;
  depends_on: string | null;
  warning: boolean;
  choices: string[];
  max_length: number | null;
  validate: string | null;
  validate_hint: string | null;
  validate_range: [number, number] | null;
  value: unknown;
  is_overridden: boolean;
}

export interface HappCategorySettings {
  label: string;
  hint: string;
  settings: HappSetting[];
}

export interface HappSectionSettings {
  label: string;
  categories: Record<string, HappCategorySettings>;
}

export type HappSettingsResponse = Record<string, HappSectionSettings>;

export interface HappProvider {
  provider_id: string;
  managed?: boolean;
  total_assigned?: number;
}

export interface HappSchema {
  schema: Record<string, unknown>;
  categories: Record<string, string>;
  category_hints: Record<string, string>;
  sections: Record<string, { label: string; categories: string[] }>;
  section_order: string[];
  category_order: string[];
  choice_labels: Record<string, Record<string, string>>;
}

export interface HappSquadStatus {
  provider_id: string;
  squad_name: string;
  squad_uuid: string;
  users_count: number;
  capacity: number;
}

export interface HappSourceSquad {
  uuid: string;
  name: string;
}

export interface HappExternalSquad {
  uuid: string;
  name: string;
  users_count?: number;
}

export interface HappSyncResult {
  ok: boolean;
  total: number;
  headers_count: number;
  native_fields: string[];
  headers_preview: Record<string, string>;
}

export interface HappHeadersPreview {
  custom_response_headers: Record<string, string>;
  native_fields: Record<string, unknown>;
  module_enabled: boolean;
}

export type HappExportData = Record<string, unknown>;

// ============== API ==============

const BASE = '/cabinet/admin/happ';

export const adminHappApi = {
  getStatus: async (): Promise<HappStatus> => {
    const response = await apiClient.get<HappStatus>(`${BASE}/status`);
    return response.data;
  },

  getSettings: async (): Promise<HappSettingsResponse> => {
    const response = await apiClient.get<HappSettingsResponse>(`${BASE}/settings`);
    return response.data;
  },

  updateSetting: async (
    key: string,
    value: unknown,
  ): Promise<{ key: string; value: unknown; syncing: boolean }> => {
    const response = await apiClient.patch<{ key: string; value: unknown; syncing: boolean }>(
      `${BASE}/settings/key/${key}`,
      { value },
    );
    return response.data;
  },

  getProviders: async (): Promise<{ providers: HappProvider[] }> => {
    const response = await apiClient.get<{ providers: HappProvider[] }>(`${BASE}/providers`);
    return response.data;
  },

  addProvider: async (provider_id: string): Promise<{ provider_id: string; added: boolean }> => {
    const response = await apiClient.post<{ provider_id: string; added: boolean }>(
      `${BASE}/providers`,
      { provider_id },
    );
    return response.data;
  },

  updateProvider: async (
    provider_id: string,
    data: { managed?: boolean; total_assigned?: number },
  ): Promise<{ provider_id: string; updated: boolean }> => {
    const response = await apiClient.patch<{ provider_id: string; updated: boolean }>(
      `${BASE}/providers/${provider_id}`,
      data,
    );
    return response.data;
  },

  deleteProvider: async (
    provider_id: string,
  ): Promise<{ provider_id: string; removed: boolean }> => {
    const response = await apiClient.delete<{ provider_id: string; removed: boolean }>(
      `${BASE}/providers/${provider_id}`,
    );
    return response.data;
  },

  forceSync: async (): Promise<HappSyncResult> => {
    const response = await apiClient.post<HappSyncResult>(`${BASE}/sync`);
    return response.data;
  },

  cleanup: async (): Promise<{ ok: boolean; total: number }> => {
    const response = await apiClient.post<{ ok: boolean; total: number }>(`${BASE}/cleanup`);
    return response.data;
  },

  assignUsers: async (): Promise<{ assigned: number }> => {
    const response = await apiClient.post<{ assigned: number }>(`${BASE}/assign-users`);
    return response.data;
  },

  getSquadsStatus: async (): Promise<{ statuses: HappSquadStatus[] }> => {
    const response = await apiClient.get<{ statuses: HappSquadStatus[] }>(`${BASE}/squads/status`);
    return response.data;
  },

  getSourceSquads: async (): Promise<{ source_squads: HappSourceSquad[] }> => {
    const response = await apiClient.get<{ source_squads: HappSourceSquad[] }>(
      `${BASE}/source-squads`,
    );
    return response.data;
  },

  addSourceSquad: async (uuid: string, name: string): Promise<{ uuid: string; added: boolean }> => {
    const response = await apiClient.post<{ uuid: string; added: boolean }>(
      `${BASE}/source-squads`,
      { uuid, name },
    );
    return response.data;
  },

  removeSourceSquad: async (uuid: string): Promise<{ uuid: string; removed: boolean }> => {
    const response = await apiClient.delete<{ uuid: string; removed: boolean }>(
      `${BASE}/source-squads/${uuid}`,
    );
    return response.data;
  },

  clearSourceSquads: async (): Promise<{ removed: number }> => {
    const response = await apiClient.delete<{ removed: number }>(`${BASE}/source-squads`);
    return response.data;
  },

  getExternalSquads: async (): Promise<{ squads: HappExternalSquad[] }> => {
    const response = await apiClient.get<{ squads: HappExternalSquad[] }>(
      `${BASE}/external-squads`,
    );
    return response.data;
  },

  getHeadersPreview: async (): Promise<HappHeadersPreview> => {
    const response = await apiClient.get<HappHeadersPreview>(`${BASE}/headers-preview`);
    return response.data;
  },

  exportSettings: async (): Promise<HappExportData> => {
    const response = await apiClient.get<HappExportData>(`${BASE}/export`);
    return response.data;
  },

  importSettings: async (
    data: HappExportData,
  ): Promise<{ settings_imported: number; providers_imported: number }> => {
    const response = await apiClient.post<{
      settings_imported: number;
      providers_imported: number;
    }>(`${BASE}/import`, { data });
    return response.data;
  },
};
