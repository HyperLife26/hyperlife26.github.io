#include "RiskEngine.h"
#include <math.h>
unsigned long millis(){ return 0; }
unsigned long micros(){ return 0; }
static astro::RiskEngine g_engine;
static float g_out[16];
extern "C" __attribute__((export_name("hw_begin"))) void hw_begin(float bhr,float bhrv,float bspo2,float btemp){
  astro::HealthState s; s.baselineHr=bhr; s.baselineHrv=bhrv; s.baselineSpo2=bspo2; s.baselineTempC=btemp; g_engine.begin(s);
}
extern "C" __attribute__((export_name("hw_out"))) float* hw_out(){ return g_out; }
extern "C" __attribute__((export_name("hw_evaluate"))) void hw_evaluate(
  float hr,float hrv,float spo2,float temp,float slope,float activity,
  float sleep,float day,float gravity,float rad,float age,float cvd,float symptom,
  float cumRad
){
  astro::Vitals v; v.hr=hr; v.hrv=hrv; v.spo2=spo2; v.skinTempC=temp; v.tempSlopeCPerH=slope;
  v.activityIndex=activity; v.fingerPresent=true; v.valid=true; v.symptomFlag=symptom>0.5f;
  astro::MissionContext m; m.sleepHours24h=sleep; m.missionDay=(uint16_t)day; m.gravityG=gravity;
  m.dailyRadiationmSv=rad; m.age=(uint8_t)age; m.knownCVD=cvd>0.5f; m.cumulativeRadiationmSv=cumRad;
  astro::RiskScores r=g_engine.evaluate(v,m);
  for(int i=0;i<5;i++){ g_out[i]=r.risk[i]; g_out[5+i]=r.modelRisk[i]; g_out[10+i]=r.ruleRisk[i]; }
  g_out[15]=r.cardiacEventProb;
}
