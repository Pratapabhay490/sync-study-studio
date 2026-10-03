import type { Subject, Topic } from "./data-context";

/**
 * Sample catalogue shown to guests so they can explore the app without an
 * account. Progress stays empty and every write action asks them to sign up.
 */
const now = new Date().toISOString();

export const GUEST_SUBJECTS: Subject[] = [
  { id: "guest-sub-anatomy", name: "Anatomy", icon: "Bone", created_by: null, created_at: now },
  { id: "guest-sub-physiology", name: "Physiology", icon: "Heart", created_by: null, created_at: now },
  { id: "guest-sub-biochemistry", name: "Biochemistry", icon: "FlaskConical", created_by: null, created_at: now },
];

export const GUEST_TOPICS: Topic[] = [
  // Anatomy
  { id: "guest-t-ana-1", subject_id: "guest-sub-anatomy", topic_name: "Brachial plexus", description: "Roots, trunks, divisions, cords and branches", added_by: null, created_at: now },
  { id: "guest-t-ana-2", subject_id: "guest-sub-anatomy", topic_name: "Heart: chambers & valves", description: "Right/left heart flow and valve auscultation areas", added_by: null, created_at: now },
  { id: "guest-t-ana-3", subject_id: "guest-sub-anatomy", topic_name: "Femoral triangle", description: "Boundaries, contents and clinical correlates", added_by: null, created_at: now },
  { id: "guest-t-ana-4", subject_id: "guest-sub-anatomy", topic_name: "Circle of Willis", description: "Arteries forming the cerebral arterial circle", added_by: null, created_at: now },
  { id: "guest-t-ana-5", subject_id: "guest-sub-anatomy", topic_name: "Rotator cuff muscles", description: "SITS muscles: origin, insertion, action", added_by: null, created_at: now },
  // Physiology
  { id: "guest-t-phy-1", subject_id: "guest-sub-physiology", topic_name: "Cardiac cycle", description: "Phases, pressures and heart sounds", added_by: null, created_at: now },
  { id: "guest-t-phy-2", subject_id: "guest-sub-physiology", topic_name: "GFR regulation", description: "Autoregulation, tubuloglomerular feedback", added_by: null, created_at: now },
  { id: "guest-t-phy-3", subject_id: "guest-sub-physiology", topic_name: "Action potential", description: "Ionic basis in neurons and myocytes", added_by: null, created_at: now },
  { id: "guest-t-phy-4", subject_id: "guest-sub-physiology", topic_name: "Oxygen–hemoglobin curve", description: "Factors shifting the dissociation curve", added_by: null, created_at: now },
  { id: "guest-t-phy-5", subject_id: "guest-sub-physiology", topic_name: "HPA axis", description: "CRH–ACTH–cortisol regulation and feedback", added_by: null, created_at: now },
  // Biochemistry
  { id: "guest-t-bio-1", subject_id: "guest-sub-biochemistry", topic_name: "Glycolysis", description: "Steps, enzymes and energetics", added_by: null, created_at: now },
  { id: "guest-t-bio-2", subject_id: "guest-sub-biochemistry", topic_name: "Krebs cycle", description: "Reactions, regulation and amphibolic role", added_by: null, created_at: now },
  { id: "guest-t-bio-3", subject_id: "guest-sub-biochemistry", topic_name: "Urea cycle", description: "Steps, enzymes and associated disorders", added_by: null, created_at: now },
  { id: "guest-t-bio-4", subject_id: "guest-sub-biochemistry", topic_name: "Fatty acid oxidation", description: "Beta-oxidation spiral and energetics", added_by: null, created_at: now },
  { id: "guest-t-bio-5", subject_id: "guest-sub-biochemistry", topic_name: "Electron transport chain", description: "Complexes I–IV, ATP synthase, inhibitors", added_by: null, created_at: now },
];
