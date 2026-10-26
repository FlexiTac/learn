// Chinese for src/lessons/33-how-deep-how-hard.ts (docs/i18n.md; words per docs/i18n-terms-zh.md). An empty slot shows the English.
import { DEFAULTS, PAPER, PRESETS } from "@shared/models/touchsim.mjs";
import type { LessonZh } from "../../i18n/localize";

export const zh: LessonZh = {
  id: "how-deep-how-hard",
  title: "压多深，力多大",
  kicker: "从接触到信号",
  lede: `当物体压进传感垫时，仿真器会对每个点问两个问题：压进去多深？往回推的力有多大？`,
  features: [
    { title: "深度 d", text: "物体压进每个点的距离" },
    { title: "弹簧 + 阻尼器", text: "f = kₙ·d + k_d·ḋ，每个点都一样" },
    { title: "两张图", text: "一张深度图和一张力图，各 12 × 32" },
  ],
  overview: `
<p><b>压多深。</b>只要物体和传感垫有重叠，仿真器就测量它压进每个点的距离：这就是<dfn data-term="penetration-depth">穿透深度（penetration depth）</dfn> d，单位是毫米。物体外面的点 d = 0。</p>
<p><b>力多大。</b>接着，每个点都像一个小弹簧，旁边还连着一个阻尼器，这叫<dfn data-term="kelvin-voigt">弹簧-阻尼模型（Kelvin–Voigt）</dfn>：</p>
<p class="formula">f = k<sub>n</sub> · d + k<sub>d</sub> · ḋ</p>
<p>弹簧部分 k<sub>n</sub> · d：点被压得越深，往回推得越用力。阻尼部分 k<sub>d</sub> · ḋ 取决于深度变化得有多<b>快</b>（ḋ，读作“d-dot”）：物体往里压时，它多加一些力；物体往外退时，它减掉一些力，就像门上的闭门器。一个点只会推，从不会把物体往里拉。</p>
<p><b>只推，不管侧向。</b>这个模型只保留垂直压进传感垫的力，忽略侧向的摩擦（剪切力，shear）。FlexiTac 传感垫感受的是穿过它厚度方向的挤压，而不是在表面上的滑动，所以仿真器用不着剪切力。</p>
<p><b>两张图。</b>结果是两张 ${"12 × 32"} 的图，就像真实的一帧（frame）：每个点被压得多深，以及它往回推得多用力。力图就是仿真传感垫的读数。</p>
<p class="aside">每个点的 k<sub>n</sub> = ${DEFAULTS.kn} N/mm 和 k<sub>d</sub> = ${DEFAULTS.kd} N·s/mm 是本课程选定的（<span class="badge badge-illustrative">示意</span>）。之后的一课会讲研究者怎样调这两个数，让仿真传感垫的读数和真实的一样。</p>`,
  specs: [
    { label: "模型", value: "f = k<sub>n</sub> d + k<sub>d</sub> ḋ，只有法向力" },
    { label: "本课程中", value: `每个点 k<sub>n</sub>&nbsp;=&nbsp;${DEFAULTS.kn}&nbsp;N/mm，k<sub>d</sub>&nbsp;=&nbsp;${DEFAULTS.kd}&nbsp;N·s/mm` },
    { label: "论文中", value: `k<sub>n</sub>&nbsp;=&nbsp;${PAPER.kn}，k<sub>d</sub>&nbsp;=&nbsp;${PAPER.kd}（国际单位）`, note: "单位不同，传感垫模型也不同：不能一一对比" },
    { label: "公开的代码", value: "只有弹簧，没有阻尼器", note: "保留法向力；论文中的阻尼器不在公开的代码里" },
    { label: "Isaac Lab 移植版", value: "只有弹簧，并限制最大力" },
    { label: "卡片里的球", value: `r = ${PRESETS.fingertip.radius} mm，压入 ${PRESETS.firmDepth} mm` },
  ],
  steps: [
    {
      title: "压多深",
      text: `看球压进传感垫的一行（也可以在上面上下拖动）。仿真器测量每个点被压进去多少：这就是深度 d。`,
    },
    {
      title: "一个弹簧加一个阻尼器",
      text: `每个点都像弹簧加阻尼器一样往回推：f = kₙ·d + k_d·ḋ。快速轻敲（慢放）能看出阻尼器的作用：球往里压时，力会多出一些。`,
    },
    {
      title: "只算推力",
      text: `只算垂直压进传感垫的推力，不算侧向摩擦（剪切力）：FlexiTac 感受的是厚度方向的挤压。而且一个点从不往回拉。`,
    },
    {
      title: "两张图",
      text: `结果是两张 12 × 32 的图：每个点被压得多深，以及它往回推得多用力。力图就成为仿真传感垫的读数。`,
    },
  ],
  quiz: [
    {
      q: "一个点的穿透深度 d 是什么？",
      choices: ["物体压进这个点的距离", "传感垫的厚度", "两个点之间的距离", "按压持续的时间"],
      why: `d 是物体在这个点上和传感垫重叠的距离；物体外面 d = 0。`,
    },
    {
      q: "在 f = kₙ·d + k_d·ḋ 里，哪一部分取决于按压变化得有多快？",
      choices: ["kₙ·d，弹簧", "k_d·ḋ，阻尼器", "都不是", "两者一样"],
      why: `ḋ 是深度变化的快慢，所以物体往里压时阻尼器多加一些力，往外退时减掉一些力。`,
    },
    {
      q: "为什么模型忽略侧向（剪切）力？",
      choices: ["对任何传感器来说，它们都小到可以忽略", "FlexiTac 传感垫感受的是厚度方向的挤压，而不是表面上的滑动", "仿真器算不出来", "它们会让图太亮"],
      why: `传感垫里的 Velostat 随穿过厚度方向的压力而变化；仿真器只模仿真实传感垫能感觉到的东西。`,
    },
  ],
};
