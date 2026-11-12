// Chinese for src/lessons/09-one-frame.ts (docs/i18n.md; words per docs/i18n-terms-zh.md). An empty slot shows the English.
// The numbers come from the same shared data and models as the English lesson.
import { BAUD, COLS, FRAME_BYTES, FRAME_HZ, HEADER, MUX_OFFSET, ROWS } from "@shared/data/constants.mjs";
import { ADC_CLOCK_HZ, CONVERSION_CYCLES, CONVERSION_S, PRESCALER } from "@shared/models/adc.mjs";
import { byteIndex, frameSize, VARIANTS } from "@shared/models/scan.mjs";
import type { LessonZh } from "../../i18n/localize";

const TAXELS = ROWS * COLS;
const LAST = MUX_OFFSET + ROWS - 1;
const hx = (n: number) => n.toString(16).toUpperCase().padStart(2, "0");
const HDR = HEADER.map(hx).join(" ");
const FRAME_MS = 1000 / FRAME_HZ;
const BPS = FRAME_BYTES * FRAME_HZ;
const BITS_PER_BYTE = 10;
const LINK_SHARE = Math.round(((BPS * BITS_PER_BYTE) / BAUD) * 100);
const READ_US = Math.round(CONVERSION_S * 1e6);
const READS_MS = (TAXELS * CONVERSION_S * 1000).toFixed(1);
// Lesson 2.1's analogRead at the Arduino core's own prescaler (the English file says where these come from)
const ARDUINO_PRESCALER = 128;
const CPU_HZ = ADC_CLOCK_HZ * PRESCALER;
const ARD_S = (CONVERSION_CYCLES * ARDUINO_PRESCALER) / CPU_HZ;
const ARD_US = Math.round((ARD_S * 1e6) / 10) * 10;
const ARD_MS = Math.round((TAXELS * ARD_S * 1000) / 10) * 10;
const ARD_X = Math.round(TAXELS * ARD_S * FRAME_HZ);
const TIMES = ["一", "两", "三", "四", "五", "六", "七", "八", "九", "十"][ARD_X - 1] ?? String(ARD_X);
const PER_ROW = COLS + 2;
const CALLS = ROWS * PER_ROW;
const repo16 = VARIANTS.repo16;
const REPO16_BYTES = frameSize(repo16);
const bits = (ch: number) => (ch & 15).toString(2).padStart(4, "0");
const nb = (t: string) => t.replace(/ /g, "&nbsp;");
const Q = { row: 1, col: 0 };
const qByte = byteIndex(Q.row, Q.col) + 1;
const Q_ROW = 6;
const qCh = Q_ROW + MUX_OFFSET;
const band = (r: number) => `${byteIndex(r, 0) + 1}–${byteIndex(r, COLS - 1) + 1}`;
const BAUD_TXT = BAUD.toLocaleString("en-US");

