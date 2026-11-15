#pragma once

#include "HealthTypes.h"

namespace astro {

// Int8-quantised MLP that complements the transparent rule engine.
// Architecture: 13 -> 16 (ReLU) -> 8 (ReLU) -> 6 (sigmoid).
// Weights/activations are int8; the output head is evaluated in float.
class RiskModel {
 public:
  bool begin();
  ModelOutput predict(const Vitals& v, const MissionContext& m);
  void buildFeatures(const Vitals& v, const MissionContext& m, float* out) const;

 private:
  ModelOutput last_;
};

}  // namespace astro
