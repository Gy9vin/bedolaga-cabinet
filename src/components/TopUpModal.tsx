import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { balanceApi } from '../api/balance'
import { useCurrency } from '../hooks/useCurrency'
import { useTelegramWebApp } from '../hooks/useTelegramWebApp'
import { checkRateLimit, getRateLimitResetTime, RATE_LIMIT_KEYS } from '../utils/rateLimit'
import type { PaymentMethod } from '../types'

const TELEGRAM_LINK_REGEX = /^https?:\/\/t\.me\//i
const isTelegramPaymentLink = (url: string): boolean => TELEGRAM_LINK_REGEX.test(url)

const openPaymentLink = (url: string, reservedWindow?: Window | null) => {
  if (typeof window === 'undefined' || !url) return
  const webApp = window.Telegram?.WebApp

  if (isTelegramPaymentLink(url) && webApp?.openTelegramLink) {
    try { webApp.openTelegramLink(url); return } catch (e) { console.warn('[TopUpModal] openTelegramLink failed:', e) }
  }
  if (webApp?.openLink) {
    try { webApp.openLink(url, { try_instant_view: false, try_browser: true }); return } catch (e) { console.warn('[TopUpModal] webApp.openLink failed:', e) }
  }
  if (reservedWindow && !reservedWindow.closed) {
    try { reservedWindow.location.href = url; reservedWindow.focus?.() } catch (e) { console.warn('[TopUpModal] Failed to use reserved window:', e) }
    return
  }
  const w2 = window.open(url, '_blank', 'noopener,noreferrer')
  if (w2) { w2.opener = null; return }
  window.location.href = url
}

// Icons
const CloseIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const WalletIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
  </svg>
)

interface TopUpModalProps {
  method: PaymentMethod
  onClose: () => void
  initialAmountRubles?: number
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < 768
  })
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

