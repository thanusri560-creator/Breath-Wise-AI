import type {
  AirQualityReading,
  DailyActionPlanResult,
  DirectImpactRecommendation,
  FamilyActionPlanResult,
  FamilyMember,
  IndoorActionItem,
  IndoorEnvironmentInput,
  IndoorGuideResult,
  LowEmissionOption,
  LowEmissionPlanResult,
  UserProfile,
  WhatIfSimulationInput,
  WhatIfSimulationResult,
} from '../domain/airQualityTypes';
import { validateAirQualityReading } from './validation.ts';
import { executeMidFlightWhatIfSimulation } from './WhatIfSimulationService.ts';

/**
 * Unified Air Action Engine (RecommendationEngine).
 *
 * Connects live/demo environmental telemetry, user lifestyle/activities,
 * indoor environment state, household roster, and Mid-Flight What-If simulations.
 *
 * Recommendation Prioritization Algorithm:
 * 1. Validate environmental reading & collect missing/stale/conflicting-data flags.
 * 2. Derive severity tier from US EPA AQI (Unavailable -> cautious fallback; >200 Severe;
 *    151–200 Unhealthy; 101–150 Sensitive; 51–100 Moderate; <=50 Good).
 * 3. Score every user activity by (isOutdoor × exertionWeight × severityMultiplier),
 *    prioritizing high-exertion outdoor slots during peak inversion hours first.
 * 4. Emit structured Direct Impact Explanations (What, Why, Direct Benefit, Benefit Dimension,
 *    Assumptions/Limitations) for Morning, Afternoon, and Evening slots.
 */
