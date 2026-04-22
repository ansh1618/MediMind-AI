export type RiskLevel = "critical" | "moderate" | "stable";

export interface VitalSigns {
  heartRate: number;
  systolicBP: number;
  diastolicBP: number;
  bloodPressure: string;
  temperature: number;
  oxygenSat: number;
  respiratoryRate: number;
  consciousness: "Alert" | "Voice" | "Pain" | "Unresponsive";
}

export interface RiskFactor {
  feature: string;
  contribution: number; // percentage contribution to risk score
  direction: "positive" | "negative"; // positive = increases risk
  value: string;
  threshold: string;
}

export interface MEWSScore {
  total: number;
  breakdown: {
    systolicBP: number;
    heartRate: number;
    respiratoryRate: number;
    temperature: number;
    consciousness: number;
  };
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: "Male" | "Female";
  condition: string;
  riskLevel: RiskLevel;
  riskScore: number;
  vitals: VitalSigns;
  admittedDate: string;
  department: string;
  aiPrediction?: string;
  trends: number[];
  mews: MEWSScore;
  riskFactors: RiskFactor[];
  comorbidities: string[];
  medications: string[];
  labResults: { name: string; value: string; flag: "normal" | "high" | "low" | "critical" }[];
}

function calculateMEWS(vitals: VitalSigns): MEWSScore {
  let sbp = 0;
  if (vitals.systolicBP <= 70) sbp = 3;
  else if (vitals.systolicBP <= 80) sbp = 2;
  else if (vitals.systolicBP <= 100) sbp = 1;
  else if (vitals.systolicBP <= 199) sbp = 0;
  else sbp = 2;

  let hr = 0;
  if (vitals.heartRate < 40) hr = 2;
  else if (vitals.heartRate <= 50) hr = 1;
  else if (vitals.heartRate <= 100) hr = 0;
  else if (vitals.heartRate <= 110) hr = 1;
  else if (vitals.heartRate <= 129) hr = 2;
  else hr = 3;

  let rr = 0;
  if (vitals.respiratoryRate < 9) rr = 2;
  else if (vitals.respiratoryRate <= 14) rr = 0;
  else if (vitals.respiratoryRate <= 20) rr = 1;
  else if (vitals.respiratoryRate <= 29) rr = 2;
  else rr = 3;

  let temp = 0;
  if (vitals.temperature < 35) temp = 2;
  else if (vitals.temperature <= 38.4) temp = 0;
  else temp = 2;

  let cons = 0;
  if (vitals.consciousness === "Alert") cons = 0;
  else if (vitals.consciousness === "Voice") cons = 1;
  else if (vitals.consciousness === "Pain") cons = 2;
  else cons = 3;

  return {
    total: sbp + hr + rr + temp + cons,
    breakdown: { systolicBP: sbp, heartRate: hr, respiratoryRate: rr, temperature: temp, consciousness: cons },
  };
}

