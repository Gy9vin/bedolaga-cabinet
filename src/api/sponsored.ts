import apiClient from './client';

// Types

export interface SponsoredPeriodOption {
  period_days: number;
  price_kopeks: number;
}

export interface SponsoredLookupResponse {
  recipient_display_name: string;
  subscription_id: number | null;
  options: SponsoredPeriodOption[];
  payer_balance_kopeks: number;
}

export interface SponsoredPayResponse {
  status: 'applied';
  recipient_display_name: string;
  period_days: number;
  amount_kopeks: number;
}

// API

export const sponsoredApi = {
  lookup: async (query: string): Promise<SponsoredLookupResponse> => {
    const { data } = await apiClient.post<SponsoredLookupResponse>('/cabinet/sponsored/lookup', {
      query,
    });
    return data;
  },

  pay: async (query: string, periodDays: number): Promise<SponsoredPayResponse> => {
    const { data } = await apiClient.post<SponsoredPayResponse>('/cabinet/sponsored/pay', {
      query,
      period_days: periodDays,
    });
    return data;
  },
};
