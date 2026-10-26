// The course, in order. To add a lesson: create src/lessons/NN-slug.ts exporting `lesson`, add it to LESSONS (its `n` is
// its place there) and to its chapter in SECTIONS.
import { t } from "../i18n/strings";
import type { Chapter, Lesson, Section } from "../types";
import { lesson as l01 } from "./01-meet-flexitac";
import { lesson as l02 } from "./02-the-sandwich";
// Lessons 4-6 ("The crossing": 04-one-crossing, 05-voltage-divider, 06-volts-to-byte) are set aside for now (their
// files stay); the board and use-it lessons moved up. The voltage divider is shown in lesson 2.
// 2026-10-24: Section 1 is six lessons, two per part. "Electrodes, slots and the supporting beam" left the course (its
// facts live on in the figures' Details); "Driving 32 lines with 2 pins" and "Listening to 12 lines with one pin" became
// one lesson, "Pick one crossing" (3); "One frame" (4) has the pad plugged in; "Flash the firmware" and the
// troubleshooting checks are now the last part of "Build your own" (6). 2026-10-25: lesson 3 became "Meet the reading
// board" (lift the Nano, every part labelled, no scanning) and all the scanning moved into "One frame" (4). The old files
// are in ./_retired (not part of the course); src/state/store.ts MOVED sends their old links to the new lessons and
// moves saved progress where a lesson was merged.
import { lesson as l07 } from "./07-meet-the-board";
import { lesson as l09 } from "./09-one-frame";
import { lesson as l11 } from "./11-bytes-to-touch";
import { lesson as l12 } from "./12-build-your-own";
// 2026-10-25 (PLAN-section2-3.md v0.2.2): Section 2 "On a robot" (2.1-2.2, Fig 5 gripper) and Section 3 "In simulation"
// (3.1-3.6, the in-browser touch engine shared/models/touchsim.mjs and its cards, src/widgets/sim-*.ts).
import { lesson as l21 } from "./21-put-on-a-robot";
import { lesson as l22 } from "./22-grasp-with-your-mouse";
import { lesson as l31 } from "./31-why-simulate-touch";
import { lesson as l32 } from "./32-pad-made-of-points";
import { lesson as l33 } from "./33-how-deep-how-hard";
// 2026-10-25: "Make sim feel real" (34) and "Real -> sim -> real" (35) are set aside for now ("Train with it" shows as
// coming soon); their files and cards (src/widgets/sim-calibrate.ts, sim-results.ts) stay for later. Old links go to
// lessons still in the course (src/state/store.ts MOVED).
import { lesson as l36 } from "./36-sim-playground";

export const LESSONS: Lesson[] = [l01, l02, l07, l09, l11, l12, l21, l22, l31, l32, l33, l36];

export const byId = (id: string): Lesson | undefined => LESSONS.find((l) => l.id === id);

/** The course: three sections of three chapters each (2026-10-25, PLAN-section2-3.md §4). Each chapter is one home card
 *  with a cover picture taken from its own figure or widget, and one group in the lesson list. Section 2's third chapter
 *  has no lessons yet ("Coming next"), and so has Section 3's ("Train with it": calibration and real -> sim -> real,
 *  coming soon). */
