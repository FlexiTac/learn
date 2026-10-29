// Chinese for the course's sections and chapters (src/lessons/index.ts SECTIONS): the home page's section titles,
// blurbs and chapter cards, and the lesson list's groups. Keyed by section number; `chapters` by place (0-based), a
// missing one (or field) shows the English. Follow docs/i18n-terms-zh.md. Plain text (the views escape it): no HTML.
// A chapter's title is also its lessons' kicker (src/lessons/zh/<file>.ts `kicker`): keep the two the same.
import type { SectionZh } from "../../i18n/localize";

export const SECTIONS_ZH: Record<number, SectionZh> = {
  1: {
    title: "传感器",
    blurb: "传感垫：它怎样工作，怎样看到它的触觉，怎样自己做一块，以及怎样把它装到机器人上。",
    chapters: [
      {
        title: "传感垫",
        text: "按一按传感器，看它的触觉图亮起来，再一层一层把它拆开。",
        alt: "一根手指按压 FlexiTac 传感垫，它的触觉图亮了起来。",
      },
      {
        title: "用起来",
        text: "看实时热力图跟着你的手指走，用大约 3 分钟自己做一块传感垫，画面不对时学会排查。",
        alt: "一根手指按压真实的 FlexiTac 传感垫，屏幕上的实时热力图跟着它移动。",
      },
      {
        title: "在机器人上",
        text: "在机器人夹爪的每根手指上贴一块传感垫、接好线，再用鼠标操控夹爪，感受它抓住的东西。",
        alt: "一台机器人夹爪，每根手指上贴着一块 FlexiTac 传感垫：扁平排线从传感垫连到两块读取板，夹爪合拢又张开。",
      },
    ],
  },
  2: {
    title: "读取板",
    blurb: "读取传感垫的小板子：它的每个部件，以及它怎样逐行读出完整的一帧。",
    chapters: [
      {
        title: "读取板",
        text: "把 Arduino 拿起来，认识读取板上的每个部件；再插上传感垫，看它逐行读出完整的一帧。",
        alt: "传感垫通过两根扁平排线插在读取板上。一根手指按压传感垫，读取板一条一条地扫描它的线。",
      },
    ],
  },
  3: {
    title: "在仿真中",
    blurb: "在浏览器里仿真 FlexiTac：点、弹簧和一条共同的规则。",
    chapters: [
      {
        title: "用点表示触觉",
        text: "机器人为什么要在仿真中练习，以及仿真器怎样看待传感垫：手指上的 384 个点，按帧的顺序排列。",
        alt: "一根仰放的软指，它的传感垫画成 384 个点；一个玻璃球让它碰到的点亮起来。",
      },
      {
        title: "从接触到信号",
        text: "给每个点配一个小弹簧，把物体压进去的深度变成力，然后亲手试试整个模型。",
        alt: "一个球压进传感垫的一行；每个点下面都有一个小弹簧和阻尼器往回推。",
      },
      {
        title: "用它训练",
        text: "调整仿真传感垫，直到它的读数和真实的一样；然后从少量真实示教中学习，在仿真中练习，再回到真实机器人上。",
        alt: "一个循环：一台真实机器人、一块策略芯片，以及一个有许多夹爪副本的仿真。",
      },
    ],
  },
};
