import {
  Activity, Baby, BookOpen, Bone, Brain, Bug, Ear, Eye, FlaskConical, Hand, Heart,
  Microscope, Pill, ScanLine, Scale, Scissors, Stethoscope, Syringe, Users,
  type LucideIcon,
} from "lucide-react";

import clayActivity from "@/assets/clay-subject-activity.webp";
import clayBaby from "@/assets/clay-subject-baby.webp";
import clayBookOpen from "@/assets/clay-subject-bookopen.webp";
import clayBone from "@/assets/clay-subject-bone.webp";
import clayBrain from "@/assets/clay-subject-brain.webp";
import clayBug from "@/assets/clay-subject-bug.webp";
import clayEar from "@/assets/clay-subject-ear.webp";
import clayEye from "@/assets/clay-subject-eye.webp";
import clayFlask from "@/assets/clay-subject-flaskconical.webp";
import clayHand from "@/assets/clay-subject-hand.webp";
import clayHeart from "@/assets/clay-subject-heart.webp";
import clayMicroscope from "@/assets/clay-subject-microscope.webp";
import clayPill from "@/assets/clay-subject-pill.webp";
import clayScanLine from "@/assets/clay-subject-scanline.webp";
import clayScale from "@/assets/clay-subject-scale.webp";
import clayScissors from "@/assets/clay-subject-scissors.webp";
import clayStethoscope from "@/assets/clay-subject-stethoscope.webp";
import claySyringe from "@/assets/clay-subject-syringe.webp";
import clayUsers from "@/assets/clay-subject-users.webp";

const map: Record<string, LucideIcon> = {
  Activity, Baby, BookOpen, Bone, Brain, Bug, Ear, Eye, FlaskConical, Hand, Heart,
  Microscope, Pill, ScanLine, Scale, Scissors, Stethoscope, Syringe, Users,
};

const clayMap: Record<string, string> = {
  Activity: clayActivity,
  Baby: clayBaby,
  BookOpen: clayBookOpen,
  Bone: clayBone,
  Brain: clayBrain,
  Bug: clayBug,
  Ear: clayEar,
  Eye: clayEye,
  FlaskConical: clayFlask,
  Hand: clayHand,
  Heart: clayHeart,
  Microscope: clayMicroscope,
  Pill: clayPill,
  ScanLine: clayScanLine,
  Scale: clayScale,
  Scissors: clayScissors,
  Stethoscope: clayStethoscope,
  Syringe: claySyringe,
  Users: clayUsers,
};

export function getSubjectIcon(name?: string | null): LucideIcon {
  if (name && map[name]) return map[name];
  return BookOpen;
}

export function getSubjectClayIcon(name?: string | null): string {
  if (name && clayMap[name]) return clayMap[name];
  return clayBookOpen;
}
