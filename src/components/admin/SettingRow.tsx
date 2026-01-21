import { useTranslation } from 'react-i18next'
import { SettingDefinition } from '../../api/adminSettings'
import { StarIcon, LockIcon, RefreshIcon } from './icons'
import { SettingInput } from './SettingInput'
import { Toggle } from './Toggle'
import { formatSettingKey, stripHtml } from './utils'

interface SettingRowProps {
  setting: SettingDefinition
  isFavorite: boolean
  onToggleFavorite: () => void
  onUpdate: (value: string) => void
  onReset: () => void
  isUpdating?: boolean
  isResetting?: boolean
}

export function SettingRow({
  setting,
  isFavorite,
  onToggleFavorite,
  onUpdate,
  onReset,
  isUpdating,
  isResetting
}: SettingRowProps) {
  const { t } = useTranslation()

  const formattedKey = formatSettingKey(setting.name || setting.key)
  const displayName = t(`admin.settings.settingNames.${formattedKey}`, formattedKey)
  const description = setting.hint?.description ? stripHtml(setting.hint.description) : null

  return (
    <div className="group p-4 rounded-xl bg-dark-800/30 border border-dark-700/30 hover:border-dark-600/50 transition-all">
      {/* Top row - name and badge */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-dark-100">{displayName}</span>
            {setting.has_override && (
              <span className="px-1.5 py-0.5 text-xs rounded bg-warning-500/20 text-warning-400">
                {t('admin.settings.modified')}
              </span>
            )}
          </div>
          {description && (
            <p className="text-sm text-dark-400 mt-1 line-clamp-2">{description}</p>
          )}
        </div>

        {/* Favorite button */}
        <button
          onClick={onToggleFavorite}
          className={`p-1.5 rounded-lg transition-all flex-shrink-0 ${
            isFavorite
              ? 'text-warning-400 bg-warning-500/10'
              : 'text-dark-500 hover:text-dark-300 opacity-0 group-hover:opacity-100'
          }`}
        >
          <StarIcon filled={isFavorite} />
        </button>
      </div>

      {/* Bottom row - control */}
      <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-dark-700/30">
        <span className="text-xs text-dark-500 font-mono truncate max-w-[200px]">{setting.key}</span>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Setting control */}
          {setting.read_only ? (
            <div className="flex items-center gap-2 text-dark-400">
              <LockIcon />
              <span className="font-mono text-sm max-w-[150px] truncate">{String(setting.current ?? '-')}</span>
            </div>
          ) : setting.type === 'bool' ? (
            <Toggle
              checked={setting.current === true || setting.current === 'true'}
              onChange={() => onUpdate(setting.current === true || setting.current === 'true' ? 'false' : 'true')}
              disabled={isUpdating}
            />
          ) : (
            <SettingInput
              setting={setting}
              onUpdate={onUpdate}
              disabled={isUpdating}
            />
          )}

          {/* Reset button */}
          {setting.has_override && !setting.read_only && (
            <button
              onClick={onReset}
              disabled={isResetting}
              className="p-1.5 rounded-lg text-dark-400 hover:text-dark-200 hover:bg-dark-700 transition-colors"
              title={t('admin.settings.reset')}
            >
              <RefreshIcon />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
