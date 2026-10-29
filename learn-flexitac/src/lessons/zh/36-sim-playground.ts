// Chinese for src/lessons/36-sim-playground.ts (docs/i18n.md; words per docs/i18n-terms-zh.md). An empty slot shows the English.
import { NOISE_SCALE, THRESHOLD } from "@shared/data/constants.mjs";
import { DEFAULTS } from "@shared/models/touchsim.mjs";
import type { LessonZh } from "../../i18n/localize";

export const zh: LessonZh = {
  id: "sim-playground",
  title: "实验场",
  kicker: "从接触到信号",
  lede: `整个模型都在这里。选一个物体，转动旋钮，加点噪声，再把仿真的一帧和类真实的一帧比一比。`,
  features: [
    { title: "四个物体", text: "一个球、一根圆管、一根横条的棱和一颗草莓" },
    { title: "所有旋钮", text: "按压、kₙ、k_d、噪声和阈值" },
    { title: "仿真 vs 类真实", text: "同一次按压，两种读法" },
  ],
  overview: `
<p><b>试试看。</b>一个物体一次又一次地压进手指上的传感垫。在图上拖动（或点击触觉图上的一个方格）来改变按压的位置，用按钮换一个物体。</p>
<p><b>同一次按压，两种读法。</b>“仿真”图是模型算出的力，用真实查看器的同一条规则缩放（第 1.3 课）。“类真实”图先把同样的力变成字节（byte），就像真实读取板发送的那样：每个点有自己的静息水平和一点噪声，查看器再减去从最初几帧测得的<dfn data-term="baseline">基线（baseline）</dfn>。然后用同一条规则缩放。</p>
<p><b>可以试试这些。</b></p>
<ul>
<li>把 k<sub>n</sub> 调硬：同样的按压，往回推的力更大。</li>
<li>调高 k<sub>d</sub>，缩短按压时间：物体运动时，阻尼器会多加一些力。</li>
<li>加噪声：类真实图会出现斑点，但阈值（threshold，${THRESHOLD} 计数）会挡住其中大部分。</li>
<li>非常轻地按：一帧的最大值低于阈值时，规则会除以固定的 ${NOISE_SCALE}，而不是这个最大值。所以轻轻一碰仍然是暗的，不会一下跳到最亮。</li>
</ul>
<p class="aside">这里的每个数都是本课程自己选的（<span class="badge badge-illustrative">示意</span>），只有查看器的阈值、噪声缩放值和基线帧数是 PyFlexiTac / 硬件仓库里的真实数值。想深入了解的话，科研代码是开源的：VT-Refine 和 FlexiTac Isaac Sim 仿真。</p>`,
  specs: [
    { label: "弹簧、阻尼器（初始值）", value: `k<sub>n</sub>&nbsp;=&nbsp;${DEFAULTS.kn}&nbsp;N/mm，k<sub>d</sub>&nbsp;=&nbsp;${DEFAULTS.kd}&nbsp;N·s/mm` },
    { label: "力到计数", value: "每牛顿 125 计数" },
    { label: "引擎频率", value: "每秒 100 步，和真实帧率一样" },
    // 15 counts (fact host.threshold)
    { label: "阈值" },
    // 60 counts (fact host.noiseScale)
    { label: "安静帧缩放值" },
    // 30 frames (fact host.initFrames)
    { label: "基线帧数" },
  ],
  steps: [
    {
      title: "选一个物体",
      text: `一个物体一次次压在传感垫上。换一个物体，或者在图上拖动来改变按压的位置。两张触觉图显示的是同一次按压。`,
    },
    {
      title: "仿真 vs 类真实",
      text: `左边是仿真的一帧；右边是同样的力按真实读取板的方式读出：静息水平、噪声、基线。两者用同一条规则缩放。噪声调大后，只有右图会闪出零星的点。`,
    },
    {
      title: "转动旋钮",
      text: `把 kₙ 调硬，调高 k_d，加噪声，改阈值。看哪张图在变、怎么变。按“重置”就能全部复原。`,
    },
  ],
  quiz: [
    {
      q: "类真实图比仿真图多了什么？",
      choices: ["更多的触摸点", "静息水平、噪声和基线，就像真实读取板发出的字节", "不同的编号", "颜色"],
      why: `类真实的一帧先把力变成字节：每个点有自己的静息水平和一点噪声，查看器再减去基线。`,
    },
    {
      q: "一次很轻的按压：这一帧的最大值低于阈值。规则会除以什么？",
      choices: ["这一帧的最大值", `固定的 ${NOISE_SCALE}`, "零", "点的个数"],
      why: `把一个几乎空的帧除以它自己的最大值，会把微小的噪声放大到最亮；除以固定的 ${NOISE_SCALE} 能让它保持暗淡。`,
    },
  ],
};
