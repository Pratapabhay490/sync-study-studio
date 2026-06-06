import {
  Activity, Baby, BookOpen, Bone, Brain, Bug, Ear, Eye, FlaskConical, Hand, Heart,
  Microscope, Pill, ScanLine, Scale, Scissors, Stethoscope, Syringe, Users,
  type LucideIcon,
} from "lucide-react";

const map: Record<string, LucideIcon> = {
  Activity, Baby, BookOpen, Bone, Brain, Bug, Ear, Eye, FlaskConical, Hand, Heart,
  Microscope, Pill, ScanLine, Scale, Scissors, Stethoscope, Syringe, Users,
};

export function getSubjectIcon(name?: string | null): LucideIcon {
  if (name && map[name]) return map[name];
  return BookOpen;
}
