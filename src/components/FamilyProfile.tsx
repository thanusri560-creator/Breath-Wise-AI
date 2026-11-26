import React, { useState } from 'react';
import {
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import type {
  AirQualityReading,
  CommuteType,
  FamilyActionPlanResult,
  FamilyMember,
} from '../domain/airQualityTypes';
import { COMMUTE_LABELS } from '../data/breathewiseDefaults';
import { AQIIndicator } from './AQIIndicator';

interface FamilyProfileProps {
  airQuality: AirQualityReading;
  members: FamilyMember[];
  familyPlan: FamilyActionPlanResult;
  loadingAi: boolean;
  aiNotice: string | null;
  onAddMember: (member: Omit<FamilyMember, 'id'>) => void;
  onRemoveMember: (id: string) => void;
  onEnhanceWithGemini: () => void;
}

export function FamilyProfile({
  airQuality,
  members,
  familyPlan,
  loadingAi,
  aiNotice,
  onAddMember,
  onRemoveMember,
  onEnhanceWithGemini,
}: FamilyProfileProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [ageGroup, setAgeGroup] = useState<FamilyMember['ageGroup']>('Adult (18–64)');
  const [commute, setCommute] = useState<CommuteType>('public_transit');
  const [keyActivities, setKeyActivities] = useState('');
  const [rosterNotice, setRosterNotice] = useState<string | null>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onAddMember({
      name: trimmedName,
      role: role.trim() || 'Household Member',
      ageGroup,
      commute,
      keyActivities: keyActivities.trim() || 'Daily commute and neighborhood errands',
      activityPreference: 'Flexible indoor/outdoor routine',
    });
    setRosterNotice(`Added ${trimmedName} to the household air action plan.`);
    setName('');
    setRole('');
    setKeyActivities('');
  };

  const handleRemove = (member: FamilyMember) => {
    onRemoveMember(member.id);
    setRosterNotice(`Removed ${member.name} from the household air action plan.`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-700" />
                <span>Family &amp; Household Air Action Plan</span>
              </h2>
              <AQIIndicator aqi={airQuality.aqi} category={airQuality.category} compact />
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              {familyPlan.householdSummary}
            </p>
          </div>

          <button
            type="button"
            onClick={onEnhanceWithGemini}
            disabled={loadingAi}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            {loadingAi ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{loadingAi ? 'Coordinating...' : 'Optimize Household Plan with Gemini'}</span>
          </button>
        </div>

        {aiNotice && (
          <div role="status" className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
            {aiNotice}
          </div>
        )}
      </section>

      {/* Household Roster + Add Member Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="font-display text-base font-bold text-slate-900">
            Household Members ({members.length})
          </h3>

          {rosterNotice && (
            <div
              role="status"
              aria-live="polite"
              className="px-3 py-2 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-900"
            >
              {rosterNotice}
            </div>
          )}

          <div className="divide-y divide-slate-200">
            {members.map((member) => (
              <div
                key={member.id}
                className="py-3.5 first:pt-0 last:pb-0 flex items-start justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-display font-bold text-sm text-slate-900">
                      {member.name}
                    </span>
                    <span className="text-xs text-teal-800 font-medium">
                      {member.role} · {member.ageGroup}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Commute: {COMMUTE_LABELS[member.commute]} · Routine: {member.keyActivities}
                  </p>
                </div>

                {members.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemove(member)}
                    aria-label={`Remove ${member.name} from household`}
                    className="p-2 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="font-display text-base font-bold text-slate-900">
            Add Household Member
          </h3>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="fam-name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Name
                </label>
                <input
                  id="fam-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Priya"
                  className="w-full h-9 px-3 text-sm bg-slate-50 border border-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                />
              </div>
              <div>
                <label htmlFor="fam-role" className="block text-xs font-semibold text-slate-700 mb-1">
                  Role
                </label>
                <input
                  id="fam-role"
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Student"
                  className="w-full h-9 px-3 text-sm bg-slate-50 border border-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="fam-age" className="block text-xs font-semibold text-slate-700 mb-1">
                  Age Group
                </label>
                <select
                  id="fam-age"
                  value={ageGroup}
                  onChange={(e) => setAgeGroup(e.target.value as FamilyMember['ageGroup'])}
                  className="w-full h-9 px-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                >
                  <option value="Child (under 12)">Child (under 12)</option>
                  <option value="Teen (13–17)">Teen (13–17)</option>
                  <option value="Adult (18–64)">Adult (18–64)</option>
                  <option value="Older Adult (65+)">Older Adult (65+)</option>
                </select>
              </div>
              <div>
                <label htmlFor="fam-commute" className="block text-xs font-semibold text-slate-700 mb-1">
                  Typical Commute
                </label>
                <select
                  id="fam-commute"
                  value={commute}
                  onChange={(e) => setCommute(e.target.value as CommuteType)}
                  className="w-full h-9 px-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                >
                  {(Object.keys(COMMUTE_LABELS) as CommuteType[]).map((k) => (
                    <option key={k} value={k}>
                      {COMMUTE_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="fam-activities" className="block text-xs font-semibold text-slate-700 mb-1">
                Key Daily Activities
              </label>
              <input
                id="fam-activities"
                type="text"
                value={keyActivities}
                onChange={(e) => setKeyActivities(e.target.value)}
                placeholder="e.g. Morning bus commute & afternoon sports"
                className="w-full h-9 px-3 text-sm bg-slate-50 border border-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              />
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-lg bg-[#0B1220] hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              <Plus className="w-4 h-4" />
              <span>Add to Household Plan</span>
            </button>
          </form>
        </section>
      </div>

      {/* Coordinated Individual & Shared Recommendations */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <h3 className="font-display text-lg font-bold text-slate-900">
          Individual Daily Adjustments
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {familyPlan.individualRoutines.map((item, idx) => (
            <article key={`${item.memberName}-${idx}`} className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-display font-bold text-sm text-slate-900">
                  {item.memberName}
                </div>
                <span className="text-xs font-medium text-teal-800">{item.role}</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                {item.suggestedAction}
              </p>
              <p className="text-xs text-slate-600">{item.whySuggested}</p>
            </article>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4 border-t border-slate-200 text-xs sm:text-sm">
          <div className="space-y-2">
            <h4 className="font-display font-bold text-slate-900">Shared Household Activities</h4>
            <ul className="space-y-2 text-xs text-slate-700">
              {familyPlan.sharedActivities.map((act, idx) => (
                <li key={idx}>
                  <strong className="text-slate-900 block">{act.activity}</strong>
                  <span>{act.plan}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-display font-bold text-slate-900">Shared Indoor Air Practices</h4>
            <ul className="list-disc pl-4 space-y-1.5 text-xs text-slate-700">
              {familyPlan.indoorAirPractices.map((p, idx) => (
                <li key={idx}>{p}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-display font-bold text-slate-900">Sustainable Household Logistics</h4>
            <ul className="list-disc pl-4 space-y-1.5 text-xs text-slate-700">
              {familyPlan.sustainableHouseholdChoices.map((c, idx) => (
                <li key={idx}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