export const zh: LessonZh = {
  id: "one-frame",
  title: "一帧数据",
  kicker: "读取板",
  lede: `插上传感垫，看读取板逐行读取它：一条感应线（sense line），全部 ${COLS} 条驱动线（drive line），然后换下一条。${TAXELS} 个读数，前面加上 <code>${HDR}</code>，组成一帧（frame）数据，共 ${FRAME_BYTES} 字节，每秒发送 ${FRAME_HZ} 次。`,
  features: [
    { title: "逐行读取", text: `一条感应线，全部 ${COLS} 条驱动线，然后换下一条` },
    { title: `${FRAME_BYTES} 字节`, text: `${HDR} + ${TAXELS} 个读数，每个读数一个字节` },
    { title: `${FRAME_HZ} 帧/秒`, text: `每 ${FRAME_MS} ms 一幅完整图像，经 USB 发送` },
  ],
  overview: `
<p>两根 FFC 排线把传感垫接到第 2.5 课的读取板（reading board）上：底层 FPC 的 ${COLS} 条驱动线接到 FPC2，在移位寄存器（shift register）旁边；顶层 FPC 的 ${ROWS} 条感应线接到 FPC1，在多路选择器（multiplexer，简称 mux）旁边。第 2.5 课最后讲到读取板上的两条通路，现在它们通到了传感垫上。读取板正在监听的感应线在传感垫上发青绿色的光，正在通电的驱动线发粉色的光，每个读数落进传感垫旁边那张图的一个方格里。像这样轮流读，第 2.3 课里就开始了。这种做法叫作<dfn data-term="time-multiplexing">分时复用（time multiplexing）</dfn>：几根线按先后顺序，为许多交叉点（crossing）服务。</p>

<p>驱动线用的是第 2.3 课那个“走动的 1”。固件往 U2 里放进一个 1，然后一直送 0；D3 上每出现一个上升沿（rising edge），这个 1 就往后走一条驱动线。因为 D3 同时也管锁存，输出总比格子晚一个时钟：第一个时钟把 1 放进第一个格子，第二个时钟才让驱动线 1 变成 HIGH。</p>

<p>感应线用的是第 2.3 课的通道号，写在 D4–D7 上，只是有一点不同。它们接在通道 ${MUX_OFFSET}–${LAST} 上，所以固件要把感应线的编号加上 <code>MUX_CHANNEL_OFFSET = ${MUX_OFFSET}</code>。固件从 0 开始给感应线编号（<code>i</code>），所以感应线 1 就是 <code>i = 0</code>，对应通道 ${MUX_OFFSET}。使能引脚 E#（D8）一直保持 LOW，让多路选择器开着，只在每一帧开始时有一个短短的 HIGH 脉冲。</p>

<p>固件的循环逐行进行。先发送两个帧头字节。然后对 ${ROWS} 条感应线中的每一条：让多路选择器指向它，往移位寄存器里放进一个 1 并锁存（2 个时钟）。接下来重复 ${COLS} 次：读 A0，把读数缩成一个字节，发送出去，再把 HIGH 移到下一条驱动线（1 个时钟）。这样每条感应线要 ${PER_ROW} 个时钟，每一轮有 ${TAXELS} 个读数。每一轮组成一帧，然后循环重新开始。</p>

<p>因为驱动线的循环在感应线循环的<b>里面</b>，字节到达的顺序是：先是感应线 1（<code>i = 0</code>）的全部 ${COLS} 条驱动线，然后是感应线 2（<code>i = 1</code>）的全部 ${COLS} 条，依此类推。固件从 0 开始数，所以感应线 <i>n</i> 就是 <code>i = n − 1</code>，驱动线 <i>m</i> 就是 <code>j = m − 1</code>。交叉点 <code>(i, j)</code> 的读数总在 <code>byte index = 2 + i × ${COLS} + j</code>。这里的 2 是为了跳过帧头。图下方的条带按这个顺序显示这一帧：先是 <code>${HDR}</code>，然后每条感应线一个块；点击一个块，读取板就跳到那个交叉点。</p>

<p>USB 串口传来的是一条没有尽头的字节流，帧和帧之间没有空隙。电脑开始监听时，往往落在某一帧的中间。<dfn data-term="header">帧头（header）</dfn><code>${HDR}</code>（${HEADER.join(" 和 ")}）就像一枚书签：查看器先找到这一对字节，再把接下来的 ${TAXELS} 个字节当作一幅图像。它不会再核对，所以如果两个相邻的读数恰好先是 ${HEADER[0]}、再是 ${HEADER[1]}，它就会被骗。那需要相邻交叉点之间出现一次急剧的跳变，这种情况并不常见。</p>

<p>第 2.1 课的 <code>analogRead()</code> 读一次大约要 ${ARD_US} µs。照这个速度，光是 ${TAXELS} 次读数就要大约 ${ARD_MS} ms，是一帧 ${FRAME_MS} ms 的${TIMES}倍。所以固件把 ADC（模数转换器）加快了。ADC 的时钟是 Nano 的 ${CPU_HZ / 1e6} MHz 时钟除以一个数，这个数叫<dfn data-term="prescaler">预分频器（prescaler）</dfn>。Arduino 自带的代码把它设为 ${ARDUINO_PRESCALER}，固件则设为 ${PRESCALER}，ADC 时钟就是 ${ADC_CLOCK_HZ / 1e6} MHz。这样读一次只要大约 ${READ_US} µs，${TAXELS} 次读数只占每帧 ${FRAME_MS} ms 里的大约 ${READS_MS} ms。</p>

<p>USB 链路还很宽裕。${FRAME_BYTES} 字节 × ${FRAME_HZ} 帧，就是每秒 ${BPS.toLocaleString("en-US")} 字节。串口发送每个字节要用 ${BITS_PER_BYTE} 位（一个起始位、8 个数据位和一个停止位），所以在 ${BAUD_TXT} baud 的<dfn data-term="baud">波特率（baud rate）</dfn>下，链路大约有 ${LINK_SHARE}% 的时间在忙。</p>

<p>每个触觉像素（taxel）每帧只被读取一次，每次只读大约 ${READ_US} µs。一帧中第一个读数和最后一个读数相隔几毫秒，所以这幅图并不是同一瞬间拍下的，就像手机相机的“卷帘快门”。但在这段时间里，指尖移动的距离远小于一个触觉像素，所以一帧可以当作一张快照：${ROWS + COLS} 根线，${TAXELS} 个触觉像素，每 ${FRAME_MS} ms 一幅图像。</p>

<p>硬件仓库里还有一个 ${repo16.rows} 行的固件，它会读取多路选择器的每一个通道：2 + ${repo16.rows} × ${COLS} = ${REPO16_BYTES} 字节。电脑期望的帧大小必须和读取板发送的一致，否则帧就对不齐。在代码卡片里试试：把 <code>ROW_COUNT</code> 设为 ${repo16.rows}，偏移量设为 ${repo16.muxOffset}。</p>`,
  wiring: {
    intro: `一帧期间，Nano 的每个引脚在做什么，以及 ${FRAME_BYTES} 个字节里每个字节从哪里来（字节从 1 开始数）。第 2.5 课的“接线”栏列出了读取板上的每一处连接。`,
    rows: [
      { to: "U2 SER（数据输入）", note: "每条感应线开始时为 HIGH，持续一个时钟（放进那个 1）；其余时间为 LOW。" },
      { to: "U2–U5 的 SRCLK + RCLK", note: `每条感应线 ${PER_ROW} 拍：2 拍用来放入并锁存那个 1，然后每条驱动线一拍。输出比格子晚一拍。` },
      { note: `感应线的通道号 i + ${MUX_OFFSET}，用二进制表示；每条感应线设置一次。` },
      { to: "U6 E#（使能，低电平有效）", note: "每帧一个 HIGH 脉冲，其余时间为 LOW。" },
      { to: "Nano A0（以及 R1 接 GND）", note: `每条感应线读 ${COLS} 次：每条驱动线为 HIGH 时读一次。` },
      { from: "第 1–2 字节", to: `帧头 ${HDR}`, note: "标记一帧的开始，不是读数。" },
      { from: `第 ${band(0)} 字节`, to: `感应线 1（通道 ${MUX_OFFSET}）`, note: `驱动线 1 到 ${COLS}，按顺序。` },
      { from: `第 ${band(1)} 字节`, to: `感应线 2（通道 ${MUX_OFFSET + 1}）`, note: `驱动线 1 到 ${COLS}。` },
      { note: `每条感应线一个 ${COLS} 字节的块。` },
      { from: `第 ${band(ROWS - 1)} 字节`, to: `感应线 ${ROWS}（通道 ${LAST}）`, note: `最后一个块；第 ${FRAME_BYTES} 字节是驱动线 ${COLS}。` },
      { to: "你的电脑", note: `每秒 ${FRAME_HZ} 帧，${BAUD_TXT} baud，发送的是原始字节（不是文本）。` },
    ],
    foot: "图和这张表从 1 开始数。代码从 0 开始数，所以这里的第 3 字节就是代码里的 <code>frame[2]</code>，感应线 1 就是 <code>i = 0</code>。",
  },
  code: {
    caption: "C++ · Arduino · PyFlexiTac template.ino（节选）",
    params: [{ label: "ROW_COUNT（感应线数）" }, { label: "MUX_CHANNEL_OFFSET（通道偏移量）" }],
    notes: [
      `<code>setRow(i)</code> 就是第 2.3 课的 <code>setChannel</code>，只是加上了偏移量：它把通道号 <code>i + ${MUX_OFFSET}</code> 写到 D4–D7 上，多路选择器再把这条感应线接到 A0：就是传感垫上青绿色的那条线。（真正的 setRow 还会每帧给 D8 上的 E# 一个脉冲；这里省略了。）`,
      `每调用一次 <code>shiftColumn</code>，D3 上就出现一个上升沿，和第 2.3 课的 <code>clockOnce()</code> 一样。<code>SET_SR_DATA_HIGH()</code> 这一类宏直接翻转 Nano 的 D 端口寄存器中的一位，比 <code>digitalWrite</code> 快得多。这很重要：一帧要调用它 ${CALLS} 次。`,
      "因为移位时钟和锁存时钟共用 D3，输出总比格子晚一个时钟：要调用两次，驱动线 1（<code>j = 0</code>）才变成 HIGH。之后每调用一次，HIGH 就往后移一条驱动线：就是传感垫上粉色的那条线。",
      `外层循环每走一轮，内层循环就跑 ${COLS} 次。所以图是逐行填满的，字节也是一条感应线接一条感应线地发出：<code>index = 2 + i × ${COLS} + j</code>。`,
      "<code>raw &gt;&gt; 2</code> 就是第 2.1 课说的除以 4：去掉 10 位读数中最低的两位，把 0–1023 变成 0–255，正好放进一个字节。",
      "<code>Serial.write</code> 把数字本身作为一个原始字节发送。<code>Serial.print(12)</code> 则会发送文本“12”：两个字节，帧也会大得多。第 2.1 课的程序用 <code>Serial.println</code> 发的就是这样的文本。",
      `<code>ROW_COUNT</code> 和 <code>MUX_CHANNEL_OFFSET</code> 必须和传感器一致：这块传感垫是 ${ROWS} 和 ${MUX_OFFSET}。如果偏移量是 0，固件会去读四个空通道，还会漏掉最后四条感应线。`,
      `试试 <code>ROW_COUNT ${repo16.rows}</code>、偏移量 <code>${repo16.muxOffset}</code>（仓库里 ${REPO16_BYTES} 字节的版本），然后点<b>运行</b>：图下方的帧条带会按这种帧重新绘制（图里仍是真实的 ${ROWS} × ${COLS} 传感垫）。行数加偏移量超过 16 时，会绕回到通道 0。`,
    ],
  },
  specs: [
    { label: "帧大小", note: `${HDR} + ${TAXELS} 个读数` },
    { label: "帧头" },
    { label: "帧率", note: `每 ${FRAME_MS} ms 一帧` },
    { label: "串口速率" },
    { label: "时钟", value: "D3 → 所有 595 的 SRCLK + RCLK", note: "输出比格子晚一个时钟" },
    { label: "一条感应线的开始", value: "每行第一次读数之前：shiftColumn(true); shiftColumn(false)" },
    { label: "每条感应线的时钟数", note: "2 个用来放入并锁存那个 1，然后每条驱动线一个" },
    { label: "用到的通道", note: `感应线 n（i = n − 1）→ 通道 i + ${MUX_OFFSET}` },
    { label: "E# 脉冲", value: "setRow(0)：每帧一次，E# 先 HIGH 再 LOW" },
    { label: "读数 → 字节" },
    { label: "ADC 预分频器", note: "16 MHz 主频下，ADC 时钟为 1 MHz" },
    { label: "每次读数的时间" },
    { label: "第 2.1 课的 analogRead", value: `每次读数约 ${ARD_US} µs`, note: `Arduino 自己的预分频器是 ${ARDUINO_PRESCALER}：${TAXELS} 次读数要大约 ${ARD_MS} ms` },
    { label: "数据速率", note: `8N1 串口下约占链路的 ${LINK_SHARE}%（每字节 ${BITS_PER_BYTE} 位）` },
    { label: `${repo16.rows} 行版本`, note: `2 + ${repo16.rows} × ${COLS}；不是默认版本` },
  ],
  steps: [
    {
      title: "插上传感垫",
      text: `两根 FFC 排线把传感垫接到读取板：${COLS} 条驱动线接 FPC2（在移位寄存器旁），${ROWS} 条感应线接 FPC1（在多路选择器旁）。点<b>演示一下</b>把它插上；再<span class="only-mouse">把鼠标移到排线上</span><span class="only-touch">轻点排线</span>，点亮它的线。`,
    },
    {
      title: "扫描一帧",
      text: `多路选择器监听一条感应线（青绿色），同时一个 HIGH 沿着驱动线移动（粉色）：每次一个交叉点。${HDR} + ${TAXELS} 个读数 = ${FRAME_BYTES} 字节，第一个读数是第 3 字节。点<b>演示一下</b>看最后一个：${nb(`第 ${FRAME_BYTES} 字节`)}。`,
    },
    {
      title: "按一按",
      text: `指尖压住大约十几个交叉点。在 1/100× 速度下，一帧要一秒：扫描到这些点时，它们的方格就亮起来。点<b>演示一下</b>看真实速度：每秒 ${FRAME_HZ} 帧，一幅实时的图像。`,
    },
  ],
  quiz: [
    {
      q: `字节从 1 开始数，感应线 ${Q.row + 1}（i = ${Q.row}）、驱动线 ${Q.col + 1}（j = ${Q.col}）的读数在帧的第几个字节？`,
      choices: [`第 ${qByte - 2} 字节`, `第 ${qByte - 1} 字节`, `第 ${qByte} 字节`, `第 ${qByte + COLS - 1} 字节`],
      why: `index = 2 + ${Q.row} × ${COLS} + ${Q.col} = ${qByte - 1}；从 0 数的 index ${qByte - 1}，就是从 1 数的第 ${qByte} 字节。`,
    },
    {
      q: `为什么每一帧都以 ${HDR} 开头？`,
      choices: ["告诉电脑传感器有多少行", "让电脑能在没有尽头的字节流里找到每一帧从哪里开始", "它是一个没被按压的触觉像素的读数", "它用来打开多路选择器"],
      why: "串口是一条没有空隙的长长的数据流。查看器寻找这对帧头字节，把后面的字节当作一帧，所以即使从数据流中间加入，它也能对齐。",
    },
    {
      q: `硬件仓库里 ${repo16.rows} 行固件的一帧有多大？`,
      why: `2 个帧头字节 + ${repo16.rows} × ${COLS} 个读数 = ${REPO16_BYTES}。电脑期望的大小必须和读取板发送的一致。`,
    },
    {
      q: "读取板每次只读一个交叉点。为什么热力图（heatmap）看起来仍是一幅完整的图？",
      choices: [
        "Nano 在同一瞬间读取所有触觉像素",
        `全部 ${TAXELS} 个读数都在一个 ${FRAME_MS} ms 的帧内完成，比手指移动快得多`,
        "电脑猜出了缺失的触觉像素",
        "每个触觉像素都有自己的线",
      ],
      why: `分时复用之所以行得通，是因为它很快：每个 ${FRAME_MS} ms 的帧里，每个交叉点都轮到一次，每秒 ${FRAME_HZ} 次。`,
    },
    {
      q: `固件选择感应线 ${Q_ROW + 1}（i = ${Q_ROW}）。这是哪个通道？D7 D6 D5 D4 是多少？`,
      choices: [
        `通道 ${Q_ROW} · ${bits(Q_ROW)}`,
        `通道 ${qCh} · ${bits(qCh)}`,
        `通道 ${qCh} · ${bits(qCh).split("").reverse().join("")}`,
        `通道 ${Q_ROW - MUX_OFFSET} · ${bits(Q_ROW - MUX_OFFSET)}`,
      ],
      why: `${Q_ROW} + ${MUX_OFFSET} = ${qCh}，二进制是 ${bits(qCh)}。D7 对应 S3（代表 8 的位），D4 对应 S0（代表 1 的位），所以从左到右读是 ${bits(qCh)}。`,
    },
    {
      q: `为什么固件要给每条感应线的编号加上 ${MUX_OFFSET}？`,
      choices: ["前几个通道留给了帧头字节", `传感垫的感应线接在通道 ${MUX_OFFSET}–${LAST} 上；通道 0–${MUX_OFFSET - 1} 是空的`, "为了跳过四个移位寄存器", "低编号的通道读得太慢"],
      why: `这个芯片有 16 个通道，传感垫用了其中 ${ROWS} 个，从通道 ${MUX_OFFSET} 开始。加上偏移量，每条感应线就指向它真正接着的那个通道。`,
    },
  ],
};
