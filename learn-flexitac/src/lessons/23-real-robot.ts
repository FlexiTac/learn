// Lesson 1.6: FlexiTac on a real robot. A placeholder (2026-10-29, user: "to be decided, not made yet, but show the real
// robot + sensor video"): a draft lesson whose stage will play the user's footage of a real robot with real FlexiTac pads.
// Until the video is here the stage says it is coming (views/lesson.ts, t("stage.realRobot")).
// To put the video in: copy it to public/media/real-robot/real-robot.mp4 (H.264, muted is fine; a poster is optional) and
// set VIDEO below to its MediaItem; the stage then shows it with its controls (views/lesson.ts, a lesson's media).
import { COLS, FRAME_HZ, ROWS } from "@shared/data/constants.mjs";
import type { Lesson, MediaItem } from "../types";

/** The real robot footage, once the user provides it, e.g.
 *  { kind: "video", src: "media/real-robot/real-robot.mp4", alt: "...", caption: "FlexiTac on a real robot · real footage" } */
const VIDEO: MediaItem | null = null;

export const lesson: Lesson = {
  id: "real-robot",
  n: 6,
  title: "FlexiTac on a real robot",
  kicker: "On a robot",
  lede: `Real grippers, real FlexiTac pads and their live touch maps. This lesson is still being written; its video comes first.`,
  status: "draft",
  features: [
    { icon: "robot", title: "A real robot", text: "FlexiTac pads on a real gripper's fingers" },
    { icon: "heat", title: "Live touch maps", text: `${ROWS} × ${COLS} per pad, ${FRAME_HZ} frames a second` },
    { icon: "soon", title: "Coming soon", text: "The lesson around the video is still being written" },
  ],
  media: VIDEO ? [VIDEO] : [],
  overview: `
<p><b>From the drawing to the real thing.</b> Lesson 1.5 put FlexiTac on a robot drawn from its CAD files, with simulated
touch maps. Here the robot and the pads are real: the video shows a gripper with a FlexiTac pad on each finger, and the
touch maps its two reading boards send while it grasps.</p>
<p class="aside">This lesson is a <span class="badge badge-draft">draft</span>: the video comes first, the guided steps
later.</p>`,
  specs: [],
};
