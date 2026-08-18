import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { infoApi, type UiMode } from '@/api/info';

// Последний известный режим. Пока запрос в полёте, режим был бы неизвестен, и
// кабинет успевал бы отрисовать полную навигацию, а затем схлопнуть её до
// четырёх вкладок — заметный прыжок на каждом холодном старте. Тот же приём
// уже применён в useFeatureFlags по той же причине.
export const UI_MODE_CACHE_KEY = 'cabinet-ui-mode';

export function readUiModeCache(): UiMode {
  try {
    const raw = localStorage.getItem(UI_MODE_CACHE_KEY);
    return raw === 'simple' || raw === 'advanced' ? raw : 'advanced';
  } catch {
    return 'advanced';
  }
}

export function writeUiModeCache(mode: UiMode): void {
  try {
    localStorage.setItem(UI_MODE_CACHE_KEY, mode);
  } catch {
    /* sandboxed / private */
  }
}

export function useUiMode() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const queryClient = useQueryClient();
  const cached = readUiModeCache();

  const { data } = useQuery({
    queryKey: ['ui-mode'],
    queryFn: infoApi.getUiMode,
    enabled: isAuthenticated,
    staleTime: 60000,
  });

  const mutation = useMutation({
    mutationFn: (mode: UiMode | null) => infoApi.updateUiMode(mode),
    onSuccess: (result) => {
      writeUiModeCache(result.mode);
      queryClient.setQueryData(['ui-mode'], result);
    },
  });

  const mode: UiMode = data?.mode ?? cached;
  if (data?.mode && data.mode !== cached) {
    writeUiModeCache(data.mode);
  }

  return {
    mode,
    choice: data?.choice ?? null,
    globalDefault: data?.global_default ?? 'advanced',
    isSimple: mode === 'simple',
    setMode: mutation.mutate,
    isSaving: mutation.isPending,
  };
}
