import crypto from 'node:crypto';
import type {
  FamilyMember,
  IndoorEnvironmentInput,
  UserProfile,
} from '../src/domain/airQualityTypes.ts';
import {
  sanitizeLocationInput,
  sanitizeUserText,
  validateUserProfile,
} from '../src/services/validation.ts';

export interface WorkspaceRecord {
  ownerId: string;
  profile: UserProfile;
  indoor: IndoorEnvironmentInput;
  family: FamilyMember[];
  updatedAt: string;
}

const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const workspaceRecords = new Map<string, WorkspaceRecord>();
const MAX_WORKSPACES = 500;

function signOwnerId(ownerId: string): string {
  return crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(ownerId)
    .digest('base64url');
}

export function issueWorkspaceSession(): { token: string; ownerId: string } {
  const ownerId = `bw_${crypto.randomBytes(12).toString('hex')}`;
  const sig = signOwnerId(ownerId);
  return { token: `${ownerId}.${sig}`, ownerId };
}

export function verifyWorkspaceToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const raw = authHeader.slice(7).trim();
  const dotIdx = raw.indexOf('.');
  if (dotIdx <= 0 || dotIdx === raw.length - 1) return null;

  const ownerId = raw.slice(0, dotIdx);
  const providedSig = raw.slice(dotIdx + 1);
  if (!/^bw_[a-f0-9]{24}$/.test(ownerId)) return null;

  const expectedSig = signOwnerId(ownerId);
  const providedBuf = Buffer.from(providedSig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (providedBuf.length !== expectedBuf.length) return null;

  return crypto.timingSafeEqual(providedBuf, expectedBuf) ? ownerId : null;
}

export function getWorkspaceRecord(ownerId: string): WorkspaceRecord | null {
  return workspaceRecords.get(ownerId) ?? null;
}

export function saveWorkspaceRecord(
  ownerId: string,
  payload: {
    profile: UserProfile;
    indoor: IndoorEnvironmentInput;
    family: FamilyMember[];
  }
): { ok: true; record: WorkspaceRecord } | { ok: false; errors: string[] } {
  const profileCheck = validateUserProfile(payload.profile);
  if (!profileCheck.valid) {
    return { ok: false, errors: profileCheck.errors };
  }

  const sanitizedProfile: UserProfile = {
    ...payload.profile,
    name: sanitizeUserText(payload.profile.name || 'Household Member', 60),
    cityId: sanitizeLocationInput(payload.profile.cityId || 'new-delhi') || 'new-delhi',
    manualLocationLabel: sanitizeLocationInput(payload.profile.manualLocationLabel || ''),
    activities: Array.isArray(payload.profile.activities)
      ? payload.profile.activities.slice(0, 600).map((a, idx) => ({
          id: sanitizeUserText(a.id || `act-${idx}`, 40),
          timeBlock:
            a.timeBlock === 'Morning' || a.timeBlock === 'Afternoon' || a.timeBlock === 'Evening'
              ? a.timeBlock
              : 'Morning',
          title: sanitizeUserText(a.title || 'Scheduled activity', 100),
          isOutdoor: Boolean(a.isOutdoor),
          exertion:
            a.exertion === 'low' || a.exertion === 'moderate' || a.exertion === 'high'
              ? a.exertion
              : 'low',
        }))
      : [],
    preferences: Array.isArray(payload.profile.preferences)
      ? payload.profile.preferences.slice(0, 20).map((p) => sanitizeUserText(String(p), 80))
      : [],
    onboardingCompleted: Boolean(payload.profile.onboardingCompleted),
  };

  const sanitizedFamily: FamilyMember[] = Array.isArray(payload.family)
    ? payload.family.slice(0, 60).map((m, idx) => ({
        id: sanitizeUserText(m.id || `fam-${idx}`, 40),
        name: sanitizeUserText(m.name || `Member ${idx + 1}`, 60),
        role: sanitizeUserText(m.role || 'Household Member', 60),
        ageGroup:
          m.ageGroup === 'Child (under 12)' ||
          m.ageGroup === 'Teen (13–17)' ||
          m.ageGroup === 'Adult (18–64)' ||
          m.ageGroup === 'Older Adult (65+)'
            ? m.ageGroup
            : 'Adult (18–64)',
        commute: m.commute || 'public_transit',
        keyActivities: sanitizeUserText(m.keyActivities || 'Daily routine', 140),
        activityPreference: sanitizeUserText(m.activityPreference || 'Indoor/outdoor flexible', 140),
      }))
    : [];

  const sanitizedIndoor: IndoorEnvironmentInput = {
    ...payload.indoor,
    indoorSmokeSources: Array.isArray(payload.indoor?.indoorSmokeSources)
      ? payload.indoor.indoorSmokeSources.slice(0, 12).map((s) => sanitizeUserText(String(s), 60))
      : [],
    indoorMonitorAvailable: Boolean(payload.indoor?.indoorMonitorAvailable),
  };

  if (workspaceRecords.size >= MAX_WORKSPACES && !workspaceRecords.has(ownerId)) {
    const oldestKey = workspaceRecords.keys().next().value;
    if (oldestKey) workspaceRecords.delete(oldestKey);
  }

  const record: WorkspaceRecord = {
    ownerId,
    profile: sanitizedProfile,
    indoor: sanitizedIndoor,
    family: sanitizedFamily,
    updatedAt: new Date().toISOString(),
  };

  workspaceRecords.set(ownerId, record);
  return { ok: true, record };
}
