// Chinese for src/lessons/07-meet-the-board.ts (docs/i18n.md; words per docs/i18n-terms-zh.md). An empty slot shows the English.
// The numbers come from the same shared data and models as the English lesson.
import { COLS, FRAME_HZ, MUX_OFFSET, R1, ROWS } from "@shared/data/constants.mjs";
import { driveLineInfo } from "@shared/models/scan.mjs";
import { getFact } from "../../content/facts";
import type { LessonZh } from "../../i18n/localize";

const TAXELS = ROWS * COLS;
const CHIPS = COLS / 8;
const LAST = MUX_OFFSET + ROWS - 1;
const KOHM = `${R1 / 1000}&nbsp;kΩ`;
const ASK = 20;
const askChip = driveLineInfo(ASK - 1).chip;
const mpn = (key: string) => (getFact(key).value as { mpn: string }).mpn;

export const zh: LessonZh = {
  id: "meet-the-board",
  title: "认识读取板",
  kicker: "读取板",
  lede: `这块小电路板叫读取板（reading board），负责读取传感垫。把上面的 Arduino Nano 抬起来，每个零件都会出现标签：它是什么，负责哪一件事。`,
  features: [
    { title: "Arduino Nano", text: "运行扫描程序，并通过 USB 把每一帧发送到你的电脑" },
    { title: `2 个引脚 → ${COLS} 条驱动线`, text: `${CHIPS} 个级联的移位寄存器，U2–U5` },
    { title: `4 个引脚 → ${ROWS} 条感应线`, text: "一个多路选择器 U6，接到 Nano 的 A0 引脚" },
  ],
  overview: `
<p><b>读取板是做什么的。</b>传感垫只是一些铜线和 Velostat，它没法告诉任何人自己感觉到了什么。读取板负责去“问”它：它一个接一个地检查 ${TAXELS} 个交叉点（crossing），把每个交叉点变成一个数字，再通过 USB 线把它们全部发送到你的电脑，每秒 ${FRAME_HZ} 次。</p>

<p><b>抬起 Nano。</b>Arduino Nano 插在最上面的两排排母（header sockets）里，挡住了下面的两个芯片。把它抬起来，每个零件都会出现标签：</p>
<ul>
  <li><b>Arduino Nano</b>：大脑。一块只有一个芯片的小电脑（<dfn title="做在一个芯片上的小电脑，运行一个程序">微控制器（microcontroller）</dfn>）运行<a href="#/glossary/firmware"><dfn data-term="firmware">固件（firmware）</dfn></a>，也就是执行扫描的那个程序，并发送每一帧。</li>
  <li><b>USB 接口</b>：一根线干两件事：电从笔记本电脑送进来，帧从这里送出去。</li>
  <li><b>排母</b>：Nano 的引脚插在这里，所以不用焊接就能拔下来、插回去。</li>
  <li><b>移位寄存器 U2–U5</b>（74HC595）：四个芯片级联成一串，${CHIPS} × 8 = ${COLS} 个输出，每条驱动线（drive line）一个。<a href="#/glossary/shift-register"><dfn data-term="shift-register">移位寄存器（shift register）</dfn></a>就像一排小盒子，每个盒子装着一个 1 或 0，时钟每跳一下，就把它往后传一个盒子。这串芯片只用 Nano 的两个引脚来控制：<b>D2</b>（数据）和 <b>D3</b>（时钟），每次给一条驱动线通电。U4 和 U5 藏在 Nano 下面。</li>
  <li><b>FPC2</b>，32 针连接器：${COLS} 条驱动线从这里离开读取板，接到传感垫的底层 FPC。</li>
  <li><b>FPC1</b>，16 针连接器：顶层 FPC 的 ${ROWS} 条感应线（sense line）从这里接进来。</li>
  <li><b>多路选择器 U6</b>（CD74HC4067）：<a href="#/glossary/multiplexer"><dfn data-term="multiplexer">多路选择器（multiplexer，简称 mux）</dfn></a>是一个电子旋钮开关。它有 16 个输入，叫作<dfn data-term="channel">通道（channel）</dfn>，还有一个输出，接到 Nano 的 <b>A0</b> 引脚。Nano 的四个引脚 <b>D4</b> 到 <b>D7</b> 负责选通道（它们叫<dfn data-term="select-pins">选择引脚（select pins）</dfn>），所以 A0 每次只听到一条感应线。</li>
  <li><b>R1</b>，${KOHM}：就是第 1.2 课里的那个电阻。被选中的感应线上的电流经过它流到地，它两端产生的电压，就是 A0 测量的值。</li>
</ul>

<p><b>两条通路。</b>按顺序跟着这些零件走，你会在真实的芯片里看到第 1.2 课那条规则的两半。<b>驱动通路</b>给一条驱动线通电：D2 和 D3 → U2–U5 → FPC2 → 传感垫。<b>感应通路</b>监听一条感应线：传感垫 → FPC1 → U6 → A0，加上 R1。两条线相遇的那一个交叉点，就是正在被读取的点。读取板如何逐行走遍全部 ${TAXELS} 个交叉点，是下一课的内容。</p>

<p><b>16 个通道只用 ${ROWS} 个。</b>多路选择器有 16 个通道，但传感垫只有 ${ROWS} 条感应线。它们接在通道 ${MUX_OFFSET} 到 ${LAST}（FPC1 的第 ${MUX_OFFSET + 1}–${LAST + 1} 针）上；在这块传感垫上，通道 0–${MUX_OFFSET - 1} 什么也没接。</p>

<p class="aside"><b>其余 ${COLS - 1} 条线保持在 0 V。</b>移位寄存器的输出使能引脚 #OE 接地（<code>#</code> 表示<dfn data-term="active-low">低电平有效（active LOW）</dfn>：LOW 表示“输出打开”）。所以被选中的驱动线是 5 V，其余 ${COLS - 1} 条被牢牢拉到 0 V，而不是悬空。有些电流会偷偷绕过其他被按下的交叉点，让一个没人按的点看起来像被按下了（这叫<dfn data-term="ghosting">鬼影（ghosting）</dfn>）；这样接线能把这类电流的大部分引走。它能减轻鬼影，但不能完全消除。</p>`,
  wiring: {
    intro: "各零件是怎么连接的。除了排线的对应关系，其余都来自读取板的原理图和铜走线。第 1.4 课会展示一帧数据期间每根线上传的是什么。",
    rows: [
      { to: "U2 SER（数据输入）", note: "数据引脚：送进第一个移位寄存器的 1 或 0。" },
      { to: "U2–U5 的 SRCLK + RCLK", note: "时钟：一根线同时给四个芯片打拍子。" },
      { to: "下一个芯片的数据输入", note: "级联：4 × 8 个盒子合起来，就像一排 32 个盒子。U5 的 QH′ 没有连接。" },
      ...[0, 1, 2, 3].map((g) => {
        const a = driveLineInfo(g * 8);
        const b = driveLineInfo(g * 8 + 7);
        return { to: `驱动线 ${g * 8 + 1}–${g * 8 + 8}（${a.net}–${b.net}）`, note: `FPC2 第 ${a.fpc2Pin}–${b.fpc2Pin} 针。` };
      }),
      { from: "U2–U5 的 #OE", note: `输出始终打开：被选中的线为 HIGH，其余 ${COLS - 1} 条被驱动为 LOW。` },
      { note: "用二进制表示的通道号；S0 是最低位（代表 1）。" },
      { to: "U6 E#（使能，低电平有效）", note: "为 LOW 时，多路选择器打开。" },
      { from: "FPC1 第 k 针（16 针）", to: "U6 通道 k − 1", note: `所以在这块传感垫上，第 1–${MUX_OFFSET} 针（通道 0–${MUX_OFFSET - 1}）什么也没接。` },
      { to: `Nano A0，另有 R1 ${R1 / 1000} kΩ 接到 GND`, note: "被选中的感应线上的电流，在 A0 处变成电压。" },
      { to: "你的电脑", note: "5 V 电源进来；帧出去。" },
      {
        from: "FPC2（32 针）· FPC1（16 针）",
        to: `底层 FPC 的驱动线 · 顶层 FPC 的感应线（FPC1 第 ${MUX_OFFSET + 1}–${LAST + 1} 针）`,
        note: "扁平排线。哪条铜线落在哪个针脚上，是按直通排线假设的。",
      },
    ],
    foot: "芯片编号与读取板上的一致（U2–U6）。<code>QH′</code> 是 595 的串行输出，也就是从最后一个盒子掉出去的那一位。针脚从 1 开始数，多路选择器的通道从 0 开始数，与读取板和芯片数据手册一致。",
  },
  specs: [
    { label: "读取板", note: "2 层铜" },
    { label: "用到的 Nano 引脚", value: "8 个：D2、D3（驱动）· D4–D8（mux）· A0", note: "2 个给移位寄存器；4 个选择 + 1 个使能给多路选择器；1 个模拟输入" },
    { label: "移位寄存器", note: "74HC595：每个 8 个输出，每条驱动线一个" },
    { label: "级联方式" },
    { label: "时钟", value: "D3 → 所有 595 的 SRCLK + RCLK", note: "两个时钟连在一起 → 输出锁存器比移位级慢一个时钟" },
    { label: "输出使能", value: "#OE → GND（输出始终有驱动，未选中的驱动线保持 LOW）" },
    { label: "多路选择器", note: "16 个通道接到一个输出 COM" },
    { label: "用到的通道", note: `感应线 n → 通道 n + ${MUX_OFFSET - 1}；通道 0–${MUX_OFFSET - 1} 不用` },
    { label: "选择与使能" },
    { label: "输出", value: "A0 = mux COM；R1 从 A0 接到 GND" },
    { label: "R1", note: "原理图和贴片文件里的“20k”标注是文档错误" },
    { label: "FPC2", value: `${mpn("board.part.FPC2")} · 32 针`, note: `${COLS} 条驱动线从这里接出，到底层 FPC` },
    { label: "FPC1", value: `${mpn("board.part.FPC1")} · 16 针`, note: `${ROWS} 条感应线从这里接入，在第 ${MUX_OFFSET + 1}–${LAST + 1} 针` },
    { label: "开关电阻", note: "与 10 kΩ 电阻和触觉像素相比很小" },
  ],
  steps: [
    {
      title: "读取板",
      text: `这块板负责读取传感垫：它检查全部 ${TAXELS} 个交叉点，并通过 USB 把结果发送到你的电脑，每秒 ${FRAME_HZ} 次。<span class="only-mouse">点击</span><span class="only-touch">轻点</span>读取板，抬起 Nano，看看它的零件。`,
    },
    {
      title: "两条通路",
      text: `<b>驱动：</b>D2 和 D3 → 移位寄存器 U2–U5 → FPC2 → ${COLS} 条驱动线。<b>感应：</b>${ROWS} 条感应线 → FPC1 → 多路选择器 U6 → A0，加上 R1。<span class="only-mouse">点击卡片查看详情。</span><span class="only-touch">轻点零件查看详情。</span>`,
    },
  ],
  quiz: [
    {
      q: `驱动全部 ${COLS} 条驱动线，需要用到 Arduino 的几个引脚？`,
      why: `只要 D2（数据）和 D3（时钟）。级联的移位寄存器把这两个引脚上的一串位，变成 ${COLS} 个输出。`,
    },
    {
      q: `驱动线 ${ASK}（从 1 开始数）来自哪个芯片？`,
      why: `每个芯片有 8 个输出：U2 驱动第 1–8 条，U3 驱动第 9–16 条，U4 驱动第 17–24 条，U5 驱动第 25–32 条。第 ${ASK} 条是 ${askChip} 的输出 ${driveLineInfo(ASK - 1).q}。`,
    },
    {
      q: "多路选择器 U6 是做什么的？",
      choices: ["每次给一条驱动线通电", "每次把一条感应线接到 Nano 的 A0 引脚", "把一帧数据存起来，等电脑来取", "把 USB 电源变成 5 V"],
      why: `它是一个电子旋钮开关：D4–D7 从它的 16 个通道中选一个，那个通道上的感应线就接到 A0。${ROWS} 条感应线在通道 ${MUX_OFFSET}–${LAST} 上。`,
    },
    {
      q: "Nano 下面藏着哪两个芯片？",
      choices: ["U2 和 U3", "U4 和 U5", "U6 和 R1", "FPC1 和 FPC2"],
      why: "U4 和 U5，也就是这串移位寄存器的最后两个：抬起 Nano 就能看到。U2、U3、U6 和 R1 都露在外面。",
    },
  ],
};
