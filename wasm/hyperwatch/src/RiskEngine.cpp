#include "RiskEngine.h"

#include <math.h>

namespace astro {

void RiskEngine::begin(const HealthState& state) {
  baselineHr_ = state.baselineHr;
  baselineHrv_ = state.baselineHrv;
  baselineSpo2_ = state.baselineSpo2;
  baselineTempC_ = state.baselineTempC;
  model_.begin();
  last_ = RiskScores();
}

void RiskEngine::setBaseline(float hr, float hrv, float spo2, float tempC) {
  baselineHr_ = hr;
  baselineHrv_ = hrv;
  baselineSpo2_ = spo2;
  baselineTempC_ = tempC;
}

// Transparent rule baseline for the five risk domains.
void RiskEngine::evaluateRules(const Vitals& v, const MissionContext& m,
                               RiskScores& out) const {
  const float hr = v.hr;
  const float hrv = v.hrv;
  const float spo2 = v.spo2;
  const float temp = v.skinTempC;
  const float activity = v.activityIndex;
  const float sleep = m.sleepHours24h;
  const float day = (float)m.missionDay;
  const float gravity = m.gravityG;
  const float dailyRad = m.dailyRadiationmSv;
  const float age = (float)m.age;
  const float cvd = m.knownCVD ? 1.0f : 0.0f;
  const float symptom = v.symptomFlag ? 1.0f : 0.0f;
  const float cumRad = m.cumulativeRadiationmSv;

  // --- cardiovascular ---
  const float hrRisk = clampf((fabsf(hr - 72.0f) - 12.0f) * 1.5f, 0.0f, 40.0f);
  const float spo2Risk = clampf((96.0f - spo2) * 7.0f, 0.0f, 40.0f);
  const float hrvRisk = clampf((40.0f - hrv) * 0.7f, 0.0f, 18.0f);
  const float tempRisk = clampf((temp - 37.3f) * 18.0f, 0.0f, 15.0f);
  const float decond = clampf((day / 180.0f) * (1.0f - gravity) * 20.0f, 0.0f, 18.0f);
  const float ageRisk = clampf((age - 45.0f) * 0.4f, 0.0f, 8.0f);
  const float cardio = clampf(hrRisk + spo2Risk + hrvRisk + tempRisk + decond +
                              ageRisk + 12.0f * cvd, 0.0f, 100.0f);

  // --- bone: ~1.25%/month weight-bearing loss in microgravity ---
  const float boneLossPct = estimatedBoneLossPercent(
      m.missionDay, gravity, activity, m.age);
  const float bone = clampf(boneLossPct * 6.5f, 0.0f, 100.0f);

  // --- immune ---
  const float tempDev = fabsf(temp - 36.6f);
  const float immune = clampf(
      clampf(tempDev * 22.0f, 0.0f, 28.0f) +
      clampf((7.5f - sleep) * 7.0f, 0.0f, 30.0f) +
      clampf(dailyRad * 10.0f, 0.0f, 18.0f) +
      clampf(day * 0.07f, 0.0f, 14.0f) +
      clampf(activity * 0.08f, 0.0f, 8.0f),
      0.0f, 100.0f);

  // --- radiation (600 mSv career reference) ---
  // Career dose + current dose rate + acute solar-particle-event term.
  const float acuteRad = clampf((dailyRad - 1.0f) * 4.0f, 0.0f, 20.0f);
  const float radiation = clampf(
      clampf(cumRad / 600.0f * 85.0f, 0.0f, 85.0f) +
      clampf(dailyRad * 5.0f, 0.0f, 15.0f) + acuteRad,
      0.0f, 100.0f);

  // --- sleep / behavioural ---
  const float sleepRisk = clampf(
      clampf((8.0f - sleep) * 8.0f, 0.0f, 50.0f) +
      clampf(day * 0.06f, 0.0f, 20.0f) +
      clampf((activity - 55.0f) * 0.5f, 0.0f, 15.0f),
      0.0f, 100.0f);

  out.ruleRisk[RISK_CARDIO] = cardio;
  out.ruleRisk[RISK_BONE] = bone;
  out.ruleRisk[RISK_IMMUNE] = immune;
  out.ruleRisk[RISK_RADIATION] = radiation;
  out.ruleRisk[RISK_SLEEP] = sleepRisk;

  // --- acute cardiac event (hybrid, NOT a diagnosis) ---
  float acute = 0.0f;
  if (hr > 140.0f || hr < 45.0f) acute += 0.30f;
  if (spo2 < 90.0f) acute += 0.30f;
  if (hrv < 15.0f) acute += 0.15f;
  if (temp > 38.5f) acute += 0.10f;
  if (cvd > 0.5f) acute += 0.10f;
  if (symptom > 0.5f) acute += 0.35f;
  acute += 0.10f * (cardio / 100.0f);
  out.cardiacEventProb = clampf(acute, 0.0f, 1.0f);
}

RiskScores RiskEngine::evaluate(const Vitals& v, const MissionContext& m) {
  RiskScores out;

  // When the snapshot is not trustworthy, evaluate the physiological terms
  // against the crew member's own baseline rather than zeros. A disconnected
  // probe must not look like severe bradycardia/hypoxia and trigger a false
  // cardiac alert. A manually reported symptom still raises the alert.
  Vitals input = v;
  if (!v.valid) {
    input.hr = baselineHr_;
    input.hrv = baselineHrv_;
    input.spo2 = baselineSpo2_;
    input.skinTempC = baselineTempC_;
    input.tempSlopeCPerH = 0.0f;
    input.activityIndex = 0.0f;
  }

  evaluateRules(input, m, out);
  const ModelOutput ml = model_.predict(input, m);
  out.ml = ml;

  for (uint8_t i = 0; i < RISK_COUNT; ++i) {
    out.modelRisk[i] = ml.risk[i];
    out.risk[i] = clampf(0.55f * out.ruleRisk[i] + 0.45f * ml.risk[i], 0.0f, 100.0f);
    out.band[i] = bandFor(out.risk[i]);
  }

  out.cardiacEventProb = fmaxf(out.cardiacEventProb, ml.cardiacEventProb);
  if (input.symptomFlag) out.cardiacEventProb = fmaxf(out.cardiacEventProb, 0.55f);

  out.composite = 0.30f * out.risk[RISK_CARDIO] +
                  0.20f * out.risk[RISK_BONE] +
                  0.20f * out.risk[RISK_IMMUNE] +
                  0.15f * out.risk[RISK_RADIATION] +
                  0.15f * out.risk[RISK_SLEEP];
  out.composite = clampf(out.composite, 0.0f, 100.0f);
  out.compositeBand = bandFor(out.composite);

  out.cardiacAlert = (out.cardiacEventProb >= 0.65f) ||
                     (input.spo2 < 88.0f && input.hr > 120.0f) ||
                     input.symptomFlag;

  if (out.cardiacAlert) {
    out.composite = fmaxf(out.composite, 85.0f);
    out.compositeBand = bandFor(out.composite);
  }

  out.dataUnreliable = !v.valid || !v.fingerPresent;

  last_ = out;
  return out;
}

}  // namespace astro
