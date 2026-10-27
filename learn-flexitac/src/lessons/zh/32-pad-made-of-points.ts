// Chinese for src/lessons/32-pad-made-of-points.ts (docs/i18n.md; words per docs/i18n-terms-zh.md). An empty slot shows the English.
import { COLS, ROWS } from "@shared/data/constants.mjs";
import type { LessonZh } from "../../i18n/localize";

const TAXELS = ROWS * COLS;

export const zh: LessonZh = {
  id: "pad-made-of-points",
  title: "由点组成的传感垫",
  kicker: "用点表示触觉",
  lede: `在仿真器眼里，FlexiTac 传感垫不是一叠薄膜做成的三明治，而是手指表面上的 ${TAXELS} 个点，编号方式和真实的一帧完全一样。`,
  features: [
    { title: `${TAXELS} 个点`, text: `${ROWS} × ${COLS}，间距 2 mm，在手指表面上` },
    { title: "帧的顺序", text: "点 k = i × 32 + j，和真实读取板发送的顺序一样" },
    { title: "跟着弯曲", text: "这些点随软指一起移动" },
  ],
  overview: `
<p><b>是点，不是层。</b>仿真器负担不起去模拟传感垫的五层薄膜和夹在里面的 Velostat。它只保留最要紧的东西：传感垫<b>在哪里</b>能感觉到。它在手指的夹持面上放 ${ROWS} × ${COLS} = ${TAXELS} 个<dfn data-term="taxel-point">触觉像素点（taxel point）</dfn>，间距 2 mm，真实传感垫的每个交叉点（crossing）对应一个。</p>
<p><b>碰到还是没碰到。</b>仿真每走一步，都会拿每个点和周围的物体比一比。落到物体内部的点就是被碰到了；其余的点什么也感觉不到。在卡片里，把玻璃球（或圆管）移到传感垫上方，按住按键把它压进去。</p>
<p><b>编号和真实传感垫一样。</b>每个点都有一个编号 k = i × 32 + j，其中 i 是感应线（sense line）的序号 0–11，j 是驱动线（drive line）的序号 0–31。这个顺序和读取板在一帧（frame）里发送 ${TAXELS} 个读数的顺序完全一样。所以仿真的一帧和真实的一帧能一格一格地对上，同一个程序两者都能读。</p>
<p><b>它们跟着手指动。</b>这些点固定在手指表面上，所以手指移动、或者柔软的鳍形软指包住物体弯曲时，点也跟着走，编号不变。</p>
<p class="aside">这是本课程自己的简化模型，在你的浏览器里运行（<span class="badge badge-illustrative">示意</span>）。VT-Refine 等科研仿真器也用同样的方式放点：在传感垫表面放一个 12 × 32、间距 2 mm 的点阵。</p>`,
  specs: [
    // 384 taxels (fact sensor.taxels)
    { label: "每块传感垫的点数", note: "真实传感垫的每个交叉点对应一个" },
    // 2 mm (fact fpc_top.electrodes.pitch)
    { label: "间距", note: "真实传感垫的线间距" },
    { label: "编号", note: "i = 感应线 0–11，j = 驱动线 0–31：即帧的顺序" },
    { label: "科研仿真器中", value: "12 × 32 点阵，间距 2 mm，用射线投射（ray-cast）到传感垫上" },
    // 1.3 mm
    { label: "卡片里的按压深度" },
  ],
  steps: [
    {
      title: `${TAXELS} 个点`,
      text: `在仿真器眼里，传感垫只是手指表面上 ${ROWS} × ${COLS} = ${TAXELS} 个点，间距 2 mm。<span class="only-mouse">把球移到上面并按住按键</span><span class="only-touch">在上面按住，拖动来移动球</span>：球里面的点会亮起来。`,
    },
    {
      title: "按帧的顺序",
      text: `每个点都有编号 k = i × 32 + j，顺序和真实读取板发送一帧的顺序完全一样。看计数怎样走遍传感垫和触觉图。`,
    },
    {
      title: "跟着弯曲",
      text: `软指会弯曲。这些点随手指表面一起移动，编号不变，所以下面的触觉图顺序也不变。也试试圆管。`,
    },
  ],
  quiz: [
    {
      q: "本课的仿真器把 FlexiTac 传感垫看成什么？",
      choices: ["五层薄膜", `手指表面上的 ${TAXELS} 个点`, "一根大弹簧", "一张相机图像"],
      why: `真实传感垫的每个交叉点对应一个点：${ROWS} × ${COLS} = ${TAXELS} 个，间距 2 mm。`,
    },
    {
      q: "点 k = i × 32 + j。感应线 i = 2、驱动线 j = 5 的点，编号是多少？",
      why: `k = 2 × 32 + 5 = 69：和真实读取板在帧里放这个读数的位置相同。`,
    },
    {
      q: "软指包住物体弯曲时，这些点会怎样？",
      choices: ["留在原来的位置", "随手指表面移动，编号不变", "得到新的编号", "一半的点关掉"],
      why: `这些点固定在手指表面上：它们跟着表面走，帧的顺序保持不变。`,
    },
  ],
};
