import apiClient from './client';

// Types
export interface RequiredChannel {
  id: number;
  channel_id: string;
  channel_link: string | null;
  title: string | null;
  is_active: boolean;
  sort_order: number;
  disable_trial_on_leave: boolean;
  disable_paid_on_leave: boolean;
}

export interface ChannelListResponse {
  items: RequiredChannel[];
  total: number;
}

export interface CreateChannelRequest {
  channel_id: string;
  channel_link?: string;
  title?: string;
  disable_trial_on_leave?: boolean;
  disable_paid_on_leave?: boolean;
}

export interface UpdateChannelRequest {
  channel_id?: string;
  channel_link?: string;
  title?: string;
  is_active?: boolean;
  sort_order?: number;
  disable_trial_on_leave?: boolean;
  disable_paid_on_leave?: boolean;
}

export type ChannelReportStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ChannelReport {
  report_id: string;
  status: ChannelReportStatus;
  channel_db_id: number;
  channel_id: string;
  channel_title: string | null;
  total: number;
  processed: number;
  in_channel: number;
  not_in_channel: number;
  errors: number;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  has_csv: boolean;
}

export interface StartReportResponse {
  report_id: string;
}

export const adminChannelsApi = {
  list: async (): Promise<ChannelListResponse> => {
    const { data } = await apiClient.get<ChannelListResponse>(
      '/cabinet/admin/channel-subscriptions',
    );
    return data;
  },

  create: async (req: CreateChannelRequest): Promise<RequiredChannel> => {
    const { data } = await apiClient.post<RequiredChannel>(
      '/cabinet/admin/channel-subscriptions',
      req,
    );
    return data;
  },

  update: async (id: number, req: UpdateChannelRequest): Promise<RequiredChannel> => {
    const { data } = await apiClient.patch<RequiredChannel>(
      `/cabinet/admin/channel-subscriptions/${id}`,
      req,
    );
    return data;
  },

  toggle: async (id: number): Promise<RequiredChannel> => {
    const { data } = await apiClient.post<RequiredChannel>(
      `/cabinet/admin/channel-subscriptions/${id}/toggle`,
    );
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/cabinet/admin/channel-subscriptions/${id}`);
  },

  startReport: async (channelDbId: number): Promise<StartReportResponse> => {
    const { data } = await apiClient.post<StartReportResponse>(
      `/cabinet/admin/channel-subscriptions/${channelDbId}/report`,
    );
    return data;
  },

  getReport: async (reportId: string): Promise<ChannelReport> => {
    const { data } = await apiClient.get<ChannelReport>(
      `/cabinet/admin/channel-subscriptions/reports/${reportId}`,
    );
    return data;
  },

  cancelReport: async (reportId: string): Promise<{ cancelled: boolean }> => {
    const { data } = await apiClient.post<{ cancelled: boolean }>(
      `/cabinet/admin/channel-subscriptions/reports/${reportId}/cancel`,
    );
    return data;
  },

  downloadReportCsv: async (reportId: string): Promise<Blob> => {
    const response = await apiClient.get(
      `/cabinet/admin/channel-subscriptions/reports/${reportId}/csv`,
      { responseType: 'blob' },
    );
    return response.data as Blob;
  },
};

export default adminChannelsApi;
