import apiClient from './client';

export interface ChannelPostInfo {
  id: number;
  link: string;
  title: string | null;
}

export interface ChannelBasicInfo {
  title: string | null;
  link: string | null;
}

export interface ChannelNudgeData {
  needs_subscribe: boolean;
  channel: ChannelBasicInfo | null;
  latest_post: ChannelPostInfo | null;
  show_post: boolean;
}

export async function getChannelNudge(): Promise<ChannelNudgeData> {
  const { data } = await apiClient.get<ChannelNudgeData>('/cabinet/channel-nudge');
  return data;
}

export async function markChannelPostSeen(postId: number): Promise<void> {
  await apiClient.post('/cabinet/channel-nudge/seen', { post_id: postId });
}