export const RecommendationEngine = {
  generateDailyActionPlan(
    air: AirQualityReading,
    profile: UserProfile
  ): DailyActionPlanResult {
    const check = validateAirQualityReading(air);
    const aqi = air.aqi;
    const isSevere = aqi !== null && aqi > 200;
    const isUnhealthy = aqi !== null && aqi > 150 && aqi <= 200;
    const isSensitive = aqi !== null && aqi > 100 && aqi <= 150;
    const isMissing = aqi === null;

    const dataLimitationBase = isMissing
      ? 'Local AQI is currently unavailable; advice uses cautious winter baseline assumptions.'
      : air.isDemo
        ? `Based on Demo Mode sample telemetry (${air.cityName}, AQI ${aqi}); street-level and indoor PM2.5 are unmeasured.`
        : air.isStale
          ? `Station reading is stale (${air.lastUpdatedLabel}); actual current smog may differ.`
          : `Based on city station AQI ${aqi}; exact curbside and indoor concentrations are not directly measured.`;

    const confidence: DirectImpactRecommendation['confidence'] =
      isMissing || air.isStale ? 'Low (Limited Data)' : air.isDemo ? 'Moderate' : 'High';

    const byBlock = (block: 'Morning' | 'Afternoon' | 'Evening') =>
      profile.activities.filter((a) => a.timeBlock === block);

    const morningAct = byBlock('Morning')[0]?.title ?? defaultActivityForLifestyle(profile.lifestyle, 'Morning');
    const afternoonAct = byBlock('Afternoon')[0]?.title ?? defaultActivityForLifestyle(profile.lifestyle, 'Afternoon');
    const eveningAct = byBlock('Evening')[0]?.title ?? defaultActivityForLifestyle(profile.lifestyle, 'Evening');

    const recommendations: DirectImpactRecommendation[] = [
      {
        id: 'rec-morning',
        timeBlock: 'Morning',
        timeWindow: '06:30 – 10:00',
        priorityRank: 1,
        activity: morningAct,
        suggestedAction: isMissing
          ? `Treat morning peak hours cautiously: check your local municipal AQI monitor before strenuous outdoor activity and keep ${morningAct.toLowerCase()} brief if haze is visible.`
          : isSevere
            ? `Move "${morningAct}" indoors or switch to remote/enclosed transit; wear a well-fitted N95/KN95 mask if stepping outside during ${air.peakWindow}.`
            : isUnhealthy
              ? `Shorten outdoor time for "${morningAct}" and avoid high-exertion breathing beside commuter roads during morning inversion.`
              : isSensitive
                ? `Shift strenuous portions of "${morningAct}" away from busy arterial roads or defer until midday dispersion.`
                : `Proceed normally with "${morningAct}" and consider walking or transit on low-traffic streets.`,
        whySuggested: isMissing
          ? 'Real-time particulate measurements are unavailable, and urban morning inversions commonly trap rush-hour exhaust.'
          : `${air.cityName} shows AQI ${aqi} (${air.category}) with ${air.pm25 !== null ? `PM2.5 at ${air.pm25} µg/m³` : 'missing PM2.5'} and ${air.wind.speedKmh !== null ? `${air.wind.speedKmh} km/h wind` : 'unknown wind'}, causing morning boundary-layer buildup.`,
        directBenefit: isSevere || isUnhealthy
          ? 'Avoids peak diurnal fine-particle inhalation during the highest-concentration morning inversion window.'
          : 'Supports safe morning routine while reducing rush-hour roadside exposure.',
        benefitDimension: 'Personal Exposure',
        assumptionsAndLimitations: dataLimitationBase,
        confidence,
      },
      {
        id: 'rec-afternoon',
        timeBlock: 'Afternoon',
        timeWindow: '12:30 – 16:00',
        priorityRank: 2,
        activity: afternoonAct,
        suggestedAction: isMissing
          ? `Consolidate essential errands into midday hours and combine trips to avoid unnecessary driving.`
          : isSevere
            ? `Keep "${afternoonAct}" strictly brief if outdoors, batch any unavoidable errands into ${air.bestWindow}, and keep home windows sealed with ${filtrationLabel(profile.filtration)} running.`
            : isUnhealthy || isSensitive
              ? `Use the midday mixing window (${air.bestWindow}) for essential outdoor errands tied to "${afternoonAct}", batching stops into a single transit or shared-ride loop.`
              : `Ideal midday window (${air.bestWindow}) for "${afternoonAct}" and 20–30 minutes of cross-ventilation to flush indoor air.`,
        whySuggested:
          'Solar warming typically lifts the urban mixing layer during early afternoon, making it the lowest-particulate band of the day while trip-chaining eliminates cold-start car exhaust.',
        directBenefit: isSevere
          ? 'Limits unavoidable outdoor exposure to the least stagnant hours while maintaining cleaner indoor air.'
          : 'Pairs lower midday particulate exposure with lower community vehicle emissions through trip batching.',
        benefitDimension: isSevere ? 'Personal Exposure' : 'Community Emissions',
        assumptionsAndLimitations: `${dataLimitationBase} Midday dispersion depends on afternoon cloud cover and wind shifts.`,
        confidence,
      },
      {
        id: 'rec-evening',
        timeBlock: 'Evening',
        timeWindow: '18:00 – 22:00',
        priorityRank: 3,
        activity: eveningAct,
        suggestedAction: isSevere || isUnhealthy
          ? `Keep "${eveningAct}" indoors after sunset, close windows before evening inversion rebounds (${air.peakWindow}), run kitchen exhaust while cooking, and operate ${filtrationLabel(profile.filtration)} in sleeping rooms.`
          : isSensitive
            ? `Prefer indoor settings for "${eveningAct}" after 19:00 and avoid indoor smoke sources (incense, candles, unvented frying).`
            : `Enjoy "${eveningAct}" comfortably; run kitchen exhaust during dinner prep to keep indoor particulates low overnight.`,
        whySuggested:
          'After sunset, surface cooling rapidly reforms winter thermal inversions while evening traffic and home heating elevate PM2.5 alongside indoor dinner-cooking particles.',
        directBenefit:
          'Prevents overnight indoor particulate buildup in bedrooms and protects rest hours from evening smog rebound.',
        benefitDimension: 'Indoor Air Quality',
        assumptionsAndLimitations: `${dataLimitationBase} Actual indoor PM2.5 depends on window sealing, cooking ventilation, and filter CADR.`,
        confidence,
      },
    ];

    const summary = isMissing
      ? `Air-quality telemetry for ${air.cityName} is currently unavailable. BreatheWise AI has generated a cautious baseline plan for your ${profile.lifestyle.replace('_', ' ')} routine until verified local data returns.`
      : `Calibrated for ${air.cityName} (AQI ${aqi}, ${air.category}) and your ${profile.lifestyle.replace('_', ' ')} profile: prioritize ${isSevere || isUnhealthy ? 'indoor protection during morning/evening peaks and minimal midday outdoor trips' : 'midday ventilation, active low-traffic routes, and clean indoor cooking'}.`;

    return {
      summary,
      source: 'Deterministic Air Action Engine',
      isDataComplete: check.valid && air.pm25 !== null && air.pm10 !== null && !air.isStale,
      missingDataWarnings: check.warnings,
      recommendations,
      publicHealthAdvisory:
        'Non-diagnostic environmental guidance. Always follow official municipal air-quality and public-health advisories, especially for children, older adults, or individuals with respiratory conditions.',
      generatedAt: new Date().toISOString(),
    };
  },

  generateIndoorAirGuide(
    air: AirQualityReading,
    profile: UserProfile,
    indoor: IndoorEnvironmentInput
  ): IndoorGuideResult {
    const aqi = air.aqi;
    const outdoorHigh = aqi === null || aqi > 150;
    const unknownWarnings: string[] = [];

    if (!indoor.indoorMonitorAvailable) {
      unknownWarnings.push(
        'No indoor PM2.5 monitor is active — indoor concentrations are inferred from outdoor AQI and indoor source habits rather than directly measured.'
      );
    }
    if (indoor.ventilationHabit === 'unknown' || indoor.cookingPractice === 'unknown' || indoor.purifierAvailability === 'unknown') {
      unknownWarnings.push(
        'One or more indoor home conditions are marked Unknown. Recommendations use precautionary defaults (avoid indoor smoke, seal against heavy outdoor smog, vent cooking) until confirmed.'
      );
    }

    const hasHeavyIndoorSources =
      indoor.cookingPractice === 'gas_stove' ||
      indoor.cookingPractice === 'high_heat_frying' ||
      indoor.cookingPractice === 'solid_fuel' ||
      indoor.indoorSmokeSources.some((s) => !s.toLowerCase().includes('none'));

    const indoorVsOutdoorWarning = hasHeavyIndoorSources
      ? 'Important: Indoor air is NOT automatically cleaner than outdoor air. Gas combustion, high-heat frying without outdoor exhaust, incense, or candles can briefly drive indoor PM2.5 and NO₂ higher than outdoor smog.'
      : 'Indoor air is only cleaner than outdoor winter smog when exterior gaps are sealed, indoor combustion is avoided, and active mechanical filtration removes infiltrating fine particles.';

    const ventilationTimingGuidance = outdoorHigh
      ? `Outdoor air in ${air.cityName} is ${aqi !== null ? `AQI ${aqi} (${air.category})` : 'unavailable/unverified'}. Keep exterior windows closed during peak inversion (${air.peakWindow}); only ventilate briefly (5–10 min) during ${air.bestWindow} if indoor cooking smoke builds up and no ducted hood exists.`
      : `Outdoor air (${aqi !== null ? `AQI ${aqi}` : 'favorable'}) allows safe 20–30 minute cross-ventilation during ${air.bestWindow} to flush indoor CO₂ and kitchen fumes.`;

    const roomLabel = indoor.primaryRoom.replace('_', ' ');
    const roomSizeNote =
      indoor.roomSize === 'large_over_35m2'
        ? 'Large open-plan rooms (>35 m²) often exceed a single compact purifier’s Clean Air Delivery Rate (CADR); close doors to create a smaller "clean-air room" during severe smog.'
        : indoor.roomSize === 'medium_15_to_35m2'
          ? 'Medium rooms (15–35 m²) match standard HEPA units rated ~250–350 m³/h CADR running continuously on medium/auto.'
          : 'Compact rooms (<15 m²) can be filtered quickly by closing the door and running a bedroom-sized HEPA unit continuously.';

    const actions: IndoorActionItem[] = [
      {
        category: 'Ventilation Timing',
        suggestedAction: outdoorHigh
          ? `Seal windows and exterior door sweeps during ${air.peakWindow}; pause cross-ventilation until outdoor AQI drops below 100.`
          : `Open opposite windows for 20 minutes during ${air.bestWindow} while outdoor PM2.5 is lowest.`,
        whySuggested: `Current setup (${indoor.ventilationHabit.replace(/_/g, ' ')}) interacts directly with ${air.cityName} outdoor smog levels.`,
        directBenefit: outdoorHigh
          ? 'Slows infiltration of outdoor PM2.5 into occupied living and sleeping rooms.'
          : 'Dilutes accumulated indoor CO₂, moisture, and cooking byproducts.',
        benefitDimension: 'Indoor Air Quality',
        assumptionsAndLimitations: 'Assumes typical residential air-exchange rates; older drafty frames admit more outdoor haze.',
      },
      {
        category: 'Source Reduction',
        suggestedAction:
          indoor.indoorSmokeSources.some((s) => !s.toLowerCase().includes('none'))
            ? `Eliminate indoor burning (${indoor.indoorSmokeSources.join(', ')}) during winter smog episodes and switch to wet-mopping instead of dry sweeping.`
            : 'Keep indoor spaces strictly combustion-free (no incense, candles, or tobacco) and use damp microfiber cleaning to avoid resuspending settled PM10 dust.',
        whySuggested: 'Unvented indoor smoke generates concentrated ultrafine particles directly in the breathing zone.',
        directBenefit: 'Prevents avoidable indoor particulate spikes that can exceed outdoor winter smog.',
        benefitDimension: 'Indoor Air Quality',
        assumptionsAndLimitations: 'Effectiveness depends on consistent household adherence across all rooms.',
      },
      {
        category: 'Filtration Guidance',
        suggestedAction:
          indoor.purifierAvailability === 'hepa_purifier' ||
          indoor.purifierAvailability === 'diy_corsi_rosenthal'
            ? `Run your ${filtrationLabel(indoor.purifierAvailability)} continuously in the ${roomLabel} with doors closed, keeping intake vents unobstructed.`
            : indoor.purifierAvailability === 'hvac_merv13'
              ? 'Set HVAC fan to circulate through MERV-13+ media during peak smog hours and verify filter gaskets fit tightly.'
              : 'Without a true HEPA purifier, prioritize sealing one primary clean-air bedroom, eliminating indoor smoke, and considering a MERV-13 box-fan filter (Corsi-Rosenthal box) as a low-cost mechanical option.',
        whySuggested: 'Mechanical HEPA or MERV-13 filtration is the primary evidence-backed way to capture airborne PM2.5 indoors.',
        directBenefit: 'Steadily lowers indoor fine particulate load inside closed rooms.',
        benefitDimension: 'Personal Exposure',
        assumptionsAndLimitations: 'Exact indoor PM2.5 reduction varies by CADR, room volume, filter age, and outdoor leakage — never guaranteed as a fixed percentage.',
      },
      {
        category: 'Cleaner Cooking',
        suggestedAction:
          indoor.rangeHood === 'vented_outdoors'
            ? `Run your ducted range hood on medium-high before lighting the ${indoor.cookingPractice.replace(/_/g, ' ')} and for 10 minutes afterward; cook on back burners and use pot lids.`
            : `Because your kitchen lacks an outdoor-vented hood (${indoor.rangeHood.replace(/_/g, ' ')}), favor lower-smoke methods (steaming, pressure cooking, electric kettle/induction), cover pans, and run portable HEPA filtration adjacent to the kitchen.`,
        whySuggested: 'Gas flames emit NO₂ and high-heat oil frying releases dense PM2.5 plumes indoors.',
        directBenefit: 'Cuts indoor cooking particulate and nitrogen dioxide accumulation at the source.',
        benefitDimension: 'Indoor Air Quality',
        assumptionsAndLimitations: 'Recirculating hoods capture coarse grease but let most fine PM2.5 and NO₂ gases pass back into the room.',
      },
      {
        category: 'Room-Specific Action',
        suggestedAction: `Designate your ${roomLabel} as the ${profile.householdSize > 1 ? `${profile.householdSize}-person household's` : "home's"} clean-air sanctuary: ${roomSizeNote}`,
        whySuggested: 'Focusing sealing and filtration on the room where family members spend 7–9 hours yields the highest practical exposure benefit.',
        directBenefit: 'Creates a predictable lower-particulate recovery space during multi-day winter inversions.',
        benefitDimension: 'Personal Exposure',
        assumptionsAndLimitations: 'Benefits decrease if interior doors remain wide open to unfiltered hallways or kitchens.',
      },
    ];

    return {
      overallAssessment: outdoorHigh
        ? `Outdoor pollution in ${air.cityName} requires proactive indoor air management. Because indoor air can easily degrade from cooking or smoke when windows are shut, pair window sealing with strict indoor source control and mechanical filtration.`
        : `Outdoor conditions in ${air.cityName} are currently manageable; combine midday natural ventilation with clean cooking ventilation to maintain healthy indoor air.`,
      indoorVsOutdoorWarning,
      ventilationTimingGuidance,
      actions,
      houseplantEvidenceNote:
        'Scientific Evidence on Houseplants: Controlled chamber and building-science studies (including Cummings & Waring, 2020) confirm that houseplants alone cannot significantly clean a polluted room—you would need hundreds of plants per square meter to rival a single HEPA purifier or normal ventilation. Keep plants for comfort, not smog filtration.',
      unknownDataWarnings: unknownWarnings,
      generatedAt: new Date().toISOString(),
    };
  },

  generateLowEmissionAlternatives(
    air: AirQualityReading,
    profile: UserProfile
  ): LowEmissionPlanResult {
    const aqi = air.aqi;
    const isSevere = aqi !== null && aqi > 200;
    const isUnhealthy = aqi !== null && aqi > 150 && aqi <= 200;

    const options: LowEmissionOption[] = [
      {
        mode: 'Public Transport (Metro / Electric Bus / Rail)',
        feasibility: 'Recommended Today',
        suggestedAction: `Shift ${profile.commute === 'solo_car' ? 'solo car trips' : 'routine city trips'} (${profile.commuteDistanceKm} km typical) to enclosed metro or rail where routes exist.`,
        whySuggested: 'Replaces single-occupancy tailpipe exhaust while keeping riders inside an enclosed cabin rather than breathing roadside air at high exertion.',
        personalExposureOutcome:
          isSevere
            ? 'Moderate protection inside air-conditioned metro cabins; wear a fitted N95 on open platforms or walking connectors.'
            : 'Lower curbside inhalation compared with walking or cycling beside congested arterial lanes.',
        communityEmissionOutcome:
          'Significantly lowers per-passenger CO₂e and urban NOx/PM tailpipe emissions compared with driving a solo passenger car.',
        distinctionNote:
          'Public transit reduces community emissions per rider, though personal exposure still depends on station ventilation and walking distance along traffic roads.',
        assumptionsAndLimitations: 'Feasibility depends on local transit coverage, schedule frequency, and accessibility.',
      },
      {
        mode: 'Remote Participation & Flexible Scheduling',
        feasibility: 'Recommended Today',
        suggestedAction:
          'Convert 1–2 commute days or in-person meetings per week to remote participation during severe smog alerts.',
        whySuggested: 'Eliminating a trip entirely is the rare option that simultaneously avoids both personal roadside exposure and vehicle emissions.',
        personalExposureOutcome:
          'High personal exposure reduction by skipping peak rush-hour curbside and in-cabin traffic pollution.',
        communityEmissionOutcome:
          'Eliminates 100% of the avoided car trip’s tailpipe CO₂, NOx, and brake/tire particulate emissions.',
        distinctionNote:
          'Even here, personal benefit still requires clean indoor air at home, while emissions benefit comes strictly from removing vehicle kilometers.',
        assumptionsAndLimitations: 'Only feasible for office, student, or administrative tasks that permit remote attendance; not realistic for on-site outdoor or clinical workers.',
      },
      {
        mode: 'Combining Errands (Trip-Chaining)',
        feasibility: 'Recommended Today',
        suggestedAction: `Batch grocery, pharmacy, and school-corridor stops into a single midday loop during ${air.bestWindow} rather than separate morning/evening drives.`,
        whySuggested: 'Winter cold-start engines emit disproportionately higher particulates and hydrocarbons in the first few kilometers.',
        personalExposureOutcome:
          'Moves essential travel out of peak morning/evening inversion hours into the calmer midday window.',
        communityEmissionOutcome:
          'Cuts total kilometers driven and eliminates redundant cold-start winter exhaust spikes.',
        distinctionNote:
          'Trip-chaining reduces total fuel burned (emissions), while timing it at midday separately reduces inhaled smog (personal exposure).',
        assumptionsAndLimitations: 'Savings vary with errand distance and traffic congestion.',
      },
      {
        mode: 'Carpooling / Shared School & Office Rides',
        feasibility: 'Recommended Today',
        suggestedAction:
          'Coordinate a 2–3 person shared ride for recurring school runs or office commutes, keeping cabin AC on recirculation mode with a clean cabin filter.',
        whySuggested: 'Cuts vehicles on congested winter corridors when transit is unavailable.',
        personalExposureOutcome:
          'Enclosed cabin on recirculation mode limits exterior PM2.5 entry (briefly crack fresh air every 20–30 min to keep cabin CO₂ comfortable).',
        communityEmissionOutcome:
          'Splits per-person vehicle emissions by the number of riders sharing the trip.',
        distinctionNote:
          'Cabin recirculation lowers riders’ personal exposure, whereas sharing one car instead of two or three lowers community emissions.',
        assumptionsAndLimitations: 'Requires compatible schedules and minimal detour distance.',
      },
      {
        mode: 'Walking or Cycling (Conditional on AQI & Road Safety)',
        feasibility: isSevere
          ? 'Not Advisable Under Current AQI'
          : isUnhealthy
            ? 'Conditional — Check Window'
            : 'Recommended Today',
        suggestedAction: isSevere
          ? `Avoid vigorous cycling or long outdoor walks today in ${air.cityName} (AQI ${aqi}); choose enclosed transit or remote alternatives instead.`
          : isUnhealthy
            ? `Limit active travel to short low-effort walks on quiet side streets during ${air.bestWindow}, avoiding heavy truck corridors.`
            : 'Use protected bike lanes or tree-lined side streets for short trips (< 4 km) where road lighting and winter surfaces are safe.',
        whySuggested:
          'Active mobility produces zero tailpipe emissions, but heavy breathing in severe winter smog multiplies inhaled fine-particle dose.',
        personalExposureOutcome: isSevere || isUnhealthy
          ? 'NEGATIVE personal exposure trade-off during high smog: elevated breathing rates inhale substantially more PM2.5.'
          : 'Favorable when ambient AQI is Good or Moderate and routes stay off arterial traffic.',
        communityEmissionOutcome:
          'Zero tailpipe CO₂ and zero exhaust particulates.',
        distinctionNote:
          'Classic proof that personal exposure reduction ≠ emission reduction: cycling in AQI 300+ produces zero emissions yet increases personal particulate exposure.',
        assumptionsAndLimitations: 'Requires safe winter road/sidewalk footing, daylight/visibility, and ambient AQI <= 100 for vigorous cycling.',
      },
    ];

    return {
      keyDistinctionSummary:
        'Reducing personal exposure (protecting what you breathe right now via indoor HEPA filtration, timing, or enclosed transit) is NOT the same as reducing community emissions (cutting tailpipe CO₂, NOx, and PM released into city air). Some choices help both (remote work, trip-chaining), while others diverge during severe smog (cycling produces zero exhaust but raises personal particulate intake).',
      currentConditionSummary:
        aqi === null
          ? `Live AQI is unavailable for ${air.cityName}; favor enclosed transit, remote options, and errand batching until verified readings confirm clean air for cycling.`
          : `${air.cityName} is currently AQI ${aqi} (${air.category}). ${isSevere || isUnhealthy ? 'Prioritize enclosed transit, carpooling, and remote/batched trips; defer vigorous outdoor cycling until air clears.' : 'Conditions support public transit, trip-chaining, and safe low-traffic walking or cycling.'}`,
      options,
      generatedAt: new Date().toISOString(),
    };
  },

  generateFamilyActionPlan(
    air: AirQualityReading,
    profile: UserProfile,
    members: FamilyMember[]
  ): FamilyActionPlanResult {
    const aqi = air.aqi;
    const isHighSmog = aqi === null || aqi > 150;

    const individualRoutines = members.map((m) => {
      const isChildOrSenior =
        m.ageGroup === 'Child (under 12)' || m.ageGroup === 'Older Adult (65+)';
      return {
        memberName: m.name,
        role: `${m.role} (${m.ageGroup})`,
        suggestedAction: isHighSmog
          ? isChildOrSenior
            ? `Shift ${m.name}'s outdoor activities ("${m.keyActivities}") indoors today and prioritize time in the HEPA-filtered clean-air room.`
            : `Adjust ${m.name}'s routine ("${m.keyActivities}") to avoid peak inversion (${air.peakWindow}), using enclosed transit/carpool or remote work where feasible.`
          : `${m.name} can keep scheduled activities ("${m.keyActivities}") during ${air.bestWindow}, avoiding heavy rush-hour roadside exposure.`,
        whySuggested: `${isChildOrSenior ? 'Children and older adults benefit from extra exposure caution' : 'Tailored to commute and daily exertion'} under ${air.cityName} ${aqi !== null ? `AQI ${aqi} (${air.category})` : 'unverified AQI'}.`,
        benefitDimension: 'Personal Exposure' as const,
      };
    });

    return {
      householdSummary: `Coordinated household strategy for ${members.length} member(s) in ${air.cityName} (${aqi !== null ? `AQI ${aqi}, ${air.category}` : 'AQI unavailable'}), balancing individual schedules, a shared clean-air room, and lower-emission family logistics.`,
      individualRoutines,
      sharedActivities: [
        {
          activity: 'Family Meals & Dinner Prep',
          plan: isHighSmog
            ? 'Cook lower-smoke dinners (steaming, baking, covered pots) with kitchen exhaust running and exterior windows sealed.'
            : 'Run kitchen exhaust during cooking and ventilate living space briefly during midday.',
          benefit: 'Protects shared indoor air quality for all household members.',
        },
        {
          activity: 'Errands & School / Activity Logistics',
          plan: `Consolidate household errands and drop-offs into a single shared trip during ${air.bestWindow} instead of separate solo drives.`,
          benefit: 'Cuts combined household tailpipe emissions and reduces roadside time.',
        },
      ],
      indoorAirPractices: [
        `Prioritize ${filtrationLabel(profile.filtration)} in bedrooms overnight and the main shared room during evening hours.`,
        'Keep exterior windows and door gaps sealed during morning/evening winter inversion peaks.',
        'Avoid indoor incense, candles, and unvented frying; damp-wipe floors rather than dry sweeping.',
      ],
      sustainableHouseholdChoices: [
        'Share one carpool or enclosed public transit pass for overlapping commuter/school routes.',
        'Batch weekly grocery and pharmacy pickups into one combined midday loop.',
        'Shift flexible household admin or work-from-home days onto severe smog forecast days.',
      ],
      publicHealthAdvisory:
        'Non-diagnostic household coordination plan. Follow official local school, workplace, and public-health smog advisories.',
      generatedAt: new Date().toISOString(),
    };
  },

  /**
   * Mid-Flight What-If Simulation Engine.
   * Simultaneously applies AQI/pollutant overrides, commute/travel changes, household size,
   * indoor filtration, activity preferences, and emission scenarios; detects conflicts between
   * user preferences and environmental reality; flags infeasible scenarios honestly.
   */
  runMidFlightWhatIfSimulation(
    originalAir: AirQualityReading,
    originalProfile: UserProfile,
    indoor: IndoorEnvironmentInput,
    simInput: WhatIfSimulationInput
  ): WhatIfSimulationResult {
    return executeMidFlightWhatIfSimulation(
      originalAir,
      originalProfile,
      indoor,
      simInput,
      RecommendationEngine.generateDailyActionPlan
    );
  },
};