export const SECTIONS: Section[] = [
  {
    n: 1,
    title: "The sensor",
    blurb: "The pad and its reading board: how they work and how to build your own.",
    chapters: [
      {
        title: "The pad",
        lessons: ["meet-flexitac", "the-sandwich"],
        text: "Press the sensor and watch its touch map light up, then take it apart layer by layer.",
        cover: { loop: "pad" },
        alt: "A fingertip presses the FlexiTac pad and its touch map lights up.",
      },
      {
        title: "The board",
        lessons: ["meet-the-board", "one-frame"],
        text: "Lift the Arduino and meet every part of the reading board, then plug in the pad and watch it read a whole frame, row by row.",
        cover: { loop: "board" },
        alt: "The pad plugged into the reading board by two flat cables. A fingertip presses it while the board scans its lines, one at a time.",
      },
      {
        title: "Use it",
        lessons: ["bytes-to-touch", "build-your-own"],
        text: "Watch a live heatmap follow your finger, build your own pad in about 3 minutes, and fix it when the picture looks wrong.",
        cover: { loop: "useit" },
        alt: "A finger presses a real FlexiTac pad and a live heatmap follows it on a screen.",
      },
    ],
  },
  {
    n: 2,
    title: "On a robot",
    blurb: "Mount FlexiTac on a robot gripper, wire it up and feel what it feels.",
    chapters: [
      {
        title: "Mount it",
        lessons: ["put-on-a-robot"],
        text: "Tape a pad onto each soft finger, wrap its tails round the side to the back and cable it to one board per finger.",
        cover: { still: "mount" },
        alt: "A robot gripper with a FlexiTac pad taped on each finger, flat cables running to two reading boards.",
      },
      {
        title: "Grasp with touch",
        lessons: ["grasp-with-your-mouse"],
        text: "Drive the gripper with your mouse, pick up a strawberry or a cube, and watch both fingers' touch maps.",
        cover: { still: "grasp" },
        alt: "The gripper holds a strawberry up, and the two fingers' touch maps show where it presses.",
      },
      {
        title: "Coming next",
        lessons: [],
        text: "Touch as 3D points, recording it with the camera and the robot's joints, and policies that use touch.",
        cover: { still: "next" },
        alt: "A sketch of what comes next: the two pads' touch spots as points in 3D around a grasped tube.",
      },
    ],
  },
  {
    n: 3,
    title: "In simulation",
    blurb: "Simulate FlexiTac in your browser: points, springs and one shared rule.",
    chapters: [
      {
        title: "Touch as points",
        lessons: ["why-simulate-touch", "pad-made-of-points"],
        text: "Why robots practise in simulation, and how a simulator sees the pad: 384 points on the finger, in frame order.",
        cover: { still: "points" },
        alt: "A soft finger lying on its back, its pad drawn as 384 points; a glass ball lights the points it touches.",
      },
      {
        title: "Contact to signal",
        lessons: ["how-deep-how-hard", "sim-playground"],
        text: "Turn how deep an object presses into a force with a tiny spring per point, then try the whole model yourself.",
        cover: { still: "springs" },
        alt: "A ball presses into one row of the pad; under each point a small spring and damper push back.",
      },
      {
        title: "Train with it",
        lessons: [],
        text: "Tune the simulated pad until it reads like the real one, then learn from a few real demos, practise in simulation and go back to the real robot.",
        cover: { still: "loop" },
        alt: "A loop: a real robot, a policy chip and a simulation with many copies of the gripper.",
      },
    ],
  },
];

/** The section a lesson belongs to (every lesson in LESSONS is in one). */
export function sectionOf(l: Lesson): Section {
  return SECTIONS.find((s) => s.chapters.some((c) => c.lessons.includes(l.id)))!;
}

/** The chapter a lesson belongs to. */
export function chapterOf(l: Lesson): Chapter {
  return sectionOf(l).chapters.find((c) => c.lessons.includes(l.id))!;
}

/** The lessons of a chapter, in order. */
export function chapterLessons(c: Chapter): Lesson[] {
  return c.lessons.map((id) => byId(id)!).filter(Boolean);
}

/** The number a learner sees: section.place, "1.1" ... "3.6" (D7). */
export function lessonNo(l: Lesson): string {
  const s = sectionOf(l);
  const k = s.chapters.flatMap((c) => c.lessons).indexOf(l.id);
  return `${s.n}.${k + 1}`;
}

/** The lesson with this shown number ("2.1"), or undefined. */
export function byNo(no: string): Lesson | undefined {
  return LESSONS.find((l) => lessonNo(l) === no);
}

/** "Lessons 1.1–1.2" / "Lesson 2.1" for a chapter (in the site's language), or "" for one without lessons. */
export function chapterRange(c: Chapter): string {
  const ls = chapterLessons(c);
  if (!ls.length) return "";
  return ls.length === 1 ? t("lesson.no", { no: lessonNo(ls[0]) }) : t("lessons.range", { from: lessonNo(ls[0]), to: lessonNo(ls[ls.length - 1]) });
}

export function neighbours(l: Lesson): { prev?: Lesson; next?: Lesson } {
  const i = LESSONS.indexOf(l);
  return { prev: LESSONS[i - 1], next: l.next ? byId(l.next) : LESSONS[i + 1] };
}

// Catch authoring mistakes early (dev and build).
{
  const inSections = SECTIONS.flatMap((s) => s.chapters.flatMap((c) => c.lessons));
  if (inSections.join() !== LESSONS.map((l) => l.id).join()) console.warn(`lessons: SECTIONS lists ${inSections.join(", ")} but LESSONS is ${LESSONS.map((l) => l.id).join(", ")}`);
}
for (const [i, l] of LESSONS.entries()) {
  if (l.n !== i + 1) console.warn(`lessons: ${l.id} has n=${l.n} but is #${i + 1} in LESSONS`);
  if (l.features.length !== 3) console.warn(`lessons: ${l.id} needs exactly 3 features`);
  for (const m of l.code?.source.matchAll(/\{\{(\w+)\}\}/g) ?? [])
    if (!l.code!.params.some((p) => p.name === m[1])) console.warn(`lessons: ${l.id} code uses {{${m[1]}}} but has no param for it`);
}
