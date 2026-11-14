#pragma once

#include "HealthTypes.h"
#include "RiskModel.h"

namespace astro {

// Transparent rule engine + int8 model fusion.
// The rule engine is the "teacher"; the model is the fast on-device student.
// Fused score = 55% rules + 45% model (so the result stays explainable).
class RiskEngine {
 public:
  void begin(const HealthState& state);
  RiskScores evaluate(const Vitals& v, const MissionContext& m);
  const RiskScores& last() const { return last_; }
  void setBaseline(float hr, float hrv, float spo2, float tempC);

 private:
  RiskModel model_;
  RiskScores last_;
  float baselineHr_ = 72.0f;
  float baselineHrv_ = 45.0f;
  float baselineSpo2_ = 97.5f;
  float baselineTempC_ = 36.7f;

  void evaluateRules(const Vitals& v, const MissionContext& m, RiskScores& out) const;
};

}  // namespace astro