export const patients: Patient[] = [
  {
    id: "P-1001",
    name: "Rajesh Sharma",
    age: 67,
    gender: "Male",
    condition: "Acute Myocardial Infarction",
    riskLevel: "critical",
    riskScore: 92,
    vitals: { heartRate: 112, systolicBP: 165, diastolicBP: 105, bloodPressure: "165/105", temperature: 38.2, oxygenSat: 89, respiratoryRate: 28, consciousness: "Alert" },
    admittedDate: "2026-04-06",
    department: "Cardiology",
    aiPrediction: "High risk of cardiac arrest within 6 hours. Immediate ICU transfer recommended.",
    trends: [78, 85, 88, 92, 90, 92],
    mews: calculateMEWS({ heartRate: 112, systolicBP: 165, diastolicBP: 105, bloodPressure: "165/105", temperature: 38.2, oxygenSat: 89, respiratoryRate: 28, consciousness: "Alert" }),
    riskFactors: [
      { feature: "Systolic BP", contribution: 25, direction: "positive", value: "165 mmHg", threshold: ">140 mmHg" },
      { feature: "SpO₂", contribution: 30, direction: "positive", value: "89%", threshold: "<92%" },
      { feature: "Troponin-I", contribution: 20, direction: "positive", value: "2.8 ng/mL", threshold: ">0.04 ng/mL" },
      { feature: "Heart Rate", contribution: 15, direction: "positive", value: "112 bpm", threshold: ">100 bpm" },
      { feature: "Age Factor", contribution: 10, direction: "positive", value: "67 years", threshold: ">65 years" },
    ],
    comorbidities: ["Hypertension", "Type 2 Diabetes", "Smoking (30 pack-years)"],
    medications: ["Aspirin 325mg", "Heparin drip", "Metoprolol 25mg", "Atorvastatin 80mg"],
    labResults: [
      { name: "Troponin-I", value: "2.8 ng/mL", flag: "critical" },
      { name: "BNP", value: "890 pg/mL", flag: "high" },
      { name: "Creatinine", value: "1.4 mg/dL", flag: "high" },
      { name: "HbA1c", value: "7.8%", flag: "high" },
    ],
  },
  {
    id: "P-1002",
    name: "Sunita Devi",
    age: 45,
    gender: "Female",
    condition: "Type 2 Diabetes — Hyperglycemia",
    riskLevel: "moderate",
    riskScore: 58,
    vitals: { heartRate: 88, systolicBP: 140, diastolicBP: 90, bloodPressure: "140/90", temperature: 37.1, oxygenSat: 95, respiratoryRate: 18, consciousness: "Alert" },
    admittedDate: "2026-04-05",
    department: "Endocrinology",
    aiPrediction: "Moderate risk of diabetic ketoacidosis. Monitor glucose levels every 2 hours.",
    trends: [42, 48, 55, 52, 58, 58],
    mews: calculateMEWS({ heartRate: 88, systolicBP: 140, diastolicBP: 90, bloodPressure: "140/90", temperature: 37.1, oxygenSat: 95, respiratoryRate: 18, consciousness: "Alert" }),
    riskFactors: [
      { feature: "HbA1c", contribution: 35, direction: "positive", value: "9.2%", threshold: ">6.5%" },
      { feature: "Blood Glucose", contribution: 30, direction: "positive", value: "340 mg/dL", threshold: ">200 mg/dL" },
      { feature: "Ketones (urine)", contribution: 20, direction: "positive", value: "Moderate", threshold: "Positive" },
      { feature: "Systolic BP", contribution: 15, direction: "positive", value: "140 mmHg", threshold: ">130 mmHg" },
    ],
    comorbidities: ["Obesity (BMI 34)", "Hyperlipidemia"],
    medications: ["Insulin Glargine 30u", "Metformin 1000mg", "Lisinopril 10mg"],
    labResults: [
      { name: "Blood Glucose", value: "340 mg/dL", flag: "critical" },
      { name: "HbA1c", value: "9.2%", flag: "high" },
      { name: "Potassium", value: "5.2 mEq/L", flag: "high" },
      { name: "Creatinine", value: "1.1 mg/dL", flag: "normal" },
    ],
  },
  {
    id: "P-1003",
    name: "Mohan Patel",
    age: 72,
    gender: "Male",
    condition: "COPD with Silent Hypoxia",
    riskLevel: "critical",
    riskScore: 87,
    vitals: { heartRate: 105, systolicBP: 150, diastolicBP: 95, bloodPressure: "150/95", temperature: 38.5, oxygenSat: 86, respiratoryRate: 32, consciousness: "Voice" },
    admittedDate: "2026-04-04",
    department: "Pulmonology",
    aiPrediction: "Severe exacerbation with silent hypoxia detected. ICU ventilator support required within 12 hours.",
    trends: [65, 70, 75, 80, 85, 87],
    mews: calculateMEWS({ heartRate: 105, systolicBP: 150, diastolicBP: 95, bloodPressure: "150/95", temperature: 38.5, oxygenSat: 86, respiratoryRate: 32, consciousness: "Voice" }),
    riskFactors: [
      { feature: "SpO₂ (Silent Hypoxia)", contribution: 35, direction: "positive", value: "86%", threshold: "<90%" },
      { feature: "Respiratory Rate", contribution: 25, direction: "positive", value: "32/min", threshold: ">24/min" },
      { feature: "Consciousness", contribution: 20, direction: "positive", value: "Voice-responsive", threshold: "Not Alert" },
      { feature: "Temperature", contribution: 10, direction: "positive", value: "38.5°C", threshold: ">38.0°C" },
      { feature: "pCO₂", contribution: 10, direction: "positive", value: "58 mmHg", threshold: ">45 mmHg" },
    ],
    comorbidities: ["COPD Stage IV", "Cor Pulmonale", "Former smoker (45 pack-years)"],
    medications: ["Salbutamol nebulizer", "Prednisolone 40mg", "Azithromycin 500mg", "Supplemental O₂ 4L/min"],
    labResults: [
      { name: "pCO₂", value: "58 mmHg", flag: "critical" },
      { name: "pO₂", value: "52 mmHg", flag: "critical" },
      { name: "WBC", value: "15,200/μL", flag: "high" },
      { name: "CRP", value: "89 mg/L", flag: "high" },
    ],
  },
  {
    id: "P-1004",
    name: "Anjali Gupta",
    age: 34,
    gender: "Female",
    condition: "Post-operative — Appendectomy",
    riskLevel: "stable",
    riskScore: 18,
    vitals: { heartRate: 72, systolicBP: 118, diastolicBP: 76, bloodPressure: "118/76", temperature: 36.8, oxygenSat: 98, respiratoryRate: 14, consciousness: "Alert" },
    admittedDate: "2026-04-07",
    department: "General Surgery",
    aiPrediction: "Recovery progressing well. Discharge expected in 24–48 hours.",
    trends: [30, 25, 22, 20, 18, 18],
    mews: calculateMEWS({ heartRate: 72, systolicBP: 118, diastolicBP: 76, bloodPressure: "118/76", temperature: 36.8, oxygenSat: 98, respiratoryRate: 14, consciousness: "Alert" }),
    riskFactors: [
      { feature: "Post-op Day", contribution: 40, direction: "negative", value: "Day 2", threshold: "Day 0-1" },
      { feature: "WBC Trend", contribution: 30, direction: "negative", value: "Normalizing", threshold: "Elevated" },
      { feature: "Pain Score", contribution: 30, direction: "negative", value: "3/10", threshold: ">5/10" },
    ],
    comorbidities: [],
    medications: ["Paracetamol 1g PRN", "Ondansetron 4mg PRN"],
    labResults: [
      { name: "WBC", value: "8,200/μL", flag: "normal" },
      { name: "Hemoglobin", value: "12.8 g/dL", flag: "normal" },
      { name: "CRP", value: "12 mg/L", flag: "normal" },
    ],
  },
  {
    id: "P-1005",
    name: "Vikram Singh",
    age: 56,
    gender: "Male",
    condition: "Atrial Fibrillation with Rapid Ventricular Response",
    riskLevel: "moderate",
    riskScore: 64,
    vitals: { heartRate: 132, systolicBP: 145, diastolicBP: 88, bloodPressure: "145/88", temperature: 37.0, oxygenSat: 93, respiratoryRate: 22, consciousness: "Alert" },
    admittedDate: "2026-04-06",
    department: "Cardiology",
    aiPrediction: "Irregular rhythm persists. Risk of stroke elevated — anticoagulation review needed. CHA₂DS₂-VASc score: 3.",
    trends: [50, 55, 58, 60, 62, 64],
    mews: calculateMEWS({ heartRate: 132, systolicBP: 145, diastolicBP: 88, bloodPressure: "145/88", temperature: 37.0, oxygenSat: 93, respiratoryRate: 22, consciousness: "Alert" }),
    riskFactors: [
      { feature: "Heart Rate", contribution: 35, direction: "positive", value: "132 bpm", threshold: ">100 bpm (irregular)" },
      { feature: "CHA₂DS₂-VASc", contribution: 25, direction: "positive", value: "Score 3", threshold: "≥2" },
      { feature: "Systolic BP", contribution: 20, direction: "positive", value: "145 mmHg", threshold: ">140 mmHg" },
      { feature: "BNP", contribution: 20, direction: "positive", value: "420 pg/mL", threshold: ">100 pg/mL" },
    ],
    comorbidities: ["Hypertension", "Previous TIA"],
    medications: ["Amiodarone 200mg", "Enoxaparin 80mg SC", "Amlodipine 5mg"],
    labResults: [
      { name: "BNP", value: "420 pg/mL", flag: "high" },
      { name: "TSH", value: "0.3 mIU/L", flag: "low" },
      { name: "INR", value: "1.8", flag: "normal" },
      { name: "Potassium", value: "4.1 mEq/L", flag: "normal" },
    ],
  },
  {
    id: "P-1006",
    name: "Kavita Reddy",
    age: 28,
    gender: "Female",
    condition: "Migraine with Aura",
    riskLevel: "stable",
    riskScore: 12,
    vitals: { heartRate: 68, systolicBP: 110, diastolicBP: 70, bloodPressure: "110/70", temperature: 36.6, oxygenSat: 99, respiratoryRate: 14, consciousness: "Alert" },
    admittedDate: "2026-04-08",
    department: "Neurology",
    trends: [15, 14, 13, 12, 12, 12],
    mews: calculateMEWS({ heartRate: 68, systolicBP: 110, diastolicBP: 70, bloodPressure: "110/70", temperature: 36.6, oxygenSat: 99, respiratoryRate: 14, consciousness: "Alert" }),
    riskFactors: [
      { feature: "Aura Duration", contribution: 50, direction: "negative", value: "20 min", threshold: ">60 min" },
      { feature: "BP", contribution: 50, direction: "negative", value: "110/70", threshold: "Normal" },
    ],
    comorbidities: [],
    medications: ["Sumatriptan 50mg PRN", "Ibuprofen 400mg"],
    labResults: [
      { name: "CBC", value: "Normal", flag: "normal" },
      { name: "ESR", value: "8 mm/hr", flag: "normal" },
    ],
  },
  {
    id: "P-1007",
    name: "Arun Nair",
    age: 61,
    gender: "Male",
    condition: "Pre-diabetic Kidney Stress (CKD Stage 3a)",
    riskLevel: "moderate",
    riskScore: 71,
    vitals: { heartRate: 94, systolicBP: 158, diastolicBP: 98, bloodPressure: "158/98", temperature: 37.2, oxygenSat: 94, respiratoryRate: 20, consciousness: "Alert" },
    admittedDate: "2026-04-05",
    department: "Nephrology",
    aiPrediction: "Declining eGFR trend detected. Risk of progression to Stage 3b within 6 months without intervention.",
    trends: [55, 58, 62, 65, 68, 71],
    mews: calculateMEWS({ heartRate: 94, systolicBP: 158, diastolicBP: 98, bloodPressure: "158/98", temperature: 37.2, oxygenSat: 94, respiratoryRate: 20, consciousness: "Alert" }),
    riskFactors: [
      { feature: "eGFR", contribution: 30, direction: "positive", value: "48 mL/min", threshold: "<60 mL/min" },
      { feature: "HbA1c", contribution: 25, direction: "positive", value: "6.4%", threshold: ">5.7% (pre-diabetic)" },
      { feature: "Systolic BP", contribution: 20, direction: "positive", value: "158 mmHg", threshold: ">130 mmHg" },
      { feature: "Proteinuria", contribution: 15, direction: "positive", value: "320 mg/day", threshold: ">150 mg/day" },
      { feature: "Age", contribution: 10, direction: "positive", value: "61 years", threshold: ">55 years" },
    ],
    comorbidities: ["Pre-diabetes", "Hypertension Stage 2", "Mild Proteinuria"],
    medications: ["Losartan 50mg", "Metformin 500mg", "Amlodipine 5mg"],
    labResults: [
      { name: "eGFR", value: "48 mL/min", flag: "low" },
      { name: "Creatinine", value: "1.6 mg/dL", flag: "high" },
      { name: "HbA1c", value: "6.4%", flag: "high" },
      { name: "Albumin:Creat", value: "320 mg/g", flag: "high" },
    ],
  },
  {
    id: "P-1008",
    name: "Priya Iyer",
    age: 52,
    gender: "Female",
    condition: "Pulmonary Embolism (Sub-massive)",
    riskLevel: "critical",
    riskScore: 89,
    vitals: { heartRate: 118, systolicBP: 95, diastolicBP: 60, bloodPressure: "95/60", temperature: 37.8, oxygenSat: 88, respiratoryRate: 30, consciousness: "Alert" },
    admittedDate: "2026-04-07",
    department: "Pulmonology",
    aiPrediction: "Sub-massive PE with RV strain. Thrombolysis window closing — decision needed within 2 hours.",
    trends: [60, 70, 78, 82, 86, 89],
    mews: calculateMEWS({ heartRate: 118, systolicBP: 95, diastolicBP: 60, bloodPressure: "95/60", temperature: 37.8, oxygenSat: 88, respiratoryRate: 30, consciousness: "Alert" }),
    riskFactors: [
      { feature: "D-Dimer", contribution: 25, direction: "positive", value: "4,200 ng/mL", threshold: ">500 ng/mL" },
      { feature: "RV/LV Ratio", contribution: 25, direction: "positive", value: "1.3", threshold: ">0.9" },
      { feature: "Hypotension", contribution: 20, direction: "positive", value: "95 mmHg", threshold: "<100 mmHg" },
      { feature: "SpO₂", contribution: 20, direction: "positive", value: "88%", threshold: "<92%" },
      { feature: "Tachycardia", contribution: 10, direction: "positive", value: "118 bpm", threshold: ">100 bpm" },
    ],
    comorbidities: ["Deep Vein Thrombosis (history)", "Oral Contraceptive use", "Long-haul flight 48h prior"],
    medications: ["Heparin 18u/kg/hr", "Morphine 2mg IV PRN", "Supplemental O₂ 6L/min"],
    labResults: [
      { name: "D-Dimer", value: "4,200 ng/mL", flag: "critical" },
      { name: "Troponin-I", value: "0.18 ng/mL", flag: "high" },
      { name: "BNP", value: "650 pg/mL", flag: "high" },
      { name: "ABG pH", value: "7.32", flag: "low" },
    ],
  },
  {
    id: "P-1009",
    name: "Deepak Joshi",
    age: 43,
    gender: "Male",
    condition: "Acute Pancreatitis (Gallstone-induced)",
    riskLevel: "moderate",
    riskScore: 55,
    vitals: { heartRate: 98, systolicBP: 128, diastolicBP: 82, bloodPressure: "128/82", temperature: 38.1, oxygenSat: 96, respiratoryRate: 20, consciousness: "Alert" },
    admittedDate: "2026-04-07",
    department: "Gastroenterology",
    aiPrediction: "Ranson score 3 at admission. Monitor for necrotizing pancreatitis over next 48 hours.",
    trends: [35, 40, 45, 48, 52, 55],
    mews: calculateMEWS({ heartRate: 98, systolicBP: 128, diastolicBP: 82, bloodPressure: "128/82", temperature: 38.1, oxygenSat: 96, respiratoryRate: 20, consciousness: "Alert" }),
    riskFactors: [
      { feature: "Lipase", contribution: 30, direction: "positive", value: "1,200 U/L", threshold: ">180 U/L" },
      { feature: "CRP", contribution: 25, direction: "positive", value: "145 mg/L", threshold: ">10 mg/L" },
      { feature: "WBC", contribution: 20, direction: "positive", value: "14,800/μL", threshold: ">11,000/μL" },
      { feature: "Temperature", contribution: 15, direction: "positive", value: "38.1°C", threshold: ">38.0°C" },
      { feature: "Ranson Score", contribution: 10, direction: "positive", value: "3", threshold: "≥3" },
    ],
    comorbidities: ["Cholelithiasis", "Obesity (BMI 31)", "Alcohol use (social)"],
    medications: ["IV Fluids (LR 250mL/hr)", "Morphine PCA", "Pantoprazole 40mg IV", "NPO"],
    labResults: [
      { name: "Lipase", value: "1,200 U/L", flag: "critical" },
      { name: "Amylase", value: "680 U/L", flag: "high" },
      { name: "WBC", value: "14,800/μL", flag: "high" },
      { name: "CRP", value: "145 mg/L", flag: "high" },
    ],
  },
  {
    id: "P-1010",
    name: "Meera Kulkarni",
    age: 39,
    gender: "Female",
    condition: "Postpartum Preeclampsia",
    riskLevel: "moderate",
    riskScore: 62,
    vitals: { heartRate: 92, systolicBP: 162, diastolicBP: 104, bloodPressure: "162/104", temperature: 37.0, oxygenSat: 97, respiratoryRate: 16, consciousness: "Alert" },
    admittedDate: "2026-04-06",
    department: "Obstetrics",
    aiPrediction: "Persistent severe-range BP post-delivery. Eclampsia risk if not controlled within 24 hours. Magnesium sulfate continuation recommended.",
    trends: [48, 52, 55, 58, 60, 62],
    mews: calculateMEWS({ heartRate: 92, systolicBP: 162, diastolicBP: 104, bloodPressure: "162/104", temperature: 37.0, oxygenSat: 97, respiratoryRate: 16, consciousness: "Alert" }),
    riskFactors: [
      { feature: "Systolic BP", contribution: 35, direction: "positive", value: "162 mmHg", threshold: ">160 mmHg" },
      { feature: "Proteinuria", contribution: 25, direction: "positive", value: "2+", threshold: "≥1+" },
      { feature: "Postpartum Day", contribution: 20, direction: "positive", value: "Day 3", threshold: "Day 0-7" },
      { feature: "Platelet Trend", contribution: 20, direction: "positive", value: "Declining", threshold: "<150K" },
    ],
    comorbidities: ["Gestational Hypertension (history)", "Primigravida"],
    medications: ["MgSO₄ 2g/hr IV", "Nifedipine 30mg", "Labetalol 200mg"],
    labResults: [
      { name: "Platelets", value: "142,000/μL", flag: "low" },
      { name: "AST", value: "52 U/L", flag: "high" },
      { name: "LDH", value: "310 U/L", flag: "high" },
      { name: "Uric Acid", value: "7.2 mg/dL", flag: "high" },
    ],
  },
];

export const getRiskColor = (level: RiskLevel) => {
  switch (level) {
    case "critical": return "critical";
    case "moderate": return "warning";
    case "stable": return "success";
  }
};

export const getMEWSUrgency = (score: number): { label: string; color: string; action: string } => {
  if (score >= 7) return { label: "Immediate", color: "critical", action: "Immediate medical team assessment" };
  if (score >= 5) return { label: "Urgent", color: "critical", action: "Urgent clinical review within 30 min" };
  if (score >= 3) return { label: "Increased", color: "warning", action: "Increase monitoring frequency" };
  if (score >= 1) return { label: "Low", color: "warning", action: "Continue routine monitoring" };
  return { label: "Routine", color: "success", action: "Standard care pathway" };
};

export const sortByMEWS = (patientList: Patient[]): Patient[] => {
  return [...patientList].sort((a, b) => b.mews.total - a.mews.total);
};
