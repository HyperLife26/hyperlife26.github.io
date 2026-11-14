#pragma once

#include <Arduino.h>

namespace astro {

// ---------------------------------------------------------------------------
// Risk domains. These map to NASA HRP risks:
//   CARDIO    -> Risk of Cardiovascular Adaptations
//   BONE      -> Risk of Spaceflight-Induced Bone Changes
//   IMMUNE    -> Risk of Altered Immune System Responses
//   RADIATION -> Risk of Radiation-Induced Cancers
//   SLEEP     -> Isolation / sleep / behavioural risk
// ---------------------------------------------------------------------------
constexpr uint8_t RISK_COUNT = 5;

enum RiskIndex : uint8_t {
  RISK_CARDIO = 0,
  RISK_BONE = 1,
  RISK_IMMUNE = 2,
  RISK_RADIATION = 3,
  RISK_SLEEP = 4
};

enum RiskBand : uint8_t {
  BAND_LOW = 0,
  BAND_MODERATE = 1,
  BAND_HIGH = 2,
  BAND_CRITICAL = 3
};

enum MissionPhase : uint8_t {
  PHASE_PRELAUNCH = 0,
  PHASE_LAUNCH = 1,
  PHASE_MICROGRAVITY = 2,
  PHASE_TRANSIT = 3,
  PHASE_SURFACE = 4,
  PHASE_RETURN = 5,
  PHASE_POSTFLIGHT = 6
};

enum Scenario : uint8_t {
  SCENARIO_NORMAL = 0,
  SCENARIO_CARDIAC_EVENT = 1,
  SCENARIO_RADIATION_STORM = 2,
  SCENARIO_BONE_FLARE = 3,
  SCENARIO_IMMUNE_FLARE = 4,
  SCENARIO_COUNT = 5
};

enum Sex : uint8_t {
  SEX_UNKNOWN = 0,
  SEX_FEMALE = 1,
  SEX_MALE = 2
};

// ---------------------------------------------------------------------------
// One vitals snapshot. `valid` means the source produced a usable reading.
// `symptomFlag` is a manual "chest pain / not feeling right" input.
// ---------------------------------------------------------------------------
struct Vitals {
  float hr = 0.0f;
  float hrv = 0.0f;
  float spo2 = 0.0f;
  float skinTempC = 0.0f;
  float tempSlopeCPerH = 0.0f;
  float activityIndex = 0.0f;
  bool fingerPresent = false;
  bool valid = false;
  bool symptomFlag = false;
  uint32_t timestampMs = 0;

  // Environmental / motion inputs. These are populated by the production
  // build and stay at their defaults in the demo.
  float co2Ppm = 0.0f;
  bool co2Valid = false;
  uint32_t steps = 0;
  bool motionValid = false;
};

// ---------------------------------------------------------------------------
// Mission / crew context. Persisted in NVS.
// ---------------------------------------------------------------------------
struct MissionContext {
  char crewId[12] = "ASTRO-01";
  uint8_t age = 42;
  uint8_t sex = SEX_FEMALE;
  float heightCm = 170.0f;
  float weightKg = 70.0f;
  bool knownCVD = false;
  bool hypertension = false;
  bool diabetes = false;
  bool smoker = false;

  MissionPhase phase = PHASE_MICROGRAVITY;
  uint16_t missionDay = 42;
  float gravityG = 0.0f;
  float shieldingFactor = 1.0f;
  float dailyRadiationmSv = 0.5f;
  float cumulativeRadiationmSv = 21.0f;
  float sleepHours24h = 6.5f;
  uint16_t exerciseMinutes24h = 45;
  uint16_t isolationDays = 42;
  float dayRemainder = 0.0f;  // fractional mission-day accumulator
};

// ---------------------------------------------------------------------------
// Quantised-model output.
// ---------------------------------------------------------------------------
struct ModelOutput {
  float risk[RISK_COUNT] = {0, 0, 0, 0, 0};  // 0..100
  float cardiacEventProb = 0.0f;             // 0..1
  bool ran = false;
  uint32_t inferenceUs = 0;
  uint8_t version = 1;
};

// ---------------------------------------------------------------------------
// Fused output: rule engine + model.
// ---------------------------------------------------------------------------
struct RiskScores {
  float risk[RISK_COUNT] = {0, 0, 0, 0, 0};       // fused 0..100
  float ruleRisk[RISK_COUNT] = {0, 0, 0, 0, 0};   // transparent rules
  float modelRisk[RISK_COUNT] = {0, 0, 0, 0, 0};  // int8 model
  float cardiacEventProb = 0.0f;
  float composite = 0.0f;
  RiskBand band[RISK_COUNT] = {BAND_LOW, BAND_LOW, BAND_LOW, BAND_LOW, BAND_LOW};
  RiskBand compositeBand = BAND_LOW;
  bool cardiacAlert = false;
  bool dataUnreliable = false;
  ModelOutput ml;  // raw model output + inference timing for diagnostics
};

// ---------------------------------------------------------------------------
// Persisted health history / baselines.
// ---------------------------------------------------------------------------
struct HealthState {
  float baselineHr = 72.0f;
  float baselineHrv = 45.0f;
  float baselineSpo2 = 97.5f;
  float baselineTempC = 36.7f;
  float boneLossPercent = 0.0f;
  float cumulativeRadiationmSv = 0.0f;
  float sleepDebtHours = 0.0f;
  float lastComposite = 0.0f;
  uint16_t lastMissionDay = 0;
  uint32_t modelGeneration = 1;

