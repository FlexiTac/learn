// Chinese for src/lessons/08-two-chips.ts (docs/i18n.md; words per docs/i18n-terms-zh.md). Lists go by place,
// as in the English file; an empty slot shows the English. The stage's own words are in src/widgets/chips-lab.ts.
import { COLS, MUX_OFFSET, R1, ROWS } from "@shared/data/constants.mjs";
import { adcCode } from "@shared/models/adc.mjs";
import { R_ON, vA0 } from "@shared/models/divider.mjs";
import type { LessonZh } from "../../i18n/localize";
import { PRESS_N, R_PRESSED } from "../../widgets/chips/press";

const TAXELS = ROWS * COLS;
const LINES = ROWS + COLS;
const LAST = MUX_OFFSET + ROWS - 1;
const CHIPS = COLS / 8;
const KOHM = `${R1 / 1000}&nbsp;kΩ`;
const G_S = 4; // (the English file's step 3 grid)
const G_D = 8;
const R_FSR_K = Math.round(R_PRESSED / 100) / 10;
const A0_HERE = adcCode(vA0(R_PRESSED, { rOn: R_ON }));
const A0_BENCH = adcCode(vA0(R_PRESSED, { rOn: 0 }));
// (a button's name kept on one line)
const nw = (t: string) => `<span style="white-space:nowrap">${t}</span>`;
const WALK_MS = 500; // (the English sketch's delay)

