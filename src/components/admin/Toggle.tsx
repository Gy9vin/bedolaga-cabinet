interface ToggleProps {
  checked: boolean
  onChange: () => void
  disabled?: boolean
}

export function Toggle({ checked, onChange, disabled }: ToggleProps) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative w-12 h-6 rounded-full transition-colors ${
        checked ? 'bg-accent-500' : 'bg-dark-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
        checked ? 'left-7' : 'left-1'
      }`} />
    </button>
  )
}