  // Motion / environment history persisted across reboots.
  uint32_t stepCount = 0;
  float measuredSleepHours24h = 0.0f;
  uint16_t measuredExerciseMinutes24h = 0;
  float lastCo2Ppm = 0.0f;
};

// ---------------------------------------------------------------------------
// Small helpers.
// ---------------------------------------------------------------------------
inline float clampf(float x, float lo, float hi) {
  return (x < lo) ? lo : ((x > hi) ? hi : x);
}

// Modelled weight-bearing bone loss, following NASA's reported ~1-1.5 % per
// month in microgravity. `activityIndex` is 0..100 (measured or estimated).
// This is an estimate, not a bone-density measurement.
inline float estimatedBoneLossPercent(uint16_t missionDay, float gravityG,
                                      float activityIndex, uint8_t age) {
  const float months = (float)missionDay / 30.0f;
  const float exerciseMod = clampf(1.0f - activityIndex / 250.0f, 0.55f, 1.0f);
  const float ageMod = 1.0f + ((age > 40) ? (float)(age - 40) * 0.012f : 0.0f);
  return 1.25f * months * (1.0f - gravityG) * exerciseMod * ageMod;
}

inline RiskBand bandFor(float score) {
  if (score < 25.0f) return BAND_LOW;
  if (score < 50.0f) return BAND_MODERATE;
  if (score < 75.0f) return BAND_HIGH;
  return BAND_CRITICAL;
}

// Cabin air-quality band for a CO2 reading. This is an environmental index,
// not a radiation measurement.
inline const char* airQualityText(float ppm) {
  if (ppm < 800.0f) return "GOOD";
  if (ppm < 1000.0f) return "ELEVATED";
  if (ppm < 1500.0f) return "POOR";
  return "VERY POOR";
}

inline const char* bandText(RiskBand b) {
  switch (b) {
    case BAND_LOW: return "LOW";
    case BAND_MODERATE: return "MOD";
    case BAND_HIGH: return "HIGH";
    case BAND_CRITICAL: return "CRIT";
  }
  return "?";
}

inline const char* riskName(uint8_t idx) {
  switch (idx) {
    case RISK_CARDIO: return "CARDIO";
    case RISK_BONE: return "BONE";
    case RISK_IMMUNE: return "IMMUNE";
    case RISK_RADIATION: return "RAD";
    case RISK_SLEEP: return "SLEEP";
  }
  return "?";
}

inline const char* riskShort(uint8_t idx) {
  switch (idx) {
    case RISK_CARDIO: return "CAR";
    case RISK_BONE: return "BON";
    case RISK_IMMUNE: return "IMM";
    case RISK_RADIATION: return "RAD";
    case RISK_SLEEP: return "SLP";
  }
  return "?";
}

inline const char* phaseText(MissionPhase p) {
  switch (p) {
    case PHASE_PRELAUNCH: return "PRELAUNCH";
    case PHASE_LAUNCH: return "LAUNCH";
    case PHASE_MICROGRAVITY: return "MICROGRAV";
    case PHASE_TRANSIT: return "TRANSIT";
    case PHASE_SURFACE: return "SURFACE";
    case PHASE_RETURN: return "RETURN";
    case PHASE_POSTFLIGHT: return "POSTFLIGHT";
  }
  return "UNKNOWN";
}

inline const char* scenarioText(Scenario s) {
  switch (s) {
    case SCENARIO_NORMAL: return "NOMINAL";
    case SCENARIO_CARDIAC_EVENT: return "CARDIAC EVENT";
    case SCENARIO_RADIATION_STORM: return "RADIATION STORM";
    case SCENARIO_BONE_FLARE: return "BONE FLARE";
    case SCENARIO_IMMUNE_FLARE: return "IMMUNE FLARE";
    default: return "?";
  }
}

}  // namespace astro
