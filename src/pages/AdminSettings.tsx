import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { adminSettingsApi, SettingDefinition } from '../api/adminSettings'
import { themeColorsApi } from '../api/themeColors'
import { useFavoriteSettings } from '../hooks/useFavoriteSettings'
import {
  BackIcon,
  SearchIcon,
  StarIcon,
  CloseIcon,
  MenuIcon,
  MENU_SECTIONS,
  MenuItem
} from '../components/admin'
import { BrandingTab } from '../components/admin/BrandingTab'
import { ThemeTab } from '../components/admin/ThemeTab'
import { FavoritesTab } from '../components/admin/FavoritesTab'
import { SettingsTab } from '../components/admin/SettingsTab'

export default function AdminSettings() {
  const { t } = useTranslation()

  // State
  const [activeSection, setActiveSection] = useState('branding')
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Favorites hook
  const { favorites, toggleFavorite, isFavorite } = useFavoriteSettings()

  // Queries
  const { data: themeColors } = useQuery({
    queryKey: ['theme-colors'],
    queryFn: themeColorsApi.getColors,
  })

  const { data: allSettings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => adminSettingsApi.getSettings(),
  })

  // Get current menu item configuration
  const currentMenuItem = useMemo(() => {
    for (const section of MENU_SECTIONS) {
      const item = section.items.find((i: MenuItem) => i.id === activeSection)
      if (item) return item
    }
    return null
  }, [activeSection])

  // Get categories for current section
  const currentCategories = useMemo(() => {
    if (!currentMenuItem?.categories || !allSettings || !Array.isArray(allSettings)) return []

    const categoryMap = new Map<string, SettingDefinition[]>()

    for (const setting of allSettings) {
      if (currentMenuItem.categories.includes(setting.category.key)) {
        if (!categoryMap.has(setting.category.key)) {
          categoryMap.set(setting.category.key, [])
        }
        categoryMap.get(setting.category.key)!.push(setting)
      }
    }

    return Array.from(categoryMap.entries()).map(([key, settings]) => ({
      key,
      label: t(`admin.settings.categories.${key}`, key),
      settings
    }))
  }, [currentMenuItem, allSettings, t])

  // Filter settings for search
  const filteredSettings = useMemo(() => {
    if (!allSettings || !Array.isArray(allSettings) || !searchQuery) return []

    const q = searchQuery.toLowerCase()
    let settings = allSettings.filter((s: SettingDefinition) =>
      currentMenuItem?.categories?.includes(s.category.key)
    )

    return settings.filter((s: SettingDefinition) =>
      s.key.toLowerCase().includes(q) ||
      s.name?.toLowerCase().includes(q)
    )
  }, [allSettings, currentMenuItem, searchQuery])

  // Favorite settings
  const favoriteSettings = useMemo(() => {
    if (!allSettings || !Array.isArray(allSettings)) return []
    return allSettings.filter((s: SettingDefinition) => favorites.includes(s.key))
  }, [allSettings, favorites])

  // Render content based on active section
  const renderContent = () => {
    switch (activeSection) {
      case 'branding':
        return <BrandingTab accentColor={themeColors?.accent} />
      case 'theme':
        return <ThemeTab />
      case 'favorites':
        return (
          <FavoritesTab
            settings={favoriteSettings}
            isFavorite={isFavorite}
            toggleFavorite={toggleFavorite}
          />
        )
      default:
        if (['payments', 'subscriptions', 'interface', 'notifications', 'database', 'system', 'users'].includes(activeSection)) {
          return (
            <SettingsTab
              categories={currentCategories}
              searchQuery={searchQuery}
              filteredSettings={filteredSettings}
              isFavorite={isFavorite}
              toggleFavorite={toggleFavorite}
            />
          )
        }
        return null
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky lg:top-0 inset-y-0 left-0 z-50
        w-64 h-screen bg-dark-900 border-r border-dark-700/50 flex-shrink-0
        transform transition-transform duration-200 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Header */}
        <div className="p-4 border-b border-dark-700/50">
          <div className="flex items-center gap-3">
            <Link to="/admin" className="p-2 rounded-xl bg-dark-800 hover:bg-dark-700 transition-colors">
              <BackIcon />
            </Link>
            <h1 className="text-lg font-bold text-dark-100">{t('admin.settings.title')}</h1>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="ml-auto p-2 rounded-xl bg-dark-800 hover:bg-dark-700 transition-colors lg:hidden"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Menu */}
        <nav className="p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-80px)]">
          {MENU_SECTIONS.map((section, sectionIdx) => (
            <div key={section.id}>
              {sectionIdx > 0 && <div className="my-3 border-t border-dark-700/50" />}
              {section.items.map((item) => {
                const isActive = activeSection === item.id
                const hasIcon = item.iconType === 'star'
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveSection(item.id)
                      setMobileMenuOpen(false)
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                      isActive
                        ? 'bg-accent-500/10 text-accent-400'
                        : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800/50'
                    }`}
                  >
                    {hasIcon && <StarIcon filled={isActive && item.id === 'favorites'} />}
                    <span className="font-medium">{t(`admin.settings.${item.id}`)}</span>
                    {item.id === 'favorites' && favorites.length > 0 && (
                      <span className="ml-auto px-2 py-0.5 text-xs rounded-full bg-warning-500/20 text-warning-400">
                        {favorites.length}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-dark-900/95 backdrop-blur-xl border-b border-dark-700/50 p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-xl bg-dark-800 hover:bg-dark-700 transition-colors lg:hidden"
            >
              <MenuIcon />
            </button>

            <h2 className="text-lg sm:text-xl font-semibold text-dark-100 truncate">
              {t(`admin.settings.${activeSection}`)}
            </h2>

            <div className="flex-1" />

            {/* Search - desktop */}
            <div className="relative hidden sm:block">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('admin.settings.searchPlaceholder')}
                className="w-48 lg:w-64 pl-10 pr-4 py-2 rounded-xl bg-dark-800 border border-dark-700 text-dark-100 placeholder-dark-500 focus:outline-none focus:border-accent-500 text-sm"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500">
                <SearchIcon />
              </div>
            </div>
          </div>

          {/* Search - mobile */}
          <div className="relative mt-3 sm:hidden">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('admin.settings.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-dark-800 border border-dark-700 text-dark-100 placeholder-dark-500 focus:outline-none focus:border-accent-500 text-sm"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500">
              <SearchIcon />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 lg:p-6">
          {renderContent()}
        </div>
      </main>
    </div>
  )
}
