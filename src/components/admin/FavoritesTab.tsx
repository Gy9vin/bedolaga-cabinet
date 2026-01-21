import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { SettingDefinition, adminSettingsApi } from '../../api/adminSettings'
import { StarIcon } from './icons'
import { SettingRow } from './SettingRow'

interface FavoritesTabProps {
  settings: SettingDefinition[]
  isFavorite: (key: string) => boolean
  toggleFavorite: (key: string) => void
}

export function FavoritesTab({ settings, isFavorite, toggleFavorite }: FavoritesTabProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const updateSettingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => adminSettingsApi.updateSetting(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
    },
  })

  const resetSettingMutation = useMutation({
    mutationFn: (key: string) => adminSettingsApi.resetSetting(key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
    },
  })

  if (settings.length === 0) {
    return (
      <div className="p-12 rounded-2xl bg-dark-800/30 border border-dark-700/30 text-center">
        <div className="flex justify-center mb-4 text-dark-500">
          <StarIcon filled={false} />
        </div>
        <p className="text-dark-400">{t('admin.settings.favoritesEmpty')}</p>
        <p className="text-dark-500 text-sm mt-1">{t('admin.settings.favoritesHint')}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
      {settings.map((setting) => (
        <SettingRow
          key={setting.key}
          setting={setting}
          isFavorite={isFavorite(setting.key)}
          onToggleFavorite={() => toggleFavorite(setting.key)}
          onUpdate={(value) => updateSettingMutation.mutate({ key: setting.key, value })}
          onReset={() => resetSettingMutation.mutate(setting.key)}
          isUpdating={updateSettingMutation.isPending}
          isResetting={resetSettingMutation.isPending}
        />
      ))}
    </div>
  )
}
