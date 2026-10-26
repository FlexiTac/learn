// Chinese for the course's sections and chapters (src/lessons/index.ts SECTIONS): the home page's section titles,
// blurbs and chapter cards, and the lesson list's groups. Keyed by section number; `chapters` by place (0-based), a
// missing one (or field) shows the English. Follow docs/i18n-terms-zh.md. Plain text (the views escape it): no HTML.
// A chapter's title is also its lessons' kicker (src/lessons/zh/<file>.ts `kicker`): keep the two the same.
import type { SectionZh } from "../../i18n/localize";

export const SECTIONS_ZH: Record<number, SectionZh> = {
  1: {
    title: "传感器",
    blurb: "传感垫和读取板：它们怎样工作，以及怎样自己做一块。",
    chapters: [
      {
        title: "传感垫",
        text: "按一按传感器，看它的触觉图亮起来，再一层一层把它拆开。",
        alt: "一根手指按压 FlexiTac 传感垫，它的触觉图亮了起来。",
      },
      {
        title: "读取板",
        text: "把 Arduino 拿起来，认识读取板上的每个部件；再插上传感垫，看它逐行读出完整的一帧。",
        alt: "传感垫通过两根扁平排线插在读取板上。一根手指按压传感垫，读取板一条一条地扫描它的线。",
      },
      {
        title: "用起来",
        text: "看实时热力图跟着你的手指走，用大约 3 分钟自己做一块传感垫，画面不对时学会排查。",
        alt: "一根手指按压真实的 FlexiTac 传感垫，屏幕上的实时热力图跟着它移动。",
      },
    ],
  },
  2: {
    title: "在机器人上",
    blurb: "把 FlexiTac 装到机器人夹爪上，接好线，感受它的触觉。",
    chapters: [
      {
        title: "安装",
        text: "在每根软指上贴一块传感垫，把尾线绕过侧面折到背面，每根手指再用排线连到一块读取板。",
        alt: "一台机器人夹爪，每根手指上贴着一块 FlexiTac 传感垫，扁平排线连到两块读取板。",
      },
      {
        title: "用触觉抓取",
        text: "用鼠标操控夹爪，拿起一颗草莓或一个立方体，同时看两根手指的触觉图。",
        alt: "夹爪把一颗草莓举起来，两根手指的触觉图显示出它压在哪里。",
      },
      {
        title: "接下来",
        text: "把触觉变成 3D 点，和相机画面、机器人关节一起记录下来，以及会利用触觉的策略。",
        alt: "接下来内容的草图：两块传感垫的触摸点变成 3D 点，围在一根被抓住的管子周围。",
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
