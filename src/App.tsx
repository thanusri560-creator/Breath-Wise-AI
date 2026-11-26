import { AirQualityDashboard } from './components/AirQualityDashboard';
import { BreatheWiseLayout } from './components/BreatheWiseLayout';
import { DailyActionPlan } from './components/DailyActionPlan';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FamilyProfile } from './components/FamilyProfile';
import { GeminiAirAssistant } from './components/GeminiAirAssistant';
import { ImpactExplorer } from './components/ImpactExplorer';
import { IndoorAirGuide } from './components/IndoorAirGuide';
import { LowEmissionAlternatives } from './components/LowEmissionAlternatives';
import { OnboardingPanel } from './components/OnboardingPanel';
import { TestingSuiteConsole } from './components/TestingSuiteConsole';
import { useBreatheWise } from './hooks/useBreatheWise';

export default function App() {
  const bw = useBreatheWise();

  return (
    <BreatheWiseLayout
      activePage={bw.activePage}
      onSelectPage={bw.setActivePage}
      airQuality={bw.airQuality}
      cities={bw.cities}
      selectedCityId={bw.profile.cityId}
      onSelectCity={bw.selectPresetCity}
      onSelectLocation={bw.selectIndiaLocation}
      liveAqiConfigured={bw.liveAqiConfigured}
    >
      <ErrorBoundary>
        {bw.activePage === 'dashboard' && (
          <AirQualityDashboard
            airQuality={bw.airQuality}
            profile={bw.profile}
            dailyPlan={bw.dailyPlan}
            loading={bw.loadingAir}
            error={bw.airError}
            onRefresh={() => void bw.refreshAirQuality()}
            onNavigate={bw.setActivePage}
          />
        )}

        {bw.activePage === 'routine' && (
          <DailyActionPlan
            airQuality={bw.airQuality}
            profile={bw.profile}
            plan={bw.dailyPlan}
            isAiActive={bw.isAiDailyActive}
            loadingAi={Boolean(bw.aiLoading.routine)}
            aiNotice={bw.aiNotice.routine ?? null}
            onUpdateProfile={bw.updateProfile}
            onEnhanceWithGemini={(force) => void bw.enhanceDailyPlanWithGemini(force)}
          />
        )}

        {bw.activePage === 'indoor' && (
          <IndoorAirGuide
            airQuality={bw.airQuality}
            indoor={bw.indoor}
            guide={bw.indoorGuide}
            loadingAi={Boolean(bw.aiLoading.indoor)}
            aiNotice={bw.aiNotice.indoor ?? null}
            onUpdateIndoor={bw.updateIndoor}
            onEnhanceWithGemini={() => void bw.enhanceIndoorGuideWithGemini()}
          />
        )}

        {bw.activePage === 'alternatives' && (
          <LowEmissionAlternatives
            airQuality={bw.airQuality}
            plan={bw.lowEmissionPlan}
            loadingAi={Boolean(bw.aiLoading.alternatives)}
            aiNotice={bw.aiNotice.alternatives ?? null}
            onEnhanceWithGemini={() => void bw.enhanceLowEmissionWithGemini()}
          />
        )}

        {bw.activePage === 'impact' && (
          <ImpactExplorer
            airQuality={bw.airQuality}
            profile={bw.profile}
            indoor={bw.indoor}
            onAcceptChanges={(profilePatch, indoorPatch) => {
              bw.updateProfile(profilePatch);
              if (indoorPatch) bw.updateIndoor(indoorPatch);
            }}
          />
        )}

        {bw.activePage === 'assistant' && (
          <GeminiAirAssistant
            airQuality={bw.airQuality}
            profile={bw.profile}
            messages={bw.chatMessages}
            loading={Boolean(bw.aiLoading.chat)}
            notice={bw.aiNotice.chat ?? null}
            geminiConfigured={bw.geminiConfigured}
            onSendMessage={(q) => void bw.sendChatMessage(q)}
            onResetChat={bw.resetChat}
          />
        )}

        {bw.activePage === 'family' && (
          <FamilyProfile
            airQuality={bw.airQuality}
            members={bw.family}
            familyPlan={bw.familyPlan}
            loadingAi={Boolean(bw.aiLoading.family)}
            aiNotice={bw.aiNotice.family ?? null}
            onAddMember={bw.addFamilyMember}
            onRemoveMember={bw.removeFamilyMember}
            onEnhanceWithGemini={() => void bw.enhanceFamilyPlanWithGemini()}
          />
        )}

        {bw.activePage === 'onboarding' && (
          <OnboardingPanel
            profile={bw.profile}
            cities={bw.cities}
            onUpdateProfile={bw.updateProfile}
            onSelectPresetCity={bw.selectPresetCity}
            onSelectLocation={bw.selectIndiaLocation}
            onSetManualLocation={bw.setManualLocation}
            onFinish={bw.setActivePage}
          />
        )}

        {bw.activePage === 'testing' && <TestingSuiteConsole />}
      </ErrorBoundary>
    </BreatheWiseLayout>
  );
}