export default function TopUpModal({ method, onClose, initialAmountRubles }: TopUpModalProps) {
  const { t } = useTranslation()
  const { formatAmount, currencySymbol, convertAmount, convertToRub, targetCurrency } = useCurrency()
  const { isTelegramWebApp, safeAreaInset, contentSafeAreaInset, webApp } = useTelegramWebApp()
  const inputRef = useRef<HTMLInputElement>(null)
  const isMobileScreen = useIsMobile()

  const safeBottom = isTelegramWebApp ? Math.max(safeAreaInset.bottom, contentSafeAreaInset.bottom) : 0

  const getInitialAmount = (): string => {
    if (!initialAmountRubles || initialAmountRubles <= 0) return ''
    const converted = convertAmount(initialAmountRubles)
    return (targetCurrency === 'IRR' || targetCurrency === 'RUB')
      ? Math.ceil(converted).toString()
      : converted.toFixed(2)
  }

  const [amount, setAmount] = useState(getInitialAmount)
  const [error, setError] = useState<string | null>(null)
  const [selectedOption, setSelectedOption] = useState<string | null>(
    method.options && method.options.length > 0 ? method.options[0].id : null
  )
  const popupRef = useRef<Window | null>(null)

  // Handle close with memoization
  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  // Keyboard support (Escape to close) - PC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleClose])

  // Telegram back button support - Android
  useEffect(() => {
    if (!webApp) return

    // Show back button in Telegram
    if (webApp.BackButton) {
      webApp.BackButton.show()
      webApp.BackButton.onClick(handleClose)
    }

    return () => {
      if (webApp.BackButton) {
        webApp.BackButton.offClick(handleClose)
        webApp.BackButton.hide()
      }
    }
  }, [webApp, handleClose])

  // Scroll lock - iOS/Android rubber band prevention
  useEffect(() => {
    const scrollY = window.scrollY
    const preventScroll = (e: TouchEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('[data-modal-content]')) return
      e.preventDefault()
    }
    const preventWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('[data-modal-content]')) return
      e.preventDefault()
    }
    document.addEventListener('touchmove', preventScroll, { passive: false })
    document.addEventListener('wheel', preventWheel, { passive: false })
    document.body.style.overflow = 'hidden'
    // iOS specific - prevent body scroll
    document.body.style.position = 'fixed'
    document.body.style.width = '100%'
    document.body.style.top = `-${scrollY}px`

    return () => {
      document.removeEventListener('touchmove', preventScroll)
      document.removeEventListener('wheel', preventWheel)
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.top = ''
      window.scrollTo(0, scrollY)
    }
  }, [])

  const hasOptions = method.options && method.options.length > 0
  const minRubles = method.min_amount_kopeks / 100
  const maxRubles = method.max_amount_kopeks / 100
  const methodKey = method.id.toLowerCase().replace(/-/g, '_')
  const isStarsMethod = methodKey.includes('stars')
  const methodName = t(`balance.paymentMethods.${methodKey}.name`, { defaultValue: '' }) || method.name
  const isTelegramMiniApp = typeof window !== 'undefined' && Boolean(window.Telegram?.WebApp?.initData)

  const starsPaymentMutation = useMutation({
    mutationFn: (amountKopeks: number) => balanceApi.createStarsInvoice(amountKopeks),
    onSuccess: (data) => {
      const webApp = window.Telegram?.WebApp
      if (!data.invoice_url) { setError('Сервер не вернул ссылку на оплату'); return }
      if (!webApp?.openInvoice) { setError('Оплата Stars доступна только в Telegram Mini App'); return }
      try {
        webApp.openInvoice(data.invoice_url, (status) => {
          if (status === 'paid') { setError(null); handleClose() }
          else if (status === 'failed') { setError(t('wheel.starsPaymentFailed')) }
        })
      } catch (e) { setError('Ошибка: ' + String(e)) }
    },
    onError: (err: unknown) => {
      const axiosError = err as { response?: { data?: { detail?: string }, status?: number } }
      setError(`Ошибка: ${axiosError?.response?.data?.detail || 'Не удалось создать счёт'}`)
    },
  })

  const topUpMutation = useMutation<{
    payment_id: string; payment_url?: string; invoice_url?: string
    amount_kopeks: number; amount_rubles: number; status: string; expires_at: string | null
  }, unknown, number>({
    mutationFn: (amountKopeks: number) => balanceApi.createTopUp(amountKopeks, method.id, selectedOption || undefined),
    onSuccess: (data) => {
      const redirectUrl = data.payment_url || (data as any).invoice_url
      if (redirectUrl) openPaymentLink(redirectUrl, popupRef.current)
      popupRef.current = null
      handleClose()
    },
    onError: (err: unknown) => {
      try { if (popupRef.current && !popupRef.current.closed) popupRef.current.close() } catch {}
      popupRef.current = null
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || ''
      setError(detail.includes('not yet implemented') ? t('balance.useBot') : (detail || t('common.error')))
    },
  })

  const handleSubmit = () => {
    setError(null)
    inputRef.current?.blur()

    if (!checkRateLimit(RATE_LIMIT_KEYS.PAYMENT, 3, 30000)) {
      setError('Подождите ' + getRateLimitResetTime(RATE_LIMIT_KEYS.PAYMENT) + ' сек.')
      return
    }
    if (hasOptions && !selectedOption) { setError('Выберите способ'); return }
    const amountCurrency = parseFloat(amount)
    if (isNaN(amountCurrency) || amountCurrency <= 0) { setError('Введите сумму'); return }
    const amountRubles = convertToRub(amountCurrency)
    if (amountRubles < minRubles || amountRubles > maxRubles) {
      setError(`Сумма: ${minRubles} – ${maxRubles} ₽`); return
    }

    const amountKopeks = Math.round(amountRubles * 100)
    if (!isTelegramMiniApp) {
      try { popupRef.current = window.open('', '_blank') } catch { popupRef.current = null }
    }
    if (isStarsMethod) { starsPaymentMutation.mutate(amountKopeks) }
    else { topUpMutation.mutate(amountKopeks) }
  }

  const quickAmounts = [100, 300, 500, 1000].filter((a) => a >= minRubles && a <= maxRubles)
  const currencyDecimals = (targetCurrency === 'IRR' || targetCurrency === 'RUB') ? 0 : 2
  const getQuickValue = (rub: number) => (targetCurrency === 'IRR')
    ? Math.round(convertAmount(rub)).toString()
    : convertAmount(rub).toFixed(currencyDecimals)
  const isPending = topUpMutation.isPending || starsPaymentMutation.isPending

  // Auto-focus input on mount (delayed for animation)
  useEffect(() => {
    const timer = setTimeout(() => {
      // Don't auto-focus on mobile to prevent keyboard from opening immediately
      if (!isMobileScreen) {
        inputRef.current?.focus()
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [isMobileScreen])

  // Mobile bottom sheet modal
  const MobileWrapper = ({ children }: { children: React.ReactNode }) => {
    const content = (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-[9998] bg-black/60 animate-fade-in"
          onClick={handleClose}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        />
        {/* Modal */}
        <div
          data-modal-content
          className="fixed inset-x-0 bottom-0 z-[9999] bg-dark-900 rounded-t-[28px] animate-slide-up flex flex-col max-h-[90vh]"
          style={{
            paddingBottom: safeBottom ? `${safeBottom + 16}px` : 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle bar - iOS style */}
          <div
            className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
            style={{ touchAction: 'none' }}
          >
            <div className="w-9 h-1 rounded-full bg-dark-500" />
          </div>
          {children}
        </div>
      </>
    )

    if (typeof document !== 'undefined') {
      return createPortal(content, document.body)
    }
    return content
  }

  // Desktop centered modal
  const DesktopWrapper = ({ children }: { children: React.ReactNode }) => (
    <div
      className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 animate-fade-in"
      onClick={handleClose}
    >
      <div
        data-modal-content
        className="w-full max-w-[400px] bg-dark-900 rounded-[24px] border border-dark-700/30 shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )

  const Wrapper = isMobileScreen ? MobileWrapper : DesktopWrapper

  // Touch-friendly button classes
  const touchButtonClass = "select-none"
  const minTouchTarget = "min-h-[44px] min-w-[44px]" // Apple HIG minimum

  const modalContent = (
    <>
      {/* Header */}
      <div className="px-5 pt-3 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-500/20 to-accent-600/10 flex items-center justify-center text-accent-400 ${minTouchTarget}`}>
            <WalletIcon />
          </div>
          <div>
            <h2 className="font-bold text-dark-100 text-lg leading-tight">{methodName}</h2>
            <p className="text-dark-400 text-sm">{formatAmount(minRubles, 0)} – {formatAmount(maxRubles, 0)}</p>
          </div>
        </div>
        <button
          onClick={handleClose}
          className={`p-2.5 rounded-full bg-dark-800/80 hover:bg-dark-700 active:bg-dark-600 text-dark-400 hover:text-dark-200 transition-colors -mr-1 ${touchButtonClass} ${minTouchTarget}`}
          aria-label={t('common.close')}
        >
          <CloseIcon />
        </button>
      </div>

      {/* Content */}
      <div className="px-5 pb-5 space-y-4 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* Payment options */}
        {hasOptions && method.options && (
          <div className="grid grid-cols-2 gap-2">
            {method.options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedOption(opt.id)}
                className={`${minTouchTarget} py-3 px-4 rounded-xl text-sm font-semibold transition-all ${touchButtonClass} ${
                  selectedOption === opt.id
                    ? 'bg-accent-500 text-white shadow-lg shadow-accent-500/20'
                    : 'bg-dark-800/70 text-dark-300 hover:bg-dark-800 active:bg-dark-700'
                }`}
              >
                {opt.name}
              </button>
            ))}
          </div>
        )}

        {/* Amount input */}
        <div className="relative">
          <input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            enterKeyHint="done"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSubmit()
              }
            }}
            placeholder={t('balance.enterAmount') || 'Введите сумму'}
            className="w-full h-14 px-5 pr-14 text-xl font-bold bg-dark-800/50 border-2 border-dark-700/50 rounded-2xl text-dark-100 placeholder:text-dark-500 placeholder:font-normal focus:outline-none focus:border-accent-500/50 focus:bg-dark-800/70 transition-all"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            style={{
              fontSize: '20px', // Prevent iOS zoom on focus
              WebkitTapHighlightColor: 'transparent'
            }}
          />
          <span className="absolute right-5 top-1/2 -translate-y-1/2 text-dark-400 font-semibold text-lg pointer-events-none">
            {currencySymbol}
          </span>
        </div>

        {/* Quick amounts */}
        {quickAmounts.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {quickAmounts.map((a) => {
              const val = getQuickValue(a)
              const isSelected = amount === val
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => { setAmount(val); inputRef.current?.blur() }}
                  className={`${minTouchTarget} py-3 rounded-xl text-sm font-semibold transition-all ${touchButtonClass} ${
                    isSelected
                      ? 'bg-accent-500/15 text-accent-400 ring-2 ring-accent-500/30'
                      : 'bg-dark-800/50 text-dark-300 hover:bg-dark-800 active:bg-dark-700'
                  }`}
                >
                  {formatAmount(a, 0)}
                </button>
              )
            })}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-error-500/10 border border-error-500/20" role="alert">
            <svg className="w-5 h-5 text-error-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-error-400 text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || !amount}
          className={`w-full h-14 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-accent-500 to-accent-600 text-white shadow-lg shadow-accent-500/25 hover:shadow-accent-500/40 active:scale-[0.98] active:shadow-accent-500/20 ${touchButtonClass}`}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          {isPending ? (
            <span className="w-6 h-6 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>{t('balance.topUp')}</span>
              {amount && parseFloat(amount) > 0 && (
                <span className="opacity-80">• {formatAmount(parseFloat(amount), currencyDecimals)} {currencySymbol}</span>
              )}
            </>
          )}
        </button>
      </div>
    </>
  )

  return <Wrapper>{modalContent}</Wrapper>
}
