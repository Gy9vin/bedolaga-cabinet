import apiClient from './client';
import type {
  ReferralInfo,
  ReferralTerms,
  PaginatedResponse,
  WithdrawalBalance,
  WithdrawalRequest,
} from '../types';

interface ReferralItem {
  id: number;
  username: string | null;
  first_name: string | null;
  created_at: string;
  has_subscription: boolean;
  has_paid: boolean;
}

interface ReferralEarning {
  id: number;
  amount_kopeks: number;
  amount_rubles: number;
  reason: string;
  referral_username: string | null;
  referral_first_name: string | null;
  created_at: string;
}

interface ReferralEarningsList extends PaginatedResponse<ReferralEarning> {
  total_amount_kopeks: number;
  total_amount_rubles: number;
}

export const referralApi = {
  // Get referral info
  getReferralInfo: async (): Promise<ReferralInfo> => {
    const response = await apiClient.get<ReferralInfo>('/cabinet/referral');
    return response.data;
  },

  // Get referral list
  getReferralList: async (params?: {
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<ReferralItem>> => {
    const response = await apiClient.get<PaginatedResponse<ReferralItem>>(
      '/cabinet/referral/list',
      {
        params,
      },
    );
    return response.data;
  },

  // Get referral earnings
  getReferralEarnings: async (params?: {
    page?: number;
    per_page?: number;
  }): Promise<ReferralEarningsList> => {
    const response = await apiClient.get<ReferralEarningsList>('/cabinet/referral/earnings', {
      params,
    });
    return response.data;
  },

  // Get referral terms
  getReferralTerms: async (): Promise<ReferralTerms> => {
    const response = await apiClient.get<ReferralTerms>('/cabinet/referral/terms');
    return response.data;
  },

  // Get withdrawal balance stats
  getWithdrawalBalance: async (): Promise<WithdrawalBalance> => {
    const response = await apiClient.get<WithdrawalBalance>('/cabinet/referral/withdrawal/balance');
    return response.data;
  },

  // Create withdrawal request
  createWithdrawalRequest: async (data: {
    amount_kopeks: number;
    payment_details: string;
  }): Promise<{ success: boolean; message: string; request_id: number }> => {
    const response = await apiClient.post('/cabinet/referral/withdrawal/request', data);
    return response.data;
  },

  // Get withdrawal requests history
  getWithdrawalRequests: async (params?: {
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<WithdrawalRequest>> => {
    const response = await apiClient.get<PaginatedResponse<WithdrawalRequest>>(
      '/cabinet/referral/withdrawal/requests',
      { params },
    );
    return response.data;
  },
};
