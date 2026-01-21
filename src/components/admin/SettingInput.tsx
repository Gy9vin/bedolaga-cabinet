import { useState } from 'react'
import { SettingDefinition } from '../../api/adminSettings'
import { CheckIcon, CloseIcon } from './icons'

interface SettingInputProps {
  setting: SettingDefinition
  onUpdate: (value: string) => void
  disabled?: boolean
}

export function SettingInput({ setting, onUpdate, disabled }: SettingInputProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState('')

  const handleStart = () => {
    setValue(String(setting.current ?? ''))
    setIsEditing(true)
  }

  const handleSave = () => {
    onUpdate(value)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setValue('')
  }

  // Dropdown for choices
  if (setting.choices && setting.choices.length > 0) {
    return (
      <select
        value={String(setting.current ?? '')}
        onChange={(e) => onUpdate(e.target.value)}
        disabled={disabled}
        className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-1.5 text-sm text-dark-100 focus:outline-none focus:border-accent-500 disabled:opacity-50"
      >
        {setting.choices.map((choice, idx) => (
          <option key={idx} value={String(choice.value)}>
            {choice.label}
          </option>
        ))}
      </select>
    )
  }

  // Editing mode
  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type={setting.type === 'int' || setting.type === 'float' ? 'number' : 'text'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') handleCancel()
          }}
          autoFocus
          className="bg-dark-700 border border-accent-500 rounded-lg px-3 py-1.5 text-sm text-dark-100 focus:outline-none w-32"
        />
        <button
          onClick={handleSave}
          className="p-1.5 rounded-lg bg-accent-500 text-white hover:bg-accent-600 transition-colors"
        >
          <CheckIcon />
        </button>
        <button
          onClick={handleCancel}
          className="p-1.5 rounded-lg bg-dark-600 text-dark-300 hover:bg-dark-500 transition-colors"
        >
          <CloseIcon />
        </button>
      </div>
    )
  }

  // Display mode
  return (
    <button
      onClick={handleStart}
      disabled={disabled}
      className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-1.5 text-sm text-dark-200 hover:border-dark-500 transition-colors disabled:opacity-50 min-w-[80px] text-left font-mono truncate max-w-[150px]"
    >
      {String(setting.current ?? '-')}
    </button>
  )
}
