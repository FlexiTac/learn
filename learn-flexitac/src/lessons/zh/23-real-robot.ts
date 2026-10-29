// Chinese for src/lessons/23-real-robot.ts (docs/i18n.md; words per docs/i18n-terms-zh.md). An empty slot shows the English.
import { COLS, FRAME_HZ, ROWS } from "@shared/data/constants.mjs";
import type { LessonZh } from "../../i18n/localize";

export const zh: LessonZh = {
  id: "real-robot",
  title: "真实机器人上的 FlexiTac",
  kicker: "在机器人上",
  lede: `真实的夹爪、真实的 FlexiTac 传感垫，以及它们的实时触觉图。本课还在编写中，先放上视频。`,
  features: [
    { title: "真实的机器人", text: "真实夹爪的手指上贴着 FlexiTac 传感垫" },
    { title: "实时触觉图", text: `每块传感垫 ${ROWS} × ${COLS}，每秒 ${FRAME_HZ} 帧` },
    { title: "即将上线", text: "围绕视频的课程内容还在编写中" },
  ],
  overview: `
<p><b>从图到实物。</b>第 1.5 课把 FlexiTac 装到了一台按 CAD 文件画出的机器人上，触觉图是仿真的。这里的机器人和传感垫都是真的：视频里是一台每根手指上都贴着 FlexiTac 传感垫的夹爪，以及它抓取时两块读取板发出的触觉图。</p>
<p class="aside">本课是<span class="badge badge-draft">草稿</span>：先放视频，引导步骤以后再加。</p>`,
};
