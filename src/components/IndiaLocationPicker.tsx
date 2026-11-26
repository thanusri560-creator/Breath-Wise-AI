import React, { useEffect, useId, useRef, useState } from 'react';
import { Loader2, MapPin, Search, X } from 'lucide-react';
import type { CityOption, LocationSearchResult } from '../domain/airQualityTypes';
import { useDebounce } from '../hooks/useDebounce';
import { breathewiseApiClient } from '../services/breathewiseApiClient';

interface IndiaLocationPickerProps {
  currentCityName: string;
  cities: CityOption[];
  onSelectLocation: (loc: LocationSearchResult) => void;
  onSelectPresetCity: (cityId: string) => void;
  compact?: boolean;
}

/**
 * WCAG 2.2 AA accessible dynamic All-India location search combobox.
 * Lets users type ANY city, town, or district across India (live debounced search)
 * or pick a featured Indian city in one click.
 */
export function IndiaLocationPicker({
  currentCityName,
  cities,
  onSelectLocation,
  onSelectPresetCity,
  compact = false,
}: IndiaLocationPickerProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [searchState, setSearchState] = useState<{
    query: string;
    results: LocationSearchResult[];
  }>({ query: '', results: [] });
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const debouncedQuery = useDebounce(query.trim(), 250);
  const isQueryActive = debouncedQuery.length >= 2;
  const searching = isQueryActive && searchState.query !== debouncedQuery;
  const results = isQueryActive && searchState.query === debouncedQuery ? searchState.results : [];

  // Featured Indian quick-pick cities shown before the user types
  const indianPresets = cities.filter((c) => c.region.includes('India'));

  useEffect(() => {
    if (!isQueryActive) return;
    let active = true;

    async function runSearch() {
      const res = await breathewiseApiClient.searchIndiaLocations(debouncedQuery);
      if (!active) return;
      setSearchState({
        query: debouncedQuery,
        results: res.ok && res.data?.results ? res.data.results : [],
      });
      setActiveIndex(0);
    }

    void runSearch();
    return () => {
      active = false;
    };
  }, [debouncedQuery, isQueryActive]);

  // Close dropdown on outside click
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const isShowingSearch = query.trim().length >= 2;
  const totalOptions = isShowingSearch ? results.length : indianPresets.length;
  const activeOptionId =
    open && activeIndex >= 0 && activeIndex < totalOptions
      ? `${listboxId}-opt-${activeIndex}`
      : undefined;

  const commitDynamic = (loc: LocationSearchResult) => {
    onSelectLocation(loc);
    setQuery('');
    setOpen(false);
    setActiveIndex(-1);
  };

  const commitPreset = (city: CityOption) => {
    onSelectPresetCity(city.id);
    setQuery('');
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (totalOptions > 0) {
        setActiveIndex((prev) => (prev + 1) % totalOptions);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (totalOptions > 0) {
        setActiveIndex((prev) => (prev <= 0 ? totalOptions - 1 : prev - 1));
      }
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      if (isShowingSearch && results.length > 0) {
        const chosen = results[Math.max(0, activeIndex)] ?? results[0];
        commitDynamic(chosen);
      } else if (!isShowingSearch && indianPresets.length > 0 && activeIndex >= 0) {
        commitPreset(indianPresets[activeIndex]);
      }
    }
  };

  return (
    <div ref={containerRef} className={`relative ${compact ? 'w-56 sm:w-72 md:w-80' : 'w-full'}`}>
      <div className="relative flex items-center">
        <Search
          aria-hidden="true"
          className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none"
        />
        <input
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          aria-label="Search any city, town, or district in India"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={`Search India (${currentCityName})...`}
          className={`w-full ${
            compact ? 'h-9 text-xs sm:text-sm' : 'h-10 text-sm'
          } pl-8 pr-8 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:bg-white`}
        />
        {searching ? (
          <Loader2
            aria-label="Searching Indian locations"
            className="w-3.5 h-3.5 text-teal-700 animate-spin absolute right-3"
          />
        ) : query.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setSearchState({ query: '', results: [] });
            }}
            aria-label="Clear location search"
            className="absolute right-2 p-1 text-slate-400 hover:text-slate-700 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="India location suggestions"
          className="absolute left-0 right-0 mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-lg max-h-72 overflow-y-auto py-1.5"
        >
          {isShowingSearch ? (
            searching ? (
              <div className="px-3.5 py-3 text-xs text-slate-500">
                Searching cities &amp; towns across India...
              </div>
            ) : results.length > 0 ? (
              <>
                <div className="px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Live India Locations
                </div>
                {results.map((loc, idx) => (
                  <button
                    key={`${loc.id}-${idx}`}
                    id={`${listboxId}-opt-${idx}`}
                    type="button"
                    role="option"
                    aria-selected={activeIndex === idx}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      commitDynamic(loc);
                    }}
                    className={`w-full text-left px-3.5 py-2 flex items-start gap-2.5 text-xs sm:text-sm transition-colors ${
                      activeIndex === idx
                        ? 'bg-teal-50 text-teal-950'
                        : 'text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5 text-teal-700 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{loc.name}</div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {[loc.district, loc.state, loc.country].filter(Boolean).join(', ')}
                      </div>
                    </div>
                  </button>
                ))}
              </>
            ) : (
              <div className="px-3.5 py-3 text-xs text-slate-500">
                No matching Indian city or town found for &ldquo;{query.trim()}&rdquo;. Try typing a nearby city or district name.
              </div>
            )
          ) : (
            <>
              <div className="px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Popular India Cities (or type any town/district)
              </div>
              {indianPresets.map((city, idx) => (
                <button
                  key={city.id}
                  id={`${listboxId}-opt-${idx}`}
                  type="button"
                  role="option"
                  aria-selected={activeIndex === idx}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commitPreset(city);
                  }}
                  className={`w-full text-left px-3.5 py-2 flex items-center justify-between gap-2 text-xs sm:text-sm transition-colors ${
                    activeIndex === idx
                      ? 'bg-teal-50 text-teal-950'
                      : 'text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <MapPin className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                    <span className="font-semibold truncate">{city.name}</span>
                  </span>
                  <span className="text-[11px] text-slate-500 truncate">
                    {city.region.replace(', India', '')}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
