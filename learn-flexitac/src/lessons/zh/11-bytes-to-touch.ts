// Chinese for src/lessons/11-bytes-to-touch.ts (docs/i18n.md; words per docs/i18n-terms-zh.md). An empty slot shows the English.
// The numbers come from the same shared data and models as the English lesson. The lab's controls are named as the
// heatmap-lab widget names them in Chinese: 阈值 (Threshold), 重新校准 (Recalibrate).
import { ALPHA, COLS, FRAME_BYTES, FRAME_HZ, INIT_FRAMES, NOISE_SCALE, ROWS, THRESHOLD } from "@shared/data/constants.mjs";
import { PYFLEXITAC } from "@shared/models/host.mjs";
import type { LessonZh } from "../../i18n/localize";

const TAXELS = ROWS * COLS;
const PCT = Math.round(ALPHA * 100);

export const zh: LessonZh = {
  id: "bytes-to-touch",
  title: "从字节到触觉：热力图",
  kicker: "用起来",
  lede: `在电脑上，每秒 ${FRAME_HZ} 帧数据变成一幅实时的触觉图像。五个小步骤把 ${TAXELS} 个原始数字变成颜色。在热力图实验室里按一按仿真的传感垫，看看每一步的效果。`,
  features: [
    { title: "减去基线", text: `取前 ${INIT_FRAMES} 帧的中位数` },
    { title: `阈值 ${THRESHOLD}`, text: "忽略小的抖动" },
    { title: `平滑系数 ${ALPHA}`, text: "把每一帧和上一幅图像混合" },
  ],
  overview: `
<p>读取板（reading board）发来一串字节。你电脑上的查看器程序（硬件仓库里的 <code>fast_32_16.py</code>，已逐行移植到这个页面里）先在数据流中找到<dfn data-term="header">帧头（header）</dfn>字节 <code>AA 55</code>。它们后面的 ${TAXELS} 个字节就是<dfn data-term="frame">一帧（frame）</dfn>。然后，它对每一帧做五件事。</p>
<p><b>1 · 原始字节。</b>每个字节（0–255）表示经过一个交叉点回来的电压有多大。没被按的交叉点仍有一点电流通过，所以它的读数是一个小数字，而不是 0。真实的传感垫静止时大约在 10–40。</p>
<p><b>2 · 基线。</b>每个交叉点静止时的读数都略有不同。所以查看器启动时，会记录前 ${INIT_FRAMES} 帧，并为每个触觉像素（taxel）保留<dfn data-term="median">中位数（median）</dfn>：把这 ${INIT_FRAMES} 个读数排好序，取中间那个。偶尔出现的尖峰会带偏平均数，却带不偏中位数。每个触觉像素的这个静止值就是<dfn data-term="baseline">基线（baseline）</dfn>。<b>校准时不要碰传感垫</b>，否则你的手指就成了“静止”的一部分。</p>
<p><b>3 · 接触。</b>对每个触觉像素计算 <code>raw − baseline − ${THRESHOLD}</code>，再把结果限制在 0 到 100 之间。<dfn data-term="threshold">阈值（threshold）</dfn>（${THRESHOLD} 个计数）去掉电噪声带来的小抖动，只留下真正的按压。</p>
<p><b>4 · 归一化。</b><dfn data-term="normalise">归一化（normalise）</dfn>就是把数值重新缩放到 0 到 1 之间。查看器把整帧除以其中最强的值（峰值，peak）。如果连峰值都低于阈值，说明其实没有东西在按，于是改为除以 ${NOISE_SCALE}，让残留的数值保持暗淡。有一点出人意料：因为这一步，轻按和重按都会达到最亮。<b>热力图（heatmap）显示的是你按在哪里，而不是按得多重。</b></p>
<p><b>5 · 平滑与上色。</b>每幅新图像都会和上一幅混合：<code>shown = ${ALPHA} × new + ${(1 - ALPHA).toFixed(1)} × previous</code>。这叫<dfn data-term="ema">指数移动平均（EMA）</dfn>；权重 ${ALPHA} 叫作 alpha。alpha 越小，图像越平稳，但反应越慢。最后，每个 0–1 的值从 <dfn data-term="viridis">viridis 色图（colour map）</dfn>里取一个颜色：从深紫经过青绿到黄色。色盲的人也能看清，印成灰度也能分辨。</p>
<p class="aside">试一试：把<b>阈值</b>设为 0，然后抬起手指，噪声会让整块传感垫都亮起来。再按住一个点，点击<b>重新校准</b>：松手之后，那个点就“失灵”了。这个实验室是<span class="badge badge-illustrative">示意</span>：按压力度和噪声是虚构的旋钮，但字节之后的每一步都是查看器的真实代码。</p>
<p class="aside">要用真实的传感垫来看，得先给 Nano 装上扫描固件：<a href="#/lesson/build-your-own">第 1.6 课“自己动手做”</a>讲了怎样烧录（flash）固件，以及图像一直是暗的或看起来不对时该检查什么。</p>`,
  wiring: {
    intro: "每一步在哪里进行。只有第一行在 Arduino 上运行；其余都在你的电脑上运行。",
    rows: [
      { to: "USB 串口", note: `每帧 ${FRAME_BYTES} 字节：AA 55，然后是 ${TAXELS} 个读数，一条感应线接一条感应线。` },
      { from: "字节流", to: "帧查找器", note: `寻找 AA 55，并截取后面的 ${TAXELS} 个字节。` },
      { from: `前 ${INIT_FRAMES} 帧`, to: "基线", note: "每个触觉像素取中位数：每个交叉点静止时的读数。" },
      { from: "每个新帧", to: "接触", note: `raw − baseline − ${THRESHOLD}，限制在 0…100。` },
      { from: "接触", to: "归一化", note: `÷ 峰值；峰值低于阈值时 ÷ ${NOISE_SCALE}。` },
      { from: "归一化", to: "屏幕", note: `alpha 为 ${ALPHA} 的 EMA，然后 ×255，再套用 viridis 色图。` },
    ],
    foot: `PyFlexiTac 的 <code>FlexiTacSensor</code> 也做同样的几步，只是设置略有不同（阈值 ${PYFLEXITAC.threshold}，噪声缩放值 ${PYFLEXITAC.noiseScale}，结果限制在 0–1，<code>frame.normalized</code> 里没有 EMA）。本课按硬件仓库的查看器来讲。`,
  },
  code: {
    caption: "Python · 查看器对每一帧做的几步",
    params: [{ label: "阈值（计数）" }, { label: "平滑系数 alpha" }],
    notes: [
      `<code>base</code> 是基线：对 ${TAXELS} 个触觉像素中的每一个，取它前 ${INIT_FRAMES} 个读数的中位数。`,
      "<code>c</code> 是接触值：每个触觉像素比基线高出多少，再减去阈值，限制在 0 到 100 之间。",
      "<code>peak</code> 是这一帧里最强的触觉像素。除以它，整帧就被拉伸到 0–1，所以图像总能用满整个颜色范围。",
      `当 <code>peak</code> 低于阈值时，说明没有按压，于是改为除以 ${NOISE_SCALE}；残留的数值保持暗淡。`,
      `<code>s</code> 是平滑后的图像：${PCT} % 来自新帧，${100 - PCT} % 来自之前显示的图像。真正的查看器在显示循环每走一轮时做一次这样的混合。`,
      "<code>applyColorMap</code> 把 0–255 变成 viridis 颜色。修改这些数字，再点<b>运行</b>，就能重新调节实验室。",
    ],
  },
  specs: [
    { label: "帧大小", note: "AA 55 帧头 + 每个触觉像素一个字节" },
    { label: "帧头" },
    { label: "每秒帧数" },
    { label: "基线帧数", note: "每个触觉像素取中位数" },
    { label: "阈值", note: "高出基线不到这个数的读数会被忽略" },
    { label: "噪声缩放值", note: "峰值低于阈值时用的除数" },
    { label: "平滑系数 alpha（EMA）" },
    { label: "色图" },
    { label: "典型的静止字节值", note: "来自 PyFlexiTac 的文档字符串；实验室静止时约为 12" },
  ],
  quiz: [
    {
      q: "为什么查看器要从每一帧里减去基线？",
      choices: ["为了把字节换算成牛顿", "因为每个交叉点静止时的读数都略有不同", "为了找到 AA 55 帧头", "为了让帧变小"],
      why: "没被按的交叉点仍有一个小读数，而且每个都稍有不同。减去每个触觉像素自己的静止值，剩下的就只有你的手指带来的变化。",
    },
    {
      q: "你先在一个点轻轻按，再在同一个点用力按。热力图上最亮的颜色会怎样变化？",
      choices: ["用力按时更亮", "差不多不变", "变暗", "变成红色"],
      why: "每一帧都要除以它自己的峰值，所以最强的触觉像素总是接近 1。热力图显示你按在哪里；按得多重，在这一步就丢掉了。",
    },
    {
      q: "查看器启动时，你的手指一直按在传感垫上。松手之后会怎样？",
      choices: ["什么也不会发生：基线会忽略手指", "那个点的读数偏低，因为你的按压成了它基线的一部分", "整块传感垫都亮起来", "帧率下降"],
      why: "基线是前几帧的中位数。如果你一直在按，按压时的值就成了中位数，所以那个点只会显示比你最初那一下更重的按压。",
    },
    {
      q: `平滑步骤里的 alpha = ${ALPHA} 是什么意思？`,
      choices: [`只显示 ${PCT} % 的触觉像素`, `每个新帧占 ${PCT} %，之前的图像占 ${100 - PCT} %`, "图像总是晚 0.2 s 显示", "低于 0.2 的值会被隐藏"],
      why: "指数移动平均把新帧和已显示的图像混合起来。alpha 小，图像平滑但反应慢；alpha 为 1，就完全不平滑。",
    },
  ],
};