function defaultActivityForLifestyle(
  lifestyle: UserProfile['lifestyle'],
  block: 'Morning' | 'Afternoon' | 'Evening'
): string {
  const map: Record<UserProfile['lifestyle'], Record<'Morning' | 'Afternoon' | 'Evening', string>> = {
    parent: {
      Morning: 'School drop-off & morning walk',
      Afternoon: 'Midday errands & school pickup',
      Evening: 'Family dinner & children’s play',
    },
    office_worker: {
      Morning: 'Morning commute to office',
      Afternoon: 'Lunch break & client errands',
      Evening: 'Evening commute & home unwind',
    },
    student: {
      Morning: 'Campus commute & morning classes',
      Afternoon: 'Library study & campus walk',
      Evening: 'Club sports / evening study',
    },
    fitness_enthusiast: {
      Morning: 'Morning outdoor run / training',
      Afternoon: 'Midday mobility & errands',
      Evening: 'Evening recovery walk & meal prep',
    },
    outdoor_worker: {
      Morning: 'Early outdoor work shift',
      Afternoon: 'Midday site tasks & break',
      Evening: 'Post-shift commute & indoor recovery',
    },
  };
  return map[lifestyle][block];
}

function filtrationLabel(f: UserProfile['filtration']): string {
  switch (f) {
    case 'hepa_purifier':
      return 'your portable True-HEPA purifier';
    case 'hvac_merv13':
      return 'central HVAC with MERV-13+ filtration';
    case 'diy_corsi_rosenthal':
      return 'your DIY MERV-13 box-fan purifier';
    case 'basic_ac_filter':
      return 'sealed rooms (note: basic AC mesh does not filter fine PM2.5)';
    case 'none':
      return 'window sealing & source control (no mechanical purifier installed)';
  }
}
