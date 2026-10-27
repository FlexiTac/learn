// Chinese for src/lessons/01-meet-flexitac.ts (docs/i18n.md; words per docs/i18n-terms-zh.md). An empty slot shows the English.
import { COLS, FRAME_HZ, ROWS } from "@shared/data/constants.mjs";
import type { LessonZh } from "../../i18n/localize";

const TAXELS = ROWS * COLS;

export const zh: LessonZh = {
  id: "meet-flexitac",
  title: "认识 FlexiTac",
  kicker: "从这里开始",
  lede: `一只能感觉到手中物体的机器人手。FlexiTac 就是贴在它手指上的那层又薄又能弯的触觉传感器：它能感觉到<b>哪里</b>被按压，以及大致<b>按得多重</b>。`,
  features: [
    { title: `${ROWS} × ${COLS} 网格`, text: `${TAXELS} 个触摸点，分布在 24 × 64 mm 的区域里` },
    { title: "薄薄的三明治", text: "五层薄片，总厚度不到 1 mm" },
    { title: `每秒 ${FRAME_HZ} 幅图像`, text: "每一幅都是一张完整的压力分布图" },
  ],
  overview: `
<p><b>会感觉的机器人。</b>在第 1 步里，一个机器人夹爪拿起一颗草莓。它有两根软指，每根软指接触草莓的那一面都贴着一块 FlexiTac 传感垫。机器人旁边显示的，是夹住草莓时每块传感垫感觉到的内容。这幅触觉图像告诉机器人：草莓夹在手指间的什么位置，握得有多紧。这样它就能握稳草莓，又不会把它捏碎。</p>
<p>FlexiTac 是一层又薄又能弯的<b>机器人手的皮肤</b>。把它包在指尖上，机器人就能感觉到哪里被碰到，以及大致按得多重。</p>
<p><b>工作原理。</b>两张薄片上各有一排铜线，两排线彼此交叉，中间夹着一层黑色的压敏薄膜（<dfn data-term="velostat">Velostat</dfn>）。两条线交叉的每一处，就是一个小小的触摸点，叫作<dfn data-term="taxel">触觉像素（taxel）</dfn>，意思是“触觉的像素”（tactile pixel）。按压某个点，那里的薄膜就更容易导电。一块小电路板会一个接一个、飞快地检查每个点。</p>
<p><b>机器人得到什么。</b>大约每秒 ${FRAME_HZ} 次，得到一幅完整的触觉图像：${TAXELS} 个数字，每个点一个。它就像相机照片里的像素，只不过记录的是压力。根据这幅图像，机器人能判断物体在手指间的位置，以及自己握得有多紧。</p>
<p class="aside">先看机器人。然后亲手按一按传感器，看触觉图亮起来；再把它拆开，看看它为什么能工作。机器人场景是<span class="badge badge-illustrative">示意</span>：根据机器人的 CAD 文件绘制，读数是仿真出来的。后面的课会逐一详细讲解每个部件。</p>`,
  specs: [
    { label: "触觉像素" },
    { label: "感应线", note: "在顶层 FPC 上，通过多路选择器读取" },
    { label: "驱动线", note: "在底层 FPC 上，由四个移位寄存器驱动" },
    { label: "感应区域" },
    { label: "线间距（pitch）", note: "中心到中心，两张 FPC 相同" },
    { label: "传感垫厚度" },
    { label: "帧率", note: "每秒完整图像的幅数" },
    { label: "帧大小", note: `AA 55 帧头 + ${TAXELS} 个读数` },
    { label: "串口速率" },
    { label: "Velostat 薄膜" },
    { label: "制作时间", note: "约数" },
    { label: "每个传感器的成本", note: "约数" },
  ],
  steps: [
    {
      title: "装在机器人上",
      text: `这里，FlexiTac 像皮肤一样贴在机器人夹爪的两根手指上。手指合拢夹住草莓时，每块传感垫每秒 ${FRAME_HZ} 次发出一幅 ${ROWS} × ${COLS} 的触觉图像（即两张触觉图）。`,
    },
    {
      title: "感受一下",
      text: `现在亲手按一按传感器：每次按压，手指下的触摸点都会亮起来。左边的图就是机器人“感觉”到的：${TAXELS} 个数字，每秒 ${FRAME_HZ} 次。`,
    },
    {
      title: "拆开看看",
      text: `它是怎么做到的？<span class="only-mouse">点击</span><span class="only-touch">轻点</span>传感器把它拆开：它由五层薄片叠成。然后点任意一层，看看它起什么作用。`,
    },
  ],
  quiz: [
    {
      q: "什么是触觉像素（taxel）？",
      choices: ["三明治结构中的一层", "一条驱动线与一条感应线交叉的那一个点", "顶层薄片上的一条铜线", "一帧数据开头的帧头"],
      why: "触觉像素（tactile pixel）就是一个交叉点：下面一条驱动线（drive line），上面一条感应线（sense line），中间夹着一小块 Velostat。",
    },
    {
      q: `一块 ${ROWS} × ${COLS} 的传感垫有多少个触觉像素？`,
      why: `${ROWS} 条感应线中的每一条，都与 ${COLS} 条驱动线中的每一条交叉一次：${ROWS} × ${COLS} = ${TAXELS}。`,
    },
  ],
};
