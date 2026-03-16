import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminHappApi, type HappSetting, type HappSyncResult } from '../api/adminHapp';

// ============== Tabs ==============

type TabId = 'settings' | 'providers' | 'sync' | 'sources' | 'export' | 'guide';

const TABS: { id: TabId; label: string }[] = [
  { id: 'settings', label: 'Настройки' },
  { id: 'providers', label: 'Провайдеры' },
  { id: 'sync', label: 'Синхронизация' },
  { id: 'sources', label: 'Источники' },
  { id: 'export', label: 'Экспорт/Импорт' },
  { id: 'guide', label: '📖 Инструкция' },
];

// ============== Toggle Component ==============

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-accent-500' : 'bg-dark-600'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ============== Setting Row Component ==============

function SettingRow({
  setting,
  allSettings,
  onUpdate,
  isUpdating,
}: {
  setting: HappSetting;
  allSettings: HappSetting[];
  onUpdate: (key: string, value: unknown) => void;
  isUpdating: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const isDependencyMet = useMemo(() => {
    if (!setting.depends_on) return true;
    const dep = allSettings.find((s) => s.key === setting.depends_on);
    if (!dep) return true;
    return !!dep.value;
  }, [setting.depends_on, allSettings]);

  const startEdit = useCallback(() => {
    setEditValue(String(setting.value ?? ''));
    setEditing(true);
  }, [setting.value]);

  const confirmEdit = useCallback(() => {
    const finalValue = setting.type === 'int' ? Number(editValue) : editValue;
    onUpdate(setting.key, finalValue);
    setEditing(false);
  }, [editValue, setting.key, setting.type, onUpdate]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
  }, []);

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border border-dark-700/50 bg-dark-800/40 p-3 transition-opacity ${
        !isDependencyMet ? 'opacity-40' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-dark-100">{setting.label}</span>
            {setting.warning && (
              <span className="rounded bg-warning-500/20 px-1.5 py-0.5 text-xs font-medium text-warning-400">
                !
              </span>
            )}
            {setting.is_overridden && (
              <span className="rounded bg-accent-500/20 px-1.5 py-0.5 text-xs text-accent-400">
                override
              </span>
            )}
          </div>
          {setting.hint && <p className="mt-0.5 text-xs text-dark-400">{setting.hint}</p>}
        </div>

        {/* Bool toggle */}
        {setting.type === 'bool' && (
          <Toggle
            checked={!!setting.value}
            onChange={(val) => onUpdate(setting.key, val)}
            disabled={isUpdating || !isDependencyMet}
          />
        )}
      </div>

      {/* Choice chips */}
      {setting.type === 'choice' && (
        <div className="flex flex-wrap gap-1.5">
          {setting.choices.map((choice) => (
            <button
              key={choice}
              onClick={() => onUpdate(setting.key, choice)}
              disabled={isUpdating || !isDependencyMet}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                setting.value === choice
                  ? 'bg-accent-500 text-white'
                  : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {choice}
            </button>
          ))}
        </div>
      )}

      {/* String / Int display + edit */}
      {(setting.type === 'str' || setting.type === 'int') && !editing && (
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate rounded bg-dark-700/50 px-2 py-1 font-mono text-xs text-dark-300">
            {setting.value != null ? String(setting.value) : '---'}
          </span>
          <button
            onClick={startEdit}
            disabled={isUpdating || !isDependencyMet}
            className="shrink-0 rounded-lg bg-dark-700 px-3 py-1 text-xs text-dark-300 transition-colors hover:bg-dark-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Изменить
          </button>
        </div>
      )}

      {/* Inline edit mode */}
      {(setting.type === 'str' || setting.type === 'int') && editing && (
        <div className="flex items-center gap-2">
          <input
            type={setting.type === 'int' ? 'number' : 'text'}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            maxLength={setting.max_length ?? undefined}
            min={setting.validate_range?.[0]}
            max={setting.validate_range?.[1]}
            className="min-w-0 flex-1 rounded-lg border border-dark-600 bg-dark-700 px-3 py-1.5 text-sm text-dark-100 focus:border-accent-500 focus:outline-none"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmEdit();
              if (e.key === 'Escape') cancelEdit();
            }}
          />
          <button
            onClick={confirmEdit}
            disabled={isUpdating}
            className="shrink-0 rounded-lg bg-accent-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-accent-500"
          >
            OK
          </button>
          <button
            onClick={cancelEdit}
            className="shrink-0 rounded-lg bg-dark-700 px-3 py-1.5 text-xs text-dark-300 transition-colors hover:bg-dark-600"
          >
            Отмена
          </button>
        </div>
      )}

      {setting.validate_hint && editing && (
        <p className="text-xs text-dark-500">{setting.validate_hint}</p>
      )}
    </div>
  );
}

