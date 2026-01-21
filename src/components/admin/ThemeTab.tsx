import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { themeColorsApi } from '../../api/themeColors'
import { DEFAULT_THEME_COLORS } from '../../types/theme'
import { ColorPicker } from '../ColorPicker'
import { applyThemeColors } from '../../hooks/useThemeColors'
import { updateEnabledThemesCache } from '../../hooks/useTheme'
import { MoonIcon, SunIcon, ChevronDownIcon } from './icons'
import { Toggle } from './Toggle'
import { THEME_PRESETS } from './constants'

export function ThemeTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['presets']))

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  // Queries
  const { data: themeColors } = useQuery({
    queryKey: ['theme-colors'],
    queryFn: themeColorsApi.getColors,
  })

  const { data: enabledThemes } = useQuery({
    queryKey: ['enabled-themes'],
    queryFn: themeColorsApi.getEnabledThemes,
  })

  // Mutations
  const updateColorsMutation = useMutation({
    mutationFn: themeColorsApi.updateColors,
    onSuccess: (data) => {
      applyThemeColors(data)
      queryClient.invalidateQueries({ queryKey: ['theme-colors'] })
    },
  })

  const resetColorsMutation = useMutation({
    mutationFn: themeColorsApi.resetColors,
    onSuccess: (data) => {
      applyThemeColors(data)
      queryClient.invalidateQueries({ queryKey: ['theme-colors'] })
    },
  })

  const updateEnabledThemesMutation = useMutation({
    mutationFn: themeColorsApi.updateEnabledThemes,
    onSuccess: (data) => {
      updateEnabledThemesCache(data)
      queryClient.invalidateQueries({ queryKey: ['enabled-themes'] })
    },
  })

  return (
    <div className="space-y-6">
      {/* Theme toggles */}
      <div className="p-6 rounded-2xl bg-dark-800/50 border border-dark-700/50">
        <h3 className="text-lg font-semibold text-dark-100 mb-4">{t('admin.settings.availableThemes')}</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-dark-700/30">
            <div className="flex items-center gap-3">
              <MoonIcon />
              <span className="font-medium text-dark-200">{t('admin.settings.darkTheme')}</span>
            </div>
            <Toggle
              checked={enabledThemes?.dark ?? true}
              onChange={() => {
                if ((enabledThemes?.dark ?? true) && !(enabledThemes?.light ?? true)) return
                updateEnabledThemesMutation.mutate({ dark: !(enabledThemes?.dark ?? true) })
              }}
              disabled={updateEnabledThemesMutation.isPending}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-dark-700/30">
            <div className="flex items-center gap-3">
              <SunIcon />
              <span className="font-medium text-dark-200">{t('admin.settings.lightTheme')}</span>
            </div>
            <Toggle
              checked={enabledThemes?.light ?? true}
              onChange={() => {
                if ((enabledThemes?.light ?? true) && !(enabledThemes?.dark ?? true)) return
                updateEnabledThemesMutation.mutate({ light: !(enabledThemes?.light ?? true) })
              }}
              disabled={updateEnabledThemesMutation.isPending}
            />
          </div>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="p-6 rounded-2xl bg-dark-800/50 border border-dark-700/50">
        <button
          onClick={() => toggleSection('presets')}
          className="w-full flex items-center justify-between"
        >
          <h3 className="text-lg font-semibold text-dark-100">{t('admin.settings.quickPresets')}</h3>
          <div className={`transition-transform ${expandedSections.has('presets') ? 'rotate-180' : ''}`}>
            <ChevronDownIcon />
          </div>
        </button>

        {expandedSections.has('presets') && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => updateColorsMutation.mutate(preset.colors)}
                disabled={updateColorsMutation.isPending}
                className="p-3 rounded-xl border border-dark-600 hover:border-dark-500 transition-all hover:scale-[1.02]"
                style={{ backgroundColor: preset.colors.darkBackground }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-4 h-4 rounded-full ring-2 ring-white/20"
                    style={{ backgroundColor: preset.colors.accent }}
                  />
                  <span className="text-xs font-medium" style={{ color: preset.colors.darkText }}>
                    {t(`admin.settings.presets.${preset.id}`)}
                  </span>
                </div>
                <div className="flex gap-1">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: preset.colors.success }} />
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: preset.colors.warning }} />
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: preset.colors.error }} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Custom Colors */}
      <div className="p-6 rounded-2xl bg-dark-800/50 border border-dark-700/50">
        <button
          onClick={() => toggleSection('colors')}
          className="w-full flex items-center justify-between"
        >
          <h3 className="text-lg font-semibold text-dark-100">{t('admin.settings.customColors')}</h3>
          <div className={`transition-transform ${expandedSections.has('colors') ? 'rotate-180' : ''}`}>
            <ChevronDownIcon />
          </div>
        </button>

        {expandedSections.has('colors') && (
          <div className="mt-4 space-y-6">
            {/* Accent */}
            <div>
              <h4 className="text-sm font-medium text-dark-300 mb-3">{t('admin.settings.accentColor')}</h4>
              <ColorPicker
                label={t('theme.accent')}
                value={themeColors?.accent || DEFAULT_THEME_COLORS.accent}
                onChange={(color) => updateColorsMutation.mutate({ accent: color })}
                disabled={updateColorsMutation.isPending}
              />
            </div>

            {/* Dark theme */}
            <div>
              <h4 className="text-sm font-medium text-dark-300 mb-3 flex items-center gap-2">
                <MoonIcon /> {t('admin.settings.darkTheme')}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ColorPicker
                  label={t('admin.settings.colors.background')}
                  value={themeColors?.darkBackground || DEFAULT_THEME_COLORS.darkBackground}
                  onChange={(color) => updateColorsMutation.mutate({ darkBackground: color })}
                  disabled={updateColorsMutation.isPending}
                />
                <ColorPicker
                  label={t('admin.settings.colors.surface')}
                  value={themeColors?.darkSurface || DEFAULT_THEME_COLORS.darkSurface}
                  onChange={(color) => updateColorsMutation.mutate({ darkSurface: color })}
                  disabled={updateColorsMutation.isPending}
                />
                <ColorPicker
                  label={t('admin.settings.colors.text')}
                  value={themeColors?.darkText || DEFAULT_THEME_COLORS.darkText}
                  onChange={(color) => updateColorsMutation.mutate({ darkText: color })}
                  disabled={updateColorsMutation.isPending}
                />
                <ColorPicker
                  label={t('admin.settings.colors.textSecondary')}
                  value={themeColors?.darkTextSecondary || DEFAULT_THEME_COLORS.darkTextSecondary}
                  onChange={(color) => updateColorsMutation.mutate({ darkTextSecondary: color })}
                  disabled={updateColorsMutation.isPending}
                />
              </div>
            </div>

            {/* Light theme */}
            <div>
              <h4 className="text-sm font-medium text-dark-300 mb-3 flex items-center gap-2">
                <SunIcon /> {t('admin.settings.lightTheme')}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ColorPicker
                  label={t('admin.settings.colors.background')}
                  value={themeColors?.lightBackground || DEFAULT_THEME_COLORS.lightBackground}
                  onChange={(color) => updateColorsMutation.mutate({ lightBackground: color })}
                  disabled={updateColorsMutation.isPending}
                />
                <ColorPicker
                  label={t('admin.settings.colors.surface')}
                  value={themeColors?.lightSurface || DEFAULT_THEME_COLORS.lightSurface}
                  onChange={(color) => updateColorsMutation.mutate({ lightSurface: color })}
                  disabled={updateColorsMutation.isPending}
                />
                <ColorPicker
                  label={t('admin.settings.colors.text')}
                  value={themeColors?.lightText || DEFAULT_THEME_COLORS.lightText}
                  onChange={(color) => updateColorsMutation.mutate({ lightText: color })}
                  disabled={updateColorsMutation.isPending}
                />
                <ColorPicker
                  label={t('admin.settings.colors.textSecondary')}
                  value={themeColors?.lightTextSecondary || DEFAULT_THEME_COLORS.lightTextSecondary}
                  onChange={(color) => updateColorsMutation.mutate({ lightTextSecondary: color })}
                  disabled={updateColorsMutation.isPending}
                />
              </div>
            </div>

            {/* Status colors */}
            <div>
              <h4 className="text-sm font-medium text-dark-300 mb-3">{t('admin.settings.statusColors')}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <ColorPicker
                  label={t('admin.settings.colors.success')}
                  value={themeColors?.success || DEFAULT_THEME_COLORS.success}
                  onChange={(color) => updateColorsMutation.mutate({ success: color })}
                  disabled={updateColorsMutation.isPending}
                />
                <ColorPicker
                  label={t('admin.settings.colors.warning')}
                  value={themeColors?.warning || DEFAULT_THEME_COLORS.warning}
                  onChange={(color) => updateColorsMutation.mutate({ warning: color })}
                  disabled={updateColorsMutation.isPending}
                />
                <ColorPicker
                  label={t('admin.settings.colors.error')}
                  value={themeColors?.error || DEFAULT_THEME_COLORS.error}
                  onChange={(color) => updateColorsMutation.mutate({ error: color })}
                  disabled={updateColorsMutation.isPending}
                />
              </div>
            </div>

            {/* Reset button */}
            <button
              onClick={() => resetColorsMutation.mutate()}
              disabled={resetColorsMutation.isPending}
              className="px-4 py-2 rounded-xl bg-dark-700 text-dark-300 hover:bg-dark-600 transition-colors disabled:opacity-50"
            >
              {t('admin.settings.resetAllColors')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
