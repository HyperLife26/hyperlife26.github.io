#include "RiskModel.h"
#include "risk_model_weights.h"

#include <math.h>

namespace astro {
namespace {

inline int8_t quantise(float x, float scale, int8_t zeroPoint) {
  float q = roundf(x / scale) + (float)zeroPoint;
  if (q < -128.0f) q = -128.0f;
  if (q > 127.0f) q = 127.0f;
  return (int8_t)q;
}

inline float sigmoidf(float x) {
  if (x > 40.0f) return 1.0f;
  if (x < -40.0f) return 0.0f;
  return 1.0f / (1.0f + expf(-x));
}

}  // namespace

bool RiskModel::begin() {
  last_ = ModelOutput();
  last_.version = 1;
  return true;
}

// Feature order is the model's fixed input contract.
void RiskModel::buildFeatures(const Vitals& v, const MissionContext& m, float* out) const {
  out[0] = clampf((v.hr - 40.0f) / 140.0f, 0.0f, 1.0f);
  out[1] = clampf(v.hrv / 120.0f, 0.0f, 1.0f);
  out[2] = clampf((v.spo2 - 85.0f) / 15.0f, 0.0f, 1.0f);
  out[3] = clampf((v.skinTempC - 34.0f) / 6.0f, 0.0f, 1.0f);
  out[4] = clampf((v.tempSlopeCPerH + 0.5f) / 1.0f, 0.0f, 1.0f);
  out[5] = clampf(v.activityIndex / 100.0f, 0.0f, 1.0f);
  out[6] = clampf(m.sleepHours24h / 12.0f, 0.0f, 1.0f);
  out[7] = clampf((float)m.missionDay / 365.0f, 0.0f, 1.0f);
  out[8] = clampf(m.gravityG, 0.0f, 1.0f);
  out[9] = clampf(m.dailyRadiationmSv / 5.0f, 0.0f, 1.0f);
  out[10] = clampf((m.age - 18.0f) / 62.0f, 0.0f, 1.0f);
  out[11] = m.knownCVD ? 1.0f : 0.0f;
  out[12] = v.symptomFlag ? 1.0f : 0.0f;
}

ModelOutput RiskModel::predict(const Vitals& v, const MissionContext& m) {
  ModelOutput out;
  out.version = 1;

  float features[model::INPUT_SIZE];
  buildFeatures(v, m, features);

  int8_t in[model::INPUT_SIZE];
  for (uint8_t i = 0; i < model::INPUT_SIZE; ++i) {
    in[i] = quantise(features[i], model::INPUT_SCALE, model::INPUT_ZERO_POINT);
  }

  const uint32_t t0 = micros();

  int8_t h1[model::HIDDEN1_SIZE];
  for (uint8_t o = 0; o < model::HIDDEN1_SIZE; ++o) {
    int32_t acc = model::B1[o];
    for (uint8_t i = 0; i < model::INPUT_SIZE; ++i) {
      acc += (int32_t)(in[i] - model::INPUT_ZERO_POINT) *
             (int32_t)model::W1[o * model::INPUT_SIZE + i];
    }
    float x = (float)acc * model::INPUT_SCALE * model::L1_W_SCALE;
    if (x < 0.0f) x = 0.0f;
    h1[o] = quantise(x, model::L1_OUT_SCALE, model::L1_OUT_ZERO_POINT);
  }

  int8_t h2[model::HIDDEN2_SIZE];
  for (uint8_t o = 0; o < model::HIDDEN2_SIZE; ++o) {
    int32_t acc = model::B2[o];
    for (uint8_t i = 0; i < model::HIDDEN1_SIZE; ++i) {
      acc += (int32_t)(h1[i] - model::L1_OUT_ZERO_POINT) *
             (int32_t)model::W2[o * model::HIDDEN1_SIZE + i];
    }
    float x = (float)acc * model::L1_OUT_SCALE * model::L2_W_SCALE;
    if (x < 0.0f) x = 0.0f;
    h2[o] = quantise(x, model::L2_OUT_SCALE, model::L2_OUT_ZERO_POINT);
  }

  float logits[model::OUTPUT_SIZE];
  for (uint8_t o = 0; o < model::OUTPUT_SIZE; ++o) {
    int32_t acc = model::B3[o];
    for (uint8_t i = 0; i < model::HIDDEN2_SIZE; ++i) {
      acc += (int32_t)(h2[i] - model::L2_OUT_ZERO_POINT) *
             (int32_t)model::W3[o * model::HIDDEN2_SIZE + i];
    }
    logits[o] = (float)acc * model::L2_OUT_SCALE * model::L3_W_SCALE;
  }

  out.inferenceUs = micros() - t0;

  for (uint8_t i = 0; i < RISK_COUNT; ++i) {
    out.risk[i] = sigmoidf(logits[i]) * 100.0f;
  }
  out.cardiacEventProb = sigmoidf(logits[RISK_COUNT]);
  out.ran = true;

  last_ = out;
  return out;
}

}  // namespace astro
