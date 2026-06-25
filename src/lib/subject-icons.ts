import {
  Activity, Baby, BookOpen, Bone, Brain, Bug, Ear, Eye, FlaskConical, Hand, Heart,
  Microscope, Pill, ScanLine, Scale, Scissors, Stethoscope, Syringe, Users,
  type LucideIcon,
} from "lucide-react";

import clayActivity from "@/assets/clay-subject-activity.png";
import clayBaby from "@/assets/clay-subject-baby.png";
import clayBookOpen from "@/assets/clay-subject-bookopen.png";
import clayBone from "@/assets/clay-subject-bone.png";
import clayBrain from "@/assets/clay-subject-brain.png";
import clayBug from "@/assets/clay-subject-bug.png";
import clayEar from "@/assets/clay-subject-ear.png";
import clayEye from "@/assets/clay-subject-eye.png";
import clayFlask from "@/assets/clay-subject-flaskconical.png";
import clayHand from "@/assets/clay-subject-hand.png";
import clayHeart from "@/assets/clay-subject-heart.png";
import clayMicroscope from "@/assets/clay-subject-microscope.png";
import clayPill from "@/assets/clay-subject-pill.png";
import clayScanLine from "@/assets/clay-subject-scanline.png";
import clayScale from "@/assets/clay-subject-scale.png";
import clayScissors from "@/assets/clay-subject-scissors.png";
import clayStethoscope from "@/assets/clay-subject-stethoscope.png";
import claySyringe from "@/assets/clay-subject-syringe.png";
import clayUsers from "@/assets/clay-subject-users.png";

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
