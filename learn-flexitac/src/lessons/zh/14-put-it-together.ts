// Chinese for src/lessons/14-put-it-together.ts (docs/i18n.md; words per docs/i18n-terms-zh.md: 覆膜 lamination sheet,
// 感应线 / 驱动线, 交叉点, 金手指, 转接板 extender, 排线 FFC). An empty slot shows the English. Step 2 and the second
// half of the overview are the Chinese of the old Lesson 1.3 ("Bytes to touch"); the lab's controls are named as the
// heatmap-lab widget names them in Chinese: 阈值 (Threshold), 重新校准 (Recalibrate).
import { ALPHA, COLS, FRAME_BYTES, FRAME_HZ, INIT_FRAMES, NOISE_SCALE, ROWS, THRESHOLD } from "@shared/data/constants.mjs";
import { PYFLEXITAC } from "@shared/models/host.mjs";
import type { LessonZh } from "../../i18n/localize";

const TAXELS = ROWS * COLS;
const PCT = Math.round(ALPHA * 100);
const h3 = (t: string) => `<h3 class="section-title" style="margin:1.6em 0 .3em">${t}</h3>`;

export const zh: LessonZh = {
  id: "put-it-together",
  title: "动手拼装",
  kicker: "动手做一个",
  lede: `一块 FlexiTac 的全部零件都摆在工作台上。按工作台下方进度条的顺序把它们拖到一起，从两块光秃秃的 FPC 一直拼到接好读取板的传感垫。然后测一测：按一按传感垫，看电脑怎样把它发来的字节变成实时的热力图。`,
  features: [
    { title: "拼出传感垫", text: "覆膜、FPC 和 Velostat，按能感知压力的顺序叠好" },
    { title: "接好线", text: "每条尾线配对的转接板，每个座子配对的排线，最后插上 Nano" },
    { title: "测一测", text: "按一按传感垫，跟着它的字节一路走到热力图" },
  ],
  steps: [
    {
      title: "拼装",
      text: "按工作台下方进度条的顺序把零件拖到一起，从两块 FPC 一直到 Nano。不确定下一步做什么？点<b>提示</b>。",
    },
    {
      title: "测一测",
      text: `传感垫已经接好，每秒发来 ${FRAME_HZ} 帧。在实验室里按一按它，跟着你的按压走过查看器的五个步骤，从原始字节一直到热力图。`,
    },
  ],
  overview: `
${h3("拼装")}
<p>第 1.3 课照着照片，用手做出了一块传感垫。这一课在一张 3D 工作台上，由你自己把它一个零件一个零件地拼起来：两块 FPC、两张覆膜（lamination sheet）、一小块 Velostat、两块转接板、两根扁平排线、读取板和它的 Arduino Nano。每一个动作都是你在真实桌面上会做的事，顺序也一样。工作台下方的进度条标出了这个顺序，做到哪一步，视角就移到工作台的哪一块。</p>
<p>先把每块 FPC 铜面朝上贴到一张覆膜上。覆膜是一面带胶的透明薄膜，给这块薄薄的电路一个平整、挺括的背面。上层 FPC 有 ${ROWS} 条感应线（sense line），下层 FPC 有 ${COLS} 条驱动线（drive line），所以贴好的两块分别叫上半部分和下半部分。</p>
<p>Velostat 铺在下半部分上，盖住它的电极。然后把上半部分翻过来盖上去，让它的铜面贴住 Velostat，它的线和下半部分的线十字交叉。两条线交叉的每个地方都是一个触摸点，一共 ${TAXELS} 个，这就是传感垫。第 1.3 课接着会用聚酰亚胺胶带（polyimide tape）把边封住，免得各层滑开；这张工作台省掉了胶带这一步。</p>
<p>每块 FPC 都有一条尾线，尾端是一排金手指（gold finger）。下层尾线有 ${COLS} 根，要用 32 针转接板（extender），也就是一块两边各有一个座子的小板。上层尾线有 ${ROWS} 根，用的是 16 针转接板，空着四个位置。真实的传感垫上，两条尾线从同一个角伸出来，所以上层尾线要从宽的转接板上方翘过去，才能插进自己的转接板；工作台上也是这样画的。</p>
<p>每块转接板空着的一边插一根扁平排线（FFC），排线的另一头插到读取板上。16 针排线把感应线送到 FPC1，FPC1 通到多路选择器；32 针排线把驱动线送到 FPC2，FPC2 通到四个移位寄存器（第 2.3 和 2.5 课会把这些芯片拆开讲）。最后把 Nano 插进读取板的两排座子，USB 口朝向你。</p>
<p>工作台不会让零件用错误的方式拼到一起。尾线配错的转接板、插错座子的排线、还没放 Velostat 就合上的上半部分，都会被拒绝，并告诉你原因。不知道下一步做什么时，“提示”会给出下一个动作，它的“替我做这一步”会替你做这一个动作。全部拼好后，Nano 的电源灯会亮，第 2 步就来测一测这块传感垫。</p>
${h3("测一测")}
<p>接到电脑上以后，读取板（reading board）发来一串字节。你电脑上的查看器程序（硬件仓库里的 <code>fast_32_16.py</code>，已逐行移植到这个页面里）先在数据流中找到<dfn data-term="header">帧头（header）</dfn>字节 <code>AA 55</code>。它们后面的 ${TAXELS} 个字节就是<dfn data-term="frame">一帧（frame）</dfn>。然后，它对每一帧做五件事。</p>
<p><b>1 · 原始字节。</b>每个字节（0–255）表示经过一个交叉点回来的电压有多大。没被按的交叉点仍有一点电流通过，所以它的读数是一个小数字，而不是 0。真实的传感垫静止时大约在 10–40。</p>
<p><b>2 · 基线。</b>每个交叉点静止时的读数都略有不同。所以查看器启动时，会记录前 ${INIT_FRAMES} 帧，并为每个触觉像素（taxel）保留<dfn data-term="median">中位数（median）</dfn>：把这 ${INIT_FRAMES} 个读数排好序，取中间那个。偶尔出现的尖峰会带偏平均数，却带不偏中位数。每个触觉像素的这个静止值就是<dfn data-term="baseline">基线（baseline）</dfn>。<b>校准时不要碰传感垫</b>，否则你的手指就成了“静止”的一部分。</p>
<p><b>3 · 接触。</b>对每个触觉像素计算 <code>raw − baseline − ${THRESHOLD}</code>，再把结果限制在 0 到 100 之间。<dfn data-term="threshold">阈值（threshold）</dfn>（${THRESHOLD} 个计数）去掉电噪声带来的小抖动，只留下真正的按压。</p>
<p><b>4 · 归一化。</b><dfn data-term="normalise">归一化（normalise）</dfn>就是把数值重新缩放到 0 到 1 之间。查看器把整帧除以其中最强的值（峰值，peak）。如果连峰值都低于阈值，说明其实没有东西在按，于是改为除以 ${NOISE_SCALE}，让残留的数值保持暗淡。有一点出人意料：因为这一步，轻按和重按都会达到最亮。<b>热力图（heatmap）显示的是你按在哪里，而不是按得多重。</b></p>
<p><b>5 · 平滑与上色。</b>每幅新图像都会和上一幅混合：<code>shown = ${ALPHA} × new + ${(1 - ALPHA).toFixed(1)} × previous</code>。这叫<dfn data-term="ema">指数移动平均（EMA）</dfn>；权重 ${ALPHA} 叫作 alpha。alpha 越小，图像越平稳，但反应越慢。最后，每个 0–1 的值从 <dfn data-term="viridis">viridis 色图（colour map）</dfn>里取一个颜色：从深紫经过青绿到黄色。色盲的人也能看清，印成灰度也能分辨。</p>
<p class="aside">试一试：把<b>阈值</b>设为 0，然后抬起手指，噪声会让整块传感垫都亮起来。再按住一个点，点击<b>重新校准</b>：松手之后，那个点就“失灵”了。这个实验室是<span class="badge badge-illustrative">示意</span>：按压力度和噪声是虚构的旋钮，但字节之后的每一步都是查看器的真实代码。</p>
<p class="aside">要用真实的传感垫来看，得先给 Nano 装上扫描固件：<a href="#/lesson/build-your-own">第 1.3 课“自己动手做”</a>讲了怎样烧录（flash）固件，以及图像一直是暗的或看起来不对时该检查什么。</p>`,
  wiring: {
    intro: "第 2 步：查看器的每一步在哪里进行。只有第一行在 Arduino 上运行；其余都在你的电脑上运行。",
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
      "<code>applyColorMap</code> 把 0–255 变成 viridis 颜色。",
    ],
  },
  specs: [
    { label: "上层 FPC", value: `${ROWS} 条感应线，${ROWS} 根金手指` },
    { label: "下层 FPC", value: `${COLS} 条驱动线，${COLS} 根金手指` },
    { label: "感应区域", note: "两层线重叠的地方" },
    { label: "覆膜", value: "2 张，预先裁好，每块 FPC 一张", note: "这里画成 30 × 72 mm" },
    { label: "转接板", value: "16 针和 32 针，间距 0.5 mm", note: "两边各一个座子：一边插尾线，一边插排线" },
    { label: "扁平排线", value: "16 针和 32 针 FFC，间距 0.5 mm" },
    { label: "读取板座子", value: "FPC1：16 针（感应线）· FPC2：32 针（驱动线）" },
    { label: "Nano 座子", value: "两排各 15 个，间距 2.54 mm" },
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
      q: "上半部分要怎样盖到 Velostat 上？",
      choices: ["铜面朝上，这样能看到线", "翻过来，铜线贴着 Velostat", "随便哪面都行：Velostat 能隔着薄膜导电", "竖着立起来"],
      why: "电极必须碰到 Velostat。上半部分翻过来，铜面才贴住它，它的线也和下半部分的线十字交叉。",
    },
    {
      q: `下层 FPC 的尾线有 ${COLS} 根金手指。它要用哪块转接板？`,
      choices: ["16 针转接板", "32 针转接板", "哪块都行", "都不用：它直接焊在读取板上"],
      why: `每条驱动线一根金手指，一共 ${COLS} 根，所以 32 针全都要用上。上层尾线的 ${ROWS} 根金手指用 16 针转接板正好。`,
    },
    {
      q: "上层 FPC 的排线接到读取板的哪个座子？",
      choices: ["FPC1，通到多路选择器的 16 针座子", "FPC2，32 针座子", "Nano 的 USB 口", "哪个座子都行"],
      why: "上层 FPC 走的是感应线。它的 16 针排线接 FPC1，FPC1 连到多路选择器；32 条驱动线走 FPC2，连到移位寄存器。",
    },
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
  ],
};