export const zh: LessonZh = {
  id: "two-chips",
  title: "轮流工作的两颗芯片",
  kicker: "芯片和连接器",
  lede: `两种小芯片让一个模拟引脚读完全部 ${TAXELS} 个交叉点：一种一次只给一条驱动线通电，另一种一次只听一条感应线，两者轮流换下去。`,
  features: [
    { title: "多路选择器", text: "16 档开关：四个引脚决定 A0 听哪一条线" },
    { title: "移位寄存器", text: "八个格子传递一个 1，一次只开一个输出" },
    { title: "两颗芯片一起", text: "一条线通电，一条线被选中，读一个交叉点" },
  ],
  overview: `
<p>在第 2.1 课和第 2.2 课里，一个力传感器就占用一个模拟引脚。Nano 只有 8 个模拟引脚，传感垫上却有 ${TAXELS}
个交叉点（crossing），每个都是一个很小的力传感器。好在传感垫的接线已经帮了一半：${ROWS} 条感应线（sense line）和 ${COLS}
条驱动线（drive line）两两相交，所以读取板（reading board）只要给一条驱动线通电、听一条感应线，读到的就是这两条线相交的那一个交叉点（第 1.2
课）。读完一个再换下一个，快到一秒钟能把整块传感垫读上很多遍。</p>

<p>可这还是 ${LINES} 条线。Nano 只有 8 个模拟引脚来接 ${ROWS} 条感应线，14 个数字引脚来接 ${COLS} 条驱动线，哪边都不够。于是用两种便宜的芯片来切换：<dfn
data-term="multiplexer">多路选择器（multiplexer，简称 mux）</dfn>挑出 A0 要听的那条感应线，<dfn data-term="shift-register">移位寄存器（shift
register）</dfn>一次只给一条驱动线通电。它们就是第 1.2 课卡片上“选一条”和“驱动”那两个方框。</p>

<p>多路选择器相当于一个电子旋钮开关。它有 16 个输入，叫作<dfn data-term="channel">通道（channel）</dfn>，还有一个公共引脚 COM，接到
A0。第 2.1 课的电路还在，只是在 FSR 和 A0 之间多了这个开关。被选中通道的电流流过 ${KOHM} 的下拉电阻（pull-down resistor），变成 A0
读到的电压；那个通道没有电流时，下拉电阻把 A0 拉在 0 V。</p>

<p>四个<dfn data-term="select-pins">选择引脚（select pins）</dfn>S0–S3 决定选哪个通道。Nano 把每个引脚设成 HIGH（高电平）或
LOW（低电平），也就是 1 或 0。设成 1 的引脚，把它代表的数加进通道号：S0 代表 1，S1 代表 2，S2 代表 4，S3 代表 8。按 S3、S2、S1、S0
的顺序写（大的位在左边），1101 就是 8 + 4 + 0 + 1，即通道 13。这种写数的方法就是<dfn data-term="binary">二进制（binary）</dfn>。还有一个引脚
E# 是<dfn data-term="active-low">低电平有效（active LOW）</dfn>的：LOW 时芯片工作，HIGH 时所有通道都断开。</p>

<p>移位寄存器是一排八个格子，每格存一个<dfn data-term="bit">位（bit）</dfn>，也就是一个 1 或 0。一个引脚叫 DATA，决定下一个要送进去的位。另一个引脚叫<dfn
data-term="clock">时钟（clock）</dfn>：它每从 LOW 跳到 HIGH 一次，所有的位就往后挪一格，新的位进入第一格。第三个引脚叫锁存，它把八个格子一下子复制到另一排八个格子里，由这排格子驱动
QA 到 QH 八个输出；这排格子叫<dfn data-term="output-latch">输出锁存器（output latch）</dfn>。</p>

<p>先送进一个 1，再不停地打时钟、锁存，输出就一个接一个地亮起来。最后一格的位会从 QH′ 引脚出去，送进下一片芯片，所以 ${CHIPS}
片级联起来就像一排 ${COLS} 个格子。在读取板上，Nano 只用两个引脚控制这 ${CHIPS} 片：D2 是 DATA，D3 同时管时钟和锁存。</p>

<p>两种芯片合起来，一次只读一个交叉点。移位寄存器给一条驱动线加上 5 V，其余 ${COLS - 1} 条保持 0 V；多路选择器把一条感应线接到
A0。电流只能从这两条线相交的那个交叉点流到 A0。第 1 步的图，就是从多路选择器这一侧看到的这一刻：图里的 +5 V 就是通电的那条驱动线，每个 FSR
都是它上面的一个交叉点。</p>

<p>第 3 步把两颗芯片放到一小块网格上：${G_S} 条感应线乘 ${G_D} 条驱动线，就像把第 1.2 课的 2 × 2 卡片放大了。走动的 1
一条接一条地给驱动线通电，走完一遍，多路选择器就换到下一条感应线。每读一次就填好读数图的一格，所以按下一个交叉点，正好亮起一格。读取板读它的
${ROWS} × ${COLS} 个交叉点，也是这样。</p>

<p>第 2.4 课沿着传感垫的 ${LINES} 条线，从两条尾线一直走到读取板：金手指、FFC 排线和它们的座子。第 2.5 课再在真正的读取板上找到这些芯片，第
2.6 课读出一整帧。</p>`,
  specs: [
    { label: "多路选择器", note: "16 个通道和一个公共引脚 COM" },
    { label: "选择与使能", value: "D4–D7 接 S0–S3 · D8 接 E#" },
    { label: "用到的通道", note: `${ROWS} 条感应线；通道 0–${MUX_OFFSET - 1} 空着` },
    { label: "开关导通电阻", note: `4.5 V 时的典型值；比 ${R1 / 1000} kΩ 电阻小得多` },
    { label: "移位寄存器", note: "每片 8 个输出；QH′ 把最后一位传给下一片" },
    { label: "时钟", value: "D3 → U2–U5 的 SRCLK 和 RCLK", note: "每次时钟也同时锁存，所以输出晚一个时钟" },
    { label: "输出使能", value: "#OE → GND", note: `输出始终有效：没选中的 ${COLS - 1} 条驱动线保持 0 V` },
    { label: "图中的 FSR", value: `按下（${PRESS_N} N）${R_FSR_K} kΩ · 不按时断开`, note: `第 2.1 课的轻按，取自 Adafruit 的表格。A0 在这里读到 ${A0_HERE}，在第 2.1 课的实验台上读到 ${A0_BENCH}：开关的 ${R_ON} Ω 让它少了 ${A0_BENCH - A0_HERE}` },
    { label: "第 3 步的网格", value: `${G_S} 条感应线 × ${G_D} 条驱动线`, note: `传感垫 ${ROWS} × ${COLS} 网格中的一小块，用了多路选择器 16 个通道中的 ${G_S} 个，读的顺序一样` },
  ],
  steps: [
    {
      title: "选一条的开关",
      text: `多路选择器是一个 16 档开关。点 S0–S3，每个 1 都把它代表的数加进通道号。只有 FSR 被按下、它的通道又被选中时，A0 才读得到它。然后点<b>${nw("轮流读一遍")}</b>。`,
    },
    {
      title: "排成一排的八个格子",
      text: `设好数据位，再按<b>时钟</b>，所有的位就往后挪一格。<b>锁存</b>把格子复制到下面的输出上。播放“走动的 1”，再级联 4 片：还是这两个 Nano 引脚，就有 ${COLS} 个输出。`,
    },
    {
      title: "两颗芯片一起",
      text: `移位寄存器给一条驱动线通电，多路选择器选中一条感应线，只有它们的交叉点接到 A0。点交叉点把它按下，再点<b>${nw("全部读一遍")}</b>：每按下一个，读数图就亮一格。`,
    },
  ],
  quiz: [
    {
      q: "S3、S2、S1、S0 分别是 1、0、1、0。多路选择器选中的是哪个通道？",
      choices: ["5", "10", "12", "3"],
      why: "把它们当成一个二进制数来读：S3 代表 8，S1 代表 2，所以 1010 = 8 + 2 = 10。S2（代表 4）和 S0（代表 1）都是 0。",
    },
    {
      q: "只有通道 8 上的 FSR 被按着，而选择引脚选的是通道 5。A0 读到多少？",
      choices: ["和通道 8 的读数一样", "0", "1023", "通道 8 读数的一半"],
      why: "A0 只听得到被选中的通道。通道 5 上的 FSR 没被按下，没有电流到达 A0，下拉电阻把它拉在 0 V。选中通道 8，读数就回来了。",
    },
    {
      q: "一片 74HC595 里全是 0。数据位为 1 时打一次时钟，然后数据位为 0，再打三次时钟。这个 1 在哪个格子里？",
      choices: ["QA", "QC", "QD", "QH"],
      why: "第一次时钟把 1 放进 QA，之后每打一次时钟它就往后挪一格：QB、QC、QD。再锁存一次，输出 QD 就会亮。",
    },
    {
      q: "移位寄存器给驱动线 5 通电，多路选择器选中感应线 2。A0 能读到哪个交叉点？",
      choices: ["只有驱动线 5 和感应线 2 相交的那一个", "驱动线 5 上的每个交叉点", "感应线 2 上的每个交叉点", "所有交叉点一起"],
      why: "电流从通电的驱动线进来，从被选中的感应线出去。同时在这两条线上的交叉点只有一个，所以 A0 只读到它。然后扫描换到下一个。",
    },
  ],
  wiring: {
    intro: "Nano 怎样控制读取板上的两种芯片。引脚名称沿用芯片厂家的叫法：SER 就是 DATA，SRCLK 是时钟，RCLK 是锁存。名字前面或后面的 # 表示低电平有效的引脚。U2–U5 是四片移位寄存器，U6 是多路选择器，和读取板上印的一样。第 2.5 课列出了全部连接。",
    rows: [
      { from: "Nano D4、D5、D6、D7", to: "Mux S0、S1、S2、S3", note: "用二进制表示通道号：S0 代表 1，S3 代表 8。" },
      { from: "Nano D8", to: "Mux E#（使能）", note: "低电平有效：LOW 时多路选择器工作。" },
      { from: "Mux 的 COM", to: `Nano A0，并经 ${R1 / 1000} kΩ 接 GND`, note: "被选中的通道接到 A0。" },
      { from: `Mux 通道 ${MUX_OFFSET}–${LAST}`, to: `${ROWS} 条感应线（FPC1）`, note: `这块传感垫不用通道 0–${MUX_OFFSET - 1}。` },
      { from: "Nano D2", to: "U2 SER（数据）", note: "进入第一个格子的那一位。" },
      { from: "Nano D3", to: "U2–U5 的 SRCLK 和 RCLK", note: "一个引脚管时钟和锁存：每次时钟也同时锁存。" },
      { from: "U2、U3、U4 的 QH′", to: "下一片的 SER", note: `级联：${CHIPS} × 8 个格子就像一排 ${COLS} 个。` },
      { from: "U2–U5 的 QA–QH", to: `${COLS} 条驱动线（FPC2）`, note: "每条驱动线一个输出。" },
      { from: "U2–U5 的 #OE", to: "GND", note: "低电平有效，所以输出始终有效。" },
      { from: "U2–U5 的 #SRCLR", to: "5 V", note: "低电平有效，所以格子从不清零。" },
    ],
    foot: "引脚从 1 开始数，mux 通道从 0 开始数，和读取板上一致。",
  },
  code: {
    caption: "C++ · Arduino · 试一试这两种芯片的小程序",
    notes: [
      "<code>digitalWrite(pin, HIGH)</code> 让引脚输出 5 V，<code>LOW</code> 输出 0 V。在 <code>setup()</code> 里，<code>pinMode(p, OUTPUT)</code> 把 D2–D8 设成输出。它们一开始都是 LOW，所以 D8 上的 E# 是 LOW，多路选择器打开。",
      "<code>setChannel(ch)</code> 把通道号写到 D4–D7，每个引脚一位。<code>bitRead(ch, b)</code> 取出 <code>ch</code> 的第 <code>b</code> 位，是 0 或 1：<code>setChannel(13)</code> 依次往 D4、D5、D6、D7 写 1、0、1、1。从 D7 读到 D4，正是 1101。",
      "接着 <code>analogRead(A0)</code> 读出多路选择器选中的那条线，范围 0 到 1023，和第 2.1 课一样。",
      "<code>clockOnce()</code> 在 D3 上发一个脉冲：先 HIGH，再 LOW。D3 跳到 HIGH 的那一刻叫<dfn data-term=\"rising-edge\">上升沿（rising edge）</dfn>，所有的位就在这一刻往后挪一格。在读取板上，D3 同时接锁存引脚，所以每个脉冲也会锁存（第 2.6 课会讲这带来什么变化）。",
      `每轮读一次 A0、打一次时钟。每 ${COLS} 轮才送进一个 1，于是这一个 1 沿着 ${CHIPS} 片芯片的全部 ${COLS} 个输出走一遍，一次只有一条驱动线通电，和读取板一样。按 <code>delay(${WALK_MS})</code>，走完一趟要 ${(COLS * WALK_MS) / 1000} 秒；在输出上接 LED，就能看着它走。`,
    ],
    params: [{ label: "setChannel（0–15）" }],
  },
};
