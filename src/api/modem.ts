import apiClient from './client';
import type { ModemStatus, ModemPrice, ModemEnableResult, ModemDisableResult } from '../types';

export const modemApi = {
  getStatus: async (): Promise<ModemStatus> => {
    const response = await apiClient.get<ModemStatus>('/cabinet/modem/status');
    return response.data;
  },

  getPrice: async (): Promise<ModemPrice> => {
    const response = await apiClient.get<ModemPrice>('/cabinet/modem/price');
    return response.data;
  },

  enable: async (): Promise<ModemEnableResult> => {
    const response = await apiClient.post<ModemEnableResult>('/cabinet/modem/enable');
    return response.data;
  },

  disable: async (): Promise<ModemDisableResult> => {
    const response = await apiClient.post<ModemDisableResult>('/cabinet/modem/disable');
    return response.data;
  },
};
