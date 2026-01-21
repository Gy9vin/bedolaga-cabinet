import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { SettingDefinition, adminSettingsApi } from '../../api/adminSettings'
import { ChevronDownIcon } from './icons'
import { SettingRow } from './SettingRow'

interface CategoryGroup {
  key: string
  label: string
  settings: SettingDefinition[]
}

interface SettingsTabProps {
  categories: CategoryGroup[]
  searchQuery: string
  filteredSettings: SettingDefinition[]
  isFavorite: (key: string) => boolean
  toggleFavorite: (key: string) => void
}

export function SettingsTab({
  categories,
  searchQuery,
  filteredSettings,
  isFavorite,
  toggleFavorite
}: SettingsTabProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

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

  // If searching, show flat list
  if (searchQuery) {
    return (
      <div className="space-y-4">
        {filteredSettings.length === 0 ? (
          <div className="p-12 rounded-2xl bg-dark-800/30 border border-dark-700/30 text-center">
            <p className="text-dark-400">{t('admin.settings.noSettings')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredSettings.map((setting) => (
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
        )}
      </div>
    )
  }

  // Show accordion for subcategories
  return (
    <div className="space-y-3">
      {categories.map((cat) => {
        const isExpanded = expandedSections.has(cat.key)
        return (
          <div
            key={cat.key}
            className="rounded-2xl bg-dark-800/30 border border-dark-700/30 overflow-hidden"
          >
            {/* Accordion header */}
            <button
              onClick={() => toggleSection(cat.key)}
              className="w-full flex items-center justify-between p-4 hover:bg-dark-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-dark-100">{cat.label}</span>
                <span className="px-2 py-0.5 text-xs rounded-full bg-dark-700 text-dark-400">
                  {cat.settings.length}
                </span>
              </div>
              <div className={`transition-transform duration-200 text-dark-400 ${isExpanded ? 'rotate-180' : ''}`}>
                <ChevronDownIcon />
              </div>
            </button>

            {/* Accordion content */}
            {isExpanded && (
              <div className="p-4 pt-0 border-t border-dark-700/30">
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 pt-4">
                  {cat.settings.map((setting) => (
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
              </div>
            )}
          </div>
        )
      })}

      {categories.length === 0 && (
        <div className="p-12 rounded-2xl bg-dark-800/30 border border-dark-700/30 text-center">
          <p className="text-dark-400">{t('admin.settings.noSettings')}</p>
        </div>
      )}
    </div>
  )
}