// ============== Settings Tab ==============

function SettingsTab() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['happ-settings'],
    queryFn: adminHappApi.getSettings,
    staleTime: 30000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      adminHappApi.updateSetting(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['happ-settings'] });
      queryClient.invalidateQueries({ queryKey: ['happ-status'] });
    },
  });

  const handleUpdate = useCallback(
    (key: string, value: unknown) => {
      updateMutation.mutate({ key, value });
    },
    [updateMutation],
  );

  const allSettings = useMemo(() => {
    if (!settings) return [];
    const result: HappSetting[] = [];
    for (const section of Object.values(settings)) {
      for (const category of Object.values(section.categories)) {
        result.push(...category.settings);
      }
    }
    return result;
  }, [settings]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="py-8 text-center text-sm text-dark-500">Не удалось загрузить настройки</div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(settings).map(([sectionKey, section]) => (
        <div key={sectionKey} className="space-y-4">
          <h3 className="text-lg font-semibold text-dark-100">{section.label}</h3>
          {Object.entries(section.categories).map(([catKey, category]) => (
            <div key={catKey} className="space-y-2">
              <div>
                <h4 className="text-sm font-medium text-dark-300">{category.label}</h4>
                {category.hint && <p className="text-xs text-dark-500">{category.hint}</p>}
              </div>
              <div className="space-y-2">
                {category.settings.map((setting) => (
                  <SettingRow
                    key={setting.key}
                    setting={setting}
                    allSettings={allSettings}
                    onUpdate={handleUpdate}
                    isUpdating={updateMutation.isPending}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ============== Providers Tab ==============

function ProvidersTab() {
  const queryClient = useQueryClient();
  const [newProviderId, setNewProviderId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['happ-providers'],
    queryFn: adminHappApi.getProviders,
    staleTime: 30000,
  });

  const addMutation = useMutation({
    mutationFn: adminHappApi.addProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['happ-providers'] });
      queryClient.invalidateQueries({ queryKey: ['happ-status'] });
      setNewProviderId('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: adminHappApi.deleteProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['happ-providers'] });
      queryClient.invalidateQueries({ queryKey: ['happ-status'] });
    },
  });

  const handleAdd = useCallback(() => {
    const trimmed = newProviderId.trim();
    if (trimmed.length > 0) {
      addMutation.mutate(trimmed);
    }
  }, [newProviderId, addMutation]);

  return (
    <div className="space-y-4">
      {/* Add form */}
      <div className="rounded-xl border border-dark-700/50 bg-dark-800/40 p-4">
        <h3 className="mb-3 text-sm font-medium text-dark-200">Добавить провайдера</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={newProviderId}
            onChange={(e) =>
              setNewProviderId(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8))
            }
            placeholder="ID провайдера (8 символов)"
            maxLength={8}
            className="min-w-0 flex-1 rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-dark-100 placeholder-dark-500 focus:border-accent-500 focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
          />
          <button
            onClick={handleAdd}
            disabled={addMutation.isPending || newProviderId.trim().length === 0}
            className="shrink-0 rounded-lg bg-accent-600 px-4 py-2 text-sm text-white transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Добавить
          </button>
        </div>
      </div>

      {/* Providers list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
        </div>
      ) : data?.providers && data.providers.length > 0 ? (
        <div className="space-y-2">
          {data.providers.map((provider) => (
            <div
              key={provider.provider_id}
              className="flex items-center justify-between rounded-xl border border-dark-700/50 bg-dark-800/40 p-4"
            >
              <div>
                <span className="font-mono text-sm font-medium text-dark-100">
                  {provider.provider_id}
                </span>
                <div className="mt-1 flex items-center gap-3 text-xs text-dark-400">
                  {provider.managed != null && (
                    <span>{provider.managed ? 'Управляемый' : 'Неуправляемый'}</span>
                  )}
                  {provider.total_assigned != null && (
                    <span>Назначено: {provider.total_assigned}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => deleteMutation.mutate(provider.provider_id)}
                disabled={deleteMutation.isPending}
                className="rounded-lg bg-error-500/20 px-3 py-1.5 text-xs font-medium text-error-400 transition-colors hover:bg-error-500/30 disabled:opacity-50"
              >
                Удалить
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-dark-500">Нет провайдеров</div>
      )}
    </div>
  );
}

// ============== Sync Tab ==============

function SyncTab() {
  const queryClient = useQueryClient();
  const [syncResult, setSyncResult] = useState<HappSyncResult | null>(null);
  const [cleanupResult, setCleanupResult] = useState<{ ok: boolean; total: number } | null>(null);
  const [assignResult, setAssignResult] = useState<{ assigned: number } | null>(null);

  const { data: status } = useQuery({
    queryKey: ['happ-status'],
    queryFn: adminHappApi.getStatus,
    staleTime: 30000,
  });

  const { data: squadsData, isLoading: squadsLoading } = useQuery({
    queryKey: ['happ-squads'],
    queryFn: adminHappApi.getSquadsStatus,
    staleTime: 30000,
  });

  const { data: headersData } = useQuery({
    queryKey: ['happ-headers'],
    queryFn: adminHappApi.getHeadersPreview,
    staleTime: 30000,
  });

  const syncMutation = useMutation({
    mutationFn: adminHappApi.forceSync,
    onSuccess: (data) => {
      setSyncResult(data);
      queryClient.invalidateQueries({ queryKey: ['happ-status'] });
      queryClient.invalidateQueries({ queryKey: ['happ-headers'] });
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: adminHappApi.cleanup,
    onSuccess: (data) => {
      setCleanupResult(data);
      queryClient.invalidateQueries({ queryKey: ['happ-headers'] });
    },
  });

  const assignMutation = useMutation({
    mutationFn: adminHappApi.assignUsers,
    onSuccess: (data) => {
      setAssignResult(data);
      queryClient.invalidateQueries({ queryKey: ['happ-squads'] });
    },
  });

  return (
    <div className="space-y-4">
      {/* Sync status */}
      <div className="rounded-xl border border-dark-700/50 bg-dark-800/40 p-4">
        <div className="flex items-center gap-2">
          <div
            className={`h-2.5 w-2.5 rounded-full ${
              status?.remnawave_sync_enabled ? 'bg-success-400' : 'bg-dark-600'
            }`}
          />
          <span className="text-sm text-dark-200">
            Синхронизация с Remnawave: {status?.remnawave_sync_enabled ? 'включена' : 'выключена'}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid gap-3 sm:grid-cols-3">
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="flex items-center justify-center gap-2 rounded-xl border border-dark-700/50 bg-dark-800/40 px-4 py-3 text-sm font-medium text-dark-100 transition-colors hover:border-dark-600 disabled:opacity-50"
        >
          {syncMutation.isPending ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
          ) : (
            <span>Синхронизировать</span>
          )}
        </button>
        <button
          onClick={() => cleanupMutation.mutate()}
          disabled={cleanupMutation.isPending}
          className="flex items-center justify-center gap-2 rounded-xl border border-dark-700/50 bg-dark-800/40 px-4 py-3 text-sm font-medium text-dark-100 transition-colors hover:border-dark-600 disabled:opacity-50"
        >
          {cleanupMutation.isPending ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
          ) : (
            <span>Очистить заголовки</span>
          )}
        </button>
        <button
          onClick={() => assignMutation.mutate()}
          disabled={assignMutation.isPending}
          className="flex items-center justify-center gap-2 rounded-xl border border-dark-700/50 bg-dark-800/40 px-4 py-3 text-sm font-medium text-dark-100 transition-colors hover:border-dark-600 disabled:opacity-50"
        >
          {assignMutation.isPending ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
          ) : (
            <span>Назначить пользователей</span>
          )}
        </button>
      </div>

      {/* Results */}
      {syncResult && (
        <div className="rounded-xl border border-dark-700/50 bg-dark-800/40 p-4">
          <h4 className="mb-2 text-sm font-medium text-dark-200">Результат синхронизации</h4>
          <div className="space-y-1 text-xs text-dark-400">
            <p>
              Статус:{' '}
              <span className={syncResult.ok ? 'text-success-400' : 'text-error-400'}>
                {syncResult.ok ? 'OK' : 'Ошибка'}
              </span>
            </p>
            <p>Всего: {syncResult.total}</p>
            <p>Заголовков: {syncResult.headers_count}</p>
            {syncResult.native_fields.length > 0 && (
              <p>Нативные поля: {syncResult.native_fields.join(', ')}</p>
            )}
          </div>
        </div>
      )}
      {cleanupResult && (
        <div className="rounded-xl border border-dark-700/50 bg-dark-800/40 p-4">
          <p className="text-xs text-dark-400">
            Очистка:{' '}
            <span className={cleanupResult.ok ? 'text-success-400' : 'text-error-400'}>
              {cleanupResult.ok ? 'OK' : 'Ошибка'}
            </span>
            , удалено: {cleanupResult.total}
          </p>
        </div>
      )}
      {assignResult && (
        <div className="rounded-xl border border-dark-700/50 bg-dark-800/40 p-4">
          <p className="text-xs text-dark-400">
            Назначено пользователей:{' '}
            <span className="text-accent-400">{assignResult.assigned}</span>
          </p>
        </div>
      )}

      {/* Headers preview */}
      {headersData && (
        <div className="rounded-xl border border-dark-700/50 bg-dark-800/40 p-4">
          <h4 className="mb-2 text-sm font-medium text-dark-200">Превью заголовков</h4>
          <div className="mb-2 flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                headersData.module_enabled ? 'bg-success-400' : 'bg-dark-600'
              }`}
            />
            <span className="text-xs text-dark-400">
              Модуль {headersData.module_enabled ? 'включен' : 'выключен'}
            </span>
          </div>
          {Object.keys(headersData.custom_response_headers).length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-dark-300">Custom Response Headers:</p>
              <pre className="overflow-x-auto rounded-lg bg-dark-900 p-2 text-xs text-dark-400">
                {JSON.stringify(headersData.custom_response_headers, null, 2)}
              </pre>
            </div>
          )}
          {Object.keys(headersData.native_fields).length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-xs font-medium text-dark-300">Native Fields:</p>
              <pre className="overflow-x-auto rounded-lg bg-dark-900 p-2 text-xs text-dark-400">
                {JSON.stringify(headersData.native_fields, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Squads status */}
      <div className="rounded-xl border border-dark-700/50 bg-dark-800/40 p-4">
        <h4 className="mb-3 text-sm font-medium text-dark-200">Статус сквадов</h4>
        {squadsLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
          </div>
        ) : squadsData?.statuses && squadsData.statuses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-dark-700/50 text-dark-400">
                  <th className="pb-2 pr-4 font-medium">Провайдер</th>
                  <th className="pb-2 pr-4 font-medium">Сквад</th>
                  <th className="pb-2 pr-4 font-medium">Пользователи</th>
                  <th className="pb-2 font-medium">Емкость</th>
                </tr>
              </thead>
              <tbody className="text-dark-300">
                {squadsData.statuses.map((squad) => (
                  <tr key={squad.squad_uuid} className="border-b border-dark-700/30">
                    <td className="py-2 pr-4 font-mono">{squad.provider_id}</td>
                    <td className="py-2 pr-4">{squad.squad_name}</td>
                    <td className="py-2 pr-4">{squad.users_count}</td>
                    <td className="py-2">{squad.capacity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-dark-500">Нет данных о сквадах</p>
        )}
      </div>
    </div>
  );
}

// ============== Sources Tab ==============

function SourcesTab() {
  const queryClient = useQueryClient();

  const { data: sourceData, isLoading: sourceLoading } = useQuery({
    queryKey: ['happ-source-squads'],
    queryFn: adminHappApi.getSourceSquads,
    staleTime: 30000,
  });

  const { data: externalData, isLoading: externalLoading } = useQuery({
    queryKey: ['happ-external-squads'],
    queryFn: adminHappApi.getExternalSquads,
    staleTime: 30000,
  });

  const addMutation = useMutation({
    mutationFn: ({ uuid, name }: { uuid: string; name: string }) =>
      adminHappApi.addSourceSquad(uuid, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['happ-source-squads'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: adminHappApi.removeSourceSquad,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['happ-source-squads'] });
    },
  });

  const clearMutation = useMutation({
    mutationFn: adminHappApi.clearSourceSquads,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['happ-source-squads'] });
    },
  });

  const sourceUuids = useMemo(
    () => new Set(sourceData?.source_squads?.map((s) => s.uuid) ?? []),
    [sourceData],
  );

  const availableExternal = useMemo(
    () => externalData?.squads?.filter((s) => !sourceUuids.has(s.uuid)) ?? [],
    [externalData, sourceUuids],
  );

  return (
    <div className="space-y-4">
      {/* Source squads list */}
      <div className="rounded-xl border border-dark-700/50 bg-dark-800/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-dark-200">Сквады-источники</h3>
          {sourceData?.source_squads && sourceData.source_squads.length > 0 && (
            <button
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
              className="rounded-lg bg-error-500/20 px-3 py-1 text-xs font-medium text-error-400 transition-colors hover:bg-error-500/30 disabled:opacity-50"
            >
              Очистить все
            </button>
          )}
        </div>
        {sourceLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
          </div>
        ) : sourceData?.source_squads && sourceData.source_squads.length > 0 ? (
          <div className="space-y-2">
            {sourceData.source_squads.map((squad) => (
              <div
                key={squad.uuid}
                className="flex items-center justify-between rounded-lg border border-dark-700/30 bg-dark-800/60 px-3 py-2"
              >
                <div>
                  <span className="text-sm text-dark-100">{squad.name}</span>
                  <span className="ml-2 font-mono text-xs text-dark-500">
                    {squad.uuid.slice(0, 8)}...
                  </span>
                </div>
                <button
                  onClick={() => removeMutation.mutate(squad.uuid)}
                  disabled={removeMutation.isPending}
                  className="rounded-lg bg-error-500/20 px-2.5 py-1 text-xs text-error-400 transition-colors hover:bg-error-500/30 disabled:opacity-50"
                >
                  Убрать
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-dark-500">Нет сквадов-источников</p>
        )}
      </div>

      {/* External squads picker */}
      <div className="rounded-xl border border-dark-700/50 bg-dark-800/40 p-4">
        <h3 className="mb-3 text-sm font-medium text-dark-200">Добавить из внешних сквадов</h3>
        {externalLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
          </div>
        ) : availableExternal.length > 0 ? (
          <div className="space-y-2">
            {availableExternal.map((squad) => (
              <div
                key={squad.uuid}
                className="flex items-center justify-between rounded-lg border border-dark-700/30 bg-dark-800/60 px-3 py-2"
              >
                <div>
                  <span className="text-sm text-dark-100">{squad.name}</span>
                  {squad.users_count != null && (
                    <span className="ml-2 text-xs text-dark-500">
                      ({squad.users_count} пользователей)
                    </span>
                  )}
                </div>
                <button
                  onClick={() => addMutation.mutate({ uuid: squad.uuid, name: squad.name })}
                  disabled={addMutation.isPending}
                  className="rounded-lg bg-accent-600 px-3 py-1 text-xs text-white transition-colors hover:bg-accent-500 disabled:opacity-50"
                >
                  Добавить
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-dark-500">Нет доступных внешних сквадов</p>
        )}
      </div>
    </div>
  );
}

// ============== Export/Import Tab ==============

function ExportImportTab() {
  const [importJson, setImportJson] = useState('');
  const [exportJson, setExportJson] = useState('');
  const [importError, setImportError] = useState('');

  const exportMutation = useMutation({
    mutationFn: adminHappApi.exportSettings,
    onSuccess: (data) => {
      setExportJson(JSON.stringify(data, null, 2));
    },
  });

  const importMutation = useMutation({
    mutationFn: adminHappApi.importSettings,
    onSuccess: () => {
      setImportJson('');
      setImportError('');
    },
  });

  const handleImport = useCallback(() => {
    try {
      const parsed = JSON.parse(importJson);
      setImportError('');
      importMutation.mutate(parsed);
    } catch {
      setImportError('Невалидный JSON');
    }
  }, [importJson, importMutation]);

  return (
    <div className="space-y-4">
      {/* Export */}
      <div className="rounded-xl border border-dark-700/50 bg-dark-800/40 p-4">
        <h3 className="mb-3 text-sm font-medium text-dark-200">Экспорт настроек</h3>
        <button
          onClick={() => exportMutation.mutate()}
          disabled={exportMutation.isPending}
          className="rounded-lg bg-accent-600 px-4 py-2 text-sm text-white transition-colors hover:bg-accent-500 disabled:opacity-50"
        >
          {exportMutation.isPending ? 'Экспорт...' : 'Экспортировать'}
        </button>
        {exportJson && (
          <div className="mt-3">
            <textarea
              readOnly
              value={exportJson}
              className="h-48 w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 font-mono text-xs text-dark-300 focus:outline-none"
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
            <button
              onClick={() => navigator.clipboard.writeText(exportJson)}
              className="mt-2 rounded-lg bg-dark-700 px-3 py-1.5 text-xs text-dark-300 transition-colors hover:bg-dark-600"
            >
              Скопировать
            </button>
          </div>
        )}
      </div>

      {/* Import */}
      <div className="rounded-xl border border-dark-700/50 bg-dark-800/40 p-4">
        <h3 className="mb-3 text-sm font-medium text-dark-200">Импорт настроек</h3>
        <textarea
          value={importJson}
          onChange={(e) => {
            setImportJson(e.target.value);
            setImportError('');
          }}
          placeholder="Вставьте JSON сюда..."
          className="h-48 w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 font-mono text-xs text-dark-100 placeholder-dark-500 focus:border-accent-500 focus:outline-none"
        />
        {importError && <p className="mt-1 text-xs text-error-400">{importError}</p>}
        {importMutation.isSuccess && (
          <p className="mt-1 text-xs text-success-400">Импорт завершен успешно</p>
        )}
        <button
          onClick={handleImport}
          disabled={importMutation.isPending || importJson.trim().length === 0}
          className="mt-3 rounded-lg bg-accent-600 px-4 py-2 text-sm text-white transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {importMutation.isPending ? 'Импорт...' : 'Импортировать'}
        </button>
      </div>
    </div>
  );
}

// ============== Guide Tab ==============

function GuideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dark-700/50 bg-dark-800/40 p-4">
      <h3 className="mb-3 text-base font-semibold text-dark-100">{title}</h3>
      {children}
    </div>
  );
}

function GuidePill({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="rounded-lg border border-dark-700/30 bg-dark-800/60 p-3">
      <p className="text-sm font-medium text-accent-400">{label}</p>
      <p className="mt-0.5 text-xs text-dark-400">{desc}</p>
    </div>
  );
}

function GuideTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <tbody className="divide-y divide-dark-700/30">
          {rows.map(([key, val]) => (
            <tr key={key}>
              <td className="whitespace-nowrap py-2 pr-4 font-medium text-dark-300">{key}</td>
              <td className="py-2 text-dark-400">{val}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GuideTab() {
  return (
    <div className="space-y-4">
      {/* Intro */}
      <div className="rounded-xl border border-accent-500/30 bg-accent-500/5 p-4">
        <p className="text-sm text-dark-200">
          <span className="font-semibold text-accent-400">Happ App Management</span> — модуль
          настройки VPN-приложения Happ через HTTP-заголовки подписки. Все параметры применяются без
          перезапуска бота и автоматически передаются клиентам при обновлении подписки.
        </p>
      </div>

      {/* Quick Start */}
      <GuideSection title="⚡ Быстрый старт">
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-dark-300">Без Provider ID (минимум):</p>
            <ol className="ml-1 list-inside list-decimal space-y-1 text-xs text-dark-400">
              <li>Настройки → ⚙️ Модуль → «Модуль включён» ✅</li>
              <li>Настройки → 🔄 Обновление → «Автообновление» ✅</li>
              <li>Настройки → 🔔 Уведомления → «Баннер истечения» + «Push за 3 дня» ✅</li>
              <li>Готово — заголовки добавляются к новым ссылкам подписок</li>
            </ol>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-dark-300">
              С Provider ID (полная настройка):
            </p>
            <ol className="ml-1 list-inside list-decimal space-y-1 text-xs text-dark-400">
              <li>
                Зарегистрируйтесь на happ-proxy.com (или используйте авторегистрацию из
                Telegram-бота)
              </li>
              <li>Настройки → 🔑 Провайдер → заполните Provider ID и домен подписки</li>
              <li>Привяжите домен подписки в кабинете happ-proxy.com</li>
              <li>Настройки → ⚙️ Модуль → «Синхронизация с Remnawave» ✅</li>
              <li>Синхронизация → нажмите «Синхронизировать»</li>
            </ol>
          </div>
        </div>
      </GuideSection>

      {/* Categories */}
      <GuideSection title="⚙️ Категории настроек">
        <div className="grid gap-2 sm:grid-cols-2">
          <GuidePill
            label="⚙️ Модуль"
            desc="Включить/выключить модуль и синхронизацию с Remnawave"
          />
          <GuidePill
            label="🔑 Провайдер"
            desc="Provider ID, домен, API-ключ капчи, метод авторегистрации"
          />
          <GuidePill
            label="🔐 Безопасность"
            desc="Скрытие IP серверов, неотключаемый HWID, запрет сворачивания"
          />
          <GuidePill label="🔔 Уведомления" desc="Баннер и Push за 3 дня до истечения подписки" />
          <GuidePill
            label="🎨 Внешний вид"
            desc="Объявления, инфо-баннер, описание серверов, iOS-тема"
          />
          <GuidePill label="🔄 Обновление" desc="Автообновление списка серверов и интервал" />
          <GuidePill label="📱 Поведение" desc="Автоподключение, пинг серверов и отображение" />
          <GuidePill
            label="🛡 Обход блокировок"
            desc="Фрагментация (DPI), шум, подмена User-Agent"
          />
          <GuidePill
            label="🌐 Сеть"
            desc="Мультиплексирование (Mux) для ускорения открытия сайтов"
          />
        </div>
      </GuideSection>

      {/* Settings reference */}
      <GuideSection title="📋 Справочник по параметрам">
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-dark-200">
              ⚙️ Модуль
            </p>
            <GuideTable
              rows={[
                [
                  'Модуль включён',
                  'Добавляет Happ-заголовки к подпискам. Выключите для диагностики если подписка не обновляется в Happ.',
                ],
                [
                  'Синхронизация с Remnawave',
                  'Прописывает заголовки в Remnawave API — старые ссылки подписок начнут работать без перевыпуска. Включайте всегда при использовании Remnawave.',
                ],
              ]}
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-dark-200">
              🔑 Провайдер
            </p>
            <GuideTable
              rows={[
                [
                  'Provider ID',
                  '8-символьный ID с happ-proxy.com. Обязателен для расширенных параметров и ограничения устройств. Привяжите домен подписки на happ-proxy.com после установки.',
                ],
                [
                  'Домен подписки',
                  'Домен, через который клиенты получают подписки (например mydomain.com). Нужен для авторегистрации.',
                ],
                [
                  'Забирать из чужих сквадов',
                  'При синхронизации перетягивает пользователей из чужих сквадов. Если задан список источников — только из них; если пуст — из всех (осторожно!).',
                ],
                [
                  'API-ключ капчи',
                  'Ключ rucaptcha.com или 2captcha.com. Только для HTTP-метода авторегистрации (~$2–3 за 1000 регистраций).',
                ],
                [
                  'Метод авторегистрации',
                  'auto — выберет лучший; nodriver — бесплатный через Chrome+Xvfb; http — быстрый через капчу.',
                ],
              ]}
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-dark-200">
              🔐 Безопасность
            </p>
            <GuideTable
              rows={[
                [
                  'Скрыть настройки серверов',
                  'Клиент не видит IP, порты и протоколы серверов. Рекомендуется включить.',
                ],
                [
                  'Неотключаемый HWID',
                  'Клиент не может отключить передачу отпечатка устройства. Включайте при ограничении устройств на подписку.',
                ],
                [
                  'Запретить сворачивание',
                  'Подписка всегда развёрнута в приложении, нельзя скрыть.',
                ],
              ]}
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-dark-200">
              🔔 Уведомления
            </p>
            <GuideTable
              rows={[
                [
                  'Баннер «Подписка заканчивается»',
                  'Баннер в Happ за 3 дня до конца подписки. Рекомендуется включить.',
                ],
                [
                  'Ссылка кнопки «Продлить»',
                  'URL кнопки в баннере истечения (например ссылка на бота). Пусто = кнопки нет.',
                ],
                [
                  'Push за 3 дня до истечения',
                  'Push-уведомление 1 раз в день, 3 дня подряд. Рекомендуется включить.',
                ],
              ]}
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-dark-200">
              🎨 Внешний вид
            </p>
            <GuideTable
              rows={[
                [
                  'Текст объявления',
                  'Текст в красной рамке внутри подписки (до 200 символов). Поддерживает эмодзи.',
                ],
                [
                  'Начало/Конец показа',
                  'Временной интервал показа объявления (ЧЧ:ММ). Оба пустых = всегда.',
                ],
                ['Показать один раз', 'Объявление появится один раз и автоматически исчезнет.'],
                [
                  'Текст/Цвет инфо-баннера',
                  'Произвольный баннер в приложении (до 200 символов). Цвет: red/blue/green.',
                ],
                ['Текст/Ссылка кнопки баннера', 'Кнопка в инфо-баннере. Пусто — кнопки нет.'],
                ['Описание сервера', 'Текст под названием сервера (до 30 символов).'],
                [
                  'Тема оформления (iOS)',
                  'Только iOS. Экспортируйте JSON из Happ → Настройки → удержите «Тема оформления». Невалидный JSON ломает подписку — будьте осторожны.',
                ],
              ]}
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-dark-200">
              🔄 Обновление
            </p>
            <GuideTable
              rows={[
                [
                  'Автообновление подписки',
                  'Happ обновляет список серверов по расписанию. Рекомендуется включить.',
                ],
                [
                  'Интервал обновления (часы)',
                  'Как часто обновляется список (1–24 ч). По умолчанию: 3.',
                ],
                [
                  'Обновлять при открытии',
                  'Все подписки обновляются при каждом открытии приложения. Решает «открыл — серверов нет».',
                ],
              ]}
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-dark-200">
              📱 Поведение
            </p>
            <GuideTable
              rows={[
                ['Автоподключение', 'При запуске приложение само подключается к серверу.'],
                [
                  'Режим автоподключения',
                  'lastused = последний сервер; lowestdelay = с минимальным пингом.',
                ],
                [
                  'Пинг при открытии',
                  'Автоматически тестирует все серверы при открытии приложения.',
                ],
                [
                  'Тип пинга',
                  'proxy = через VPN (точнее); tcp = TCP; icmp = ICMP. Пусто = по умолчанию.',
                ],
                ['Отображение пинга', 'time = мс; icon = цветная иконка. Пусто = по умолчанию.'],
              ]}
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-dark-200">
              🛡 Обход блокировок
            </p>
            <div className="mb-2 rounded-lg bg-warning-500/10 px-3 py-2 text-xs text-warning-400">
              ⚠️ Включайте только если провайдер блокирует VPN-трафик. Влияет на сетевое поведение.
            </div>
            <GuideTable
              rows={[
                [
                  'Фрагментация (обход DPI)',
                  'Разбивает пакеты на части — провайдер не распознаёт VPN. Рекомендуемые настройки: пакеты=tlshello, размер=50-100, задержка=5.',
                ],
                [
                  'Шум (маскировка VPN)',
                  'Добавляет мусорный трафик для маскировки. Используйте вместе с фрагментацией.',
                ],
                [
                  'Подмена User-Agent',
                  'Happ притворяется браузером при запросе подписки. Пусто = стандартный Happ/1.0.',
                ],
              ]}
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-dark-200">
              🌐 Сеть
            </p>
            <div className="mb-2 rounded-lg bg-warning-500/10 px-3 py-2 text-xs text-warning-400">
              ⚠️ Включайте только если клиенты жалуются на медленное открытие сайтов. Может
              замедлить скачивание.
            </div>
            <GuideTable
              rows={[
                [
                  'Мультиплексирование (Mux)',
                  'Несколько соединений через один канал. Ускоряет открытие страниц.',
                ],
                ['TCP/xUDP-соединений', 'Число соединений (рекомендуется 8 для обоих).'],
                ['Mux: QUIC-трафик', 'skip = QUIC идёт без Mux. Пусто = по умолчанию.'],
              ]}
            />
          </div>
        </div>
      </GuideSection>

      {/* Tabs guide */}
      <GuideSection title="🗂 Разделы этой страницы">
        <GuideTable
          rows={[
            [
              'Настройки',
              'Все параметры модуля сгруппированы по категориям. Переключатели сохраняются мгновенно.',
            ],
            [
              'Провайдеры',
              'Список Provider ID. Добавление и удаление. Каждый Provider ID поддерживает до 100 устройств.',
            ],
            [
              'Синхронизация',
              'Ручная синхронизация заголовков с Remnawave, очистка, назначение пользователей по сквадам. Превью заголовков и статус сквадов.',
            ],
            [
              'Источники',
              'Сквады-источники для перетягивания пользователей. Если список пуст + «Забирать из чужих сквадов» включено — перетягивание из ВСЕХ сквадов.',
            ],
            [
              'Экспорт/Импорт',
              'Резервная копия всех настроек в JSON. Импорт полностью заменяет текущую конфигурацию.',
            ],
          ]}
        />
      </GuideSection>

      {/* Troubleshooting */}
      <GuideSection title="🔧 Диагностика">
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs font-medium text-dark-300">
              Подписка в Happ не обновляется:
            </p>
            <ol className="ml-1 list-inside list-decimal space-y-1 text-xs text-dark-400">
              <li>Настройки → ⚙️ Модуль → «Модуль включён» = ✅</li>
              <li>
                Попробуйте выключить модуль → если заработало, проблема в заголовках или Provider ID
              </li>
              <li>Проверьте Provider ID и привязку домена на happ-proxy.com</li>
            </ol>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-dark-300">
              Заголовки не применяются через Remnawave:
            </p>
            <ol className="ml-1 list-inside list-decimal space-y-1 text-xs text-dark-400">
              <li>Настройки → ⚙️ Модуль → «Синхронизация с Remnawave» = ✅</li>
              <li>Синхронизация → нажмите «Синхронизировать»</li>
            </ol>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-dark-300">
              Тема оформления (iOS) не применяется:
            </p>
            <ol className="ml-1 list-inside list-decimal space-y-1 text-xs text-dark-400">
              <li>Работает только на iOS — на Android не применяется</li>
              <li>Проверьте валидность JSON (jsonlint.com)</li>
              <li>Пользователь должен обновить подписку в приложении</li>
            </ol>
          </div>
        </div>
      </GuideSection>
    </div>
  );
}

// ============== Main Component ==============

export default function AdminHappManagement() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('settings');

  const { data: status } = useQuery({
    queryKey: ['happ-status'],
    queryFn: adminHappApi.getStatus,
    staleTime: 30000,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin')}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-dark-700 bg-dark-800 transition-colors hover:border-dark-600"
        >
          <svg
            className="h-5 w-5 text-dark-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-dark-50">Happ Management</h1>
      </div>

      {/* Status bar */}
      {status && (
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              status.module_enabled
                ? 'bg-success-500/20 text-success-400'
                : 'bg-dark-700 text-dark-400'
            }`}
          >
            {status.module_enabled ? 'Модуль включен' : 'Модуль выключен'}
          </span>
          <span className="rounded-full bg-dark-700 px-3 py-1 text-xs text-dark-300">
            Провайдеров: {status.providers_count}
          </span>
          {status.active_features.map((feature) => (
            <span
              key={feature}
              className="rounded-full bg-accent-500/20 px-3 py-1 text-xs text-accent-400"
            >
              {feature}
            </span>
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto border-b border-dark-700/50">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-accent-500 text-accent-400'
                : 'border-transparent text-dark-400 hover:text-dark-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'settings' && <SettingsTab />}
      {activeTab === 'providers' && <ProvidersTab />}
      {activeTab === 'sync' && <SyncTab />}
      {activeTab === 'sources' && <SourcesTab />}
      {activeTab === 'export' && <ExportImportTab />}
      {activeTab === 'guide' && <GuideTab />}
    </div>
  );
}
