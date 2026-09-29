export interface ClinicalScenario {
  id: string;
  title: string;
  category: string;
  chiefComplaint: string;
  initialUtterance: string;
  expectedTriage: 'routine' | 'urgent' | 'emergency';
  organSystem: string;
  followUpResponses: string[];
}

export const CLINICAL_SCENARIOS: ClinicalScenario[] = [
  {
    id: 'acs-chest-pain',
    title: 'Acute Crushing Chest Pain',
    category: 'Cardiovascular',
    chiefComplaint: 'Retrosternal chest pressure with radiation to jaw & left arm',
    initialUtterance:
      "Doctor, I've had this heavy crushing pressure in the middle of my chest for about an hour. It feels like an elephant sitting on my chest, radiating into my left shoulder and jaw. I'm feeling clammy and nauseous.",
    expectedTriage: 'emergency',
    organSystem: 'Cardiovascular',
    followUpResponses: [
      "The pain is about an 8 out of 10. It started suddenly while resting after lunch.",
      "Yes, I have high blood pressure and take Amlodipine 10mg. My father had a heart attack at 52.",
      "I'm allergic to Penicillin. I haven't taken any nitroglycerin or aspirin today.",
    ],
  },
  {
    id: 'migraine-aura',
    title: 'Severe Migraine with Visual Aura',
    category: 'Neurological',
    chiefComplaint: 'Unilateral pulsatile headache with photophobia & scintillating scotoma',
    initialUtterance:
      "I have this intense throbbing pain behind my right temple that started 3 hours ago. On a scale of 1 to 10 it's definitely an 8. I started seeing shimmering zig-zag lines in my vision right before it hit.",
    expectedTriage: 'urgent',
    organSystem: 'Neurological',
    followUpResponses: [
      "Bright lights and computer screens make it much worse. I had to lie down in a dark room.",
      "No neck stiffness or fever, but I feel quite nauseous. No numbness or weakness in my face or arms.",
      "I don't have regular medications, but I took two Ibuprofen 400mg an hour ago with little relief.",
    ],
  },
  {
    id: 'appendicitis-rlq',
    title: 'Acute Right Lower Quadrant Pain',
    category: 'Gastrointestinal',
    chiefComplaint: 'Migratory abdominal pain settling in RLQ with anorexia and low fever',
    initialUtterance:
      "My stomach began aching around my belly button yesterday, but overnight the pain shifted down to my lower right side. Now it's sharp, about a 7 out of 10, especially when I walk or cough.",
    expectedTriage: 'urgent',
    organSystem: 'Gastrointestinal',
    followUpResponses: [
      "I haven't been able to eat anything today because food makes me feel sick to my stomach.",
      "I checked my temperature an hour ago and it was 100.4°F (38°C).",
      "No past surgeries. I don't have any chronic conditions or known drug allergies.",
    ],
  },
  {
    id: 'asthma-wheezing',
    title: 'Acute Dyspnea & Bronchospasm',
    category: 'Respiratory',
    chiefComplaint: 'Shortness of breath, expiratory wheezing, refractory to bronchodilator',
    initialUtterance:
      "I have tight wheezing in my chest and difficulty catching my breath since this morning after jogging in cold air. My albuterol rescue inhaler only gave me relief for about 15 minutes.",
    expectedTriage: 'urgent',
    organSystem: 'Respiratory',
    followUpResponses: [
      "I would rate the breathlessness as a 6 out of 10. It takes effort to speak in full sentences.",
      "I've had mild asthma since childhood. I take Flovent daily but missed my dose yesterday.",
      "I am severely allergic to sulfa antibiotics.",
    ],
  },
  {
    id: 'sciatica-lumbar',
    title: 'Lumbar Strain with Sciatic Radiculopathy',
    category: 'Musculoskeletal',
    chiefComplaint: 'Acute lower back pain with electric shock sensation down right posterior leg',
    initialUtterance:
      "I was lifting heavy garden mulch two days ago and felt a pop in my lower back. Since then, an electric burning pain shoots down my right buttock past my knee into my foot.",
    expectedTriage: 'routine',
    organSystem: 'Musculoskeletal',
    followUpResponses: [
      "Sitting down or bending forward makes it flare up to an 8/10. Lying flat helps slightly.",
      "No loss of bladder or bowel control, and no numbness in my groin area.",
      "I have no prior spine surgeries. I've just been using an ice pack and Acetaminophen.",
    ],
  },
];
