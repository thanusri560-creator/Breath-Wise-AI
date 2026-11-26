import React, { useEffect, useState } from 'react';
import {
  Activity,
  Bot,
  CalendarClock,
  FlaskConical,
  Home,
  Leaf,
  Menu,
  SlidersHorizontal,
  Sparkles,
  Users,
  Wind,
  X,
} from 'lucide-react';
import type {
  AirQualityReading,
  BreatheWisePage,
  CityOption,
  LocationSearchResult,
} from '../domain/airQualityTypes';
import { AQIIndicator } from './AQIIndicator';
import { IndiaLocationPicker } from './IndiaLocationPicker';

interface BreatheWiseLayoutProps {
  activePage: BreatheWisePage;
  onSelectPage: (page: BreatheWisePage) => void;
  airQuality: AirQualityReading;
  cities: CityOption[];
  selectedCityId: string;
  onSelectCity: (cityId: string) => void;
  onSelectLocation: (loc: LocationSearchResult) => void;
  liveAqiConfigured: boolean;
  children: React.ReactNode;
}

interface NavItem {
  id: BreatheWisePage;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'primary' | 'tools';
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Air Dashboard', icon: Activity, group: 'primary' },
  { id: 'routine', label: 'Daily Action Plan', icon: CalendarClock, group: 'primary' },
  { id: 'indoor', label: 'Indoor Air Guide', icon: Home, group: 'primary' },
  { id: 'alternatives', label: 'Low-Emission Options', icon: Leaf, group: 'primary' },
  { id: 'impact', label: 'Impact & Simulator', icon: Sparkles, group: 'primary' },
  { id: 'assistant', label: 'Gemini Assistant', icon: Bot, group: 'primary' },
  { id: 'family', label: 'Family Plan', icon: Users, group: 'primary' },
  { id: 'onboarding', label: 'Profile & Setup', icon: SlidersHorizontal, group: 'tools' },
  { id: 'testing', label: 'Automated Tests', icon: FlaskConical, group: 'tools' },
];

export function BreatheWiseLayout({
  activePage,
  onSelectPage,
  airQuality,
  cities,
  onSelectCity,
  onSelectLocation,
  liveAqiConfigured,
  children,
}: BreatheWiseLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMobileNavOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen]);

  const primaryItems = NAV_ITEMS.filter((i) => i.group === 'primary');
  const toolItems = NAV_ITEMS.filter((i) => i.group === 'tools');

  const handleNavClick = (id: BreatheWisePage) => {
    onSelectPage(id);
    setMobileNavOpen(false);
  };

  const renderNavList = (items: NavItem[]) => (
    <ul className="space-y-1">
      {items.map((item) => {
        const Icon = item.icon;
        const active = activePage === item.id;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => handleNavClick(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
                active
                  ? 'bg-teal-600/20 text-teal-200 border border-teal-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-teal-300' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex">
      {/* WCAG 2.2 AA Skip Navigation Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-teal-700 focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold"
      >
        Skip to main content
      </a>

      {/* Desktop Deep Navy Sidebar */}
      <aside
        aria-label="Primary navigation"
        className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-[#0B1220] text-slate-100 border-r border-slate-800/80"
      >
        <div className="px-5 py-5 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600/20 border border-teal-500/40 flex items-center justify-center text-teal-300">
              <Wind className="w-4 h-4" />
            </div>
            <div>
              <div className="font-display font-bold text-base tracking-tight text-white">
                BreatheWise AI
              </div>
              <div className="text-[11px] text-slate-400">
                Urban Air Quality Assistant
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
          <div>
            <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Air Intelligence
            </p>
            {renderNavList(primaryItems)}
          </div>
          <div>
            <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Workspace & QA
            </p>
            {renderNavList(toolItems)}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800/80 bg-[#090F1B]">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
            Active Location
          </div>
          <div className="text-sm font-semibold text-white truncate">
            {airQuality.cityName}
          </div>
          <div className="mt-1.5">
            <AQIIndicator
              aqi={airQuality.aqi}
              category={airQuality.category}
              inverted
              compact
            />
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            {airQuality.isDemo ? 'Demo Mode Sample Feed' : 'Live Station Telemetry'}
          </div>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation menu"
        >
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-[#0B1220] text-slate-100 flex flex-col h-full shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wind className="w-4 h-4 text-teal-400" />
                <span className="font-display font-bold text-white">BreatheWise AI</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close menu"
                className="p-2 text-slate-400 hover:text-white rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
              <div>
                <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Air Intelligence
                </p>
                {renderNavList(primaryItems)}
              </div>
              <div>
                <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Workspace & QA
                </p>
                {renderNavList(toolItems)}
              </div>
            </nav>
          </div>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean 3-Zone Top Header */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-base sm:text-lg font-bold text-slate-900 truncate">
                {NAV_ITEMS.find((n) => n.id === activePage)?.label ?? 'BreatheWise AI'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <IndiaLocationPicker
              currentCityName={airQuality.cityName}
              cities={cities}
              onSelectLocation={onSelectLocation}
              onSelectPresetCity={onSelectCity}
              compact
            />

            <button
              type="button"
              onClick={() => onSelectPage('impact')}
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Run What-If</span>
            </button>
          </div>
        </header>

        {/* Unmistakable Demo Mode Disclosure Bar (never presents sample telemetry as live!) */}
        {airQuality.isDemo && (
          <div
            role="status"
            className="bg-[#0F172A] text-slate-200 border-b border-slate-800 px-4 sm:px-6 lg:px-8 py-2 text-xs flex flex-wrap items-center justify-between gap-2"
          >
            <p className="leading-relaxed">
              <strong className="text-cyan-300 font-semibold">DEMO MODE — Sample Urban Smog Data:</strong>{' '}
              Displaying realistic modeled readings for {airQuality.cityName} because no live environmental API token is configured. Never treat sample readings as official emergency alerts.
            </p>
            <span className="font-mono tabular-nums text-[11px] text-slate-400">
              {liveAqiConfigured ? 'Live Feed Ready' : airQuality.lastUpdatedLabel}
            </span>
          </div>
        )}

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-7xl w-full mx-auto focus:outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
