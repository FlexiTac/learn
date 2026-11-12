// Chinese for src/lessons/07-meet-the-board.ts (docs/i18n.md; words per docs/i18n-terms-zh.md). An empty slot shows the English.
// The numbers come from the same shared data and models as the English lesson; lists go by place.
import { COLS, FRAME_HZ, MUX_OFFSET, R1, ROWS } from "@shared/data/constants.mjs";
import { driveLineInfo } from "@shared/models/scan.mjs";
import { getFact, num } from "../../content/facts";
import type { LessonZh } from "../../i18n/localize";
import { ORDER, ORDER_TOTAL, usd } from "../../widgets/pcb/cost";

const TAXELS = ROWS * COLS;
const LINES = ROWS + COLS;
const CHIPS = COLS / 8;
const LAST = MUX_OFFSET + ROWS - 1;
const KOHM = `${R1 / 1000}&nbsp;kΩ`;
const ASK = 20;
const askChip = driveLineInfo(ASK - 1).chip;
const mpn = (key: string) => (getFact(key).value as { mpn: string }).mpn;
const SIZE = (getFact("board.size").value as number[]).map((v) => v.toFixed(1)).join(" × ");
const VIAS = num("board.vias");
const HOLES = num("board.headerHoles");
const TRACE = "0.254";
const GAP = "0.152";
const INFERRED = `<span class="badge badge-inferred" title="指南的照片里 Nano 插在排母上，但没有讲怎么装">推断</span>`;
const EXTERNAL = `<span class="badge badge-external" title="EasyEDA 的做法，来自它自己的文档（链接见“规格”）">外部</span>`;

export const zh: LessonZh = {
  id: "meet-the-board",
  title: "读取板是怎么做出来的",
  kicker: "读取板",
  lede: `读取板是怎样从一张电路图，变成板上的铜线，再由工厂做出 ${ORDER.boards} 块板的。`,
  features: [
    { title: "都是认识的零件", text: `一块 Nano、${CHIPS} 片移位寄存器、一个多路选择器、R1 和两个座子` },
    { title: "2 层铜", text: `${TRACE} mm 宽的走线，${VIAS} 个过孔连通两面` },
    { title: `${ORDER.boards} 块 ${usd(ORDER_TOTAL)}`, text: "工厂做好电路板，并焊好零件" },
  ],
  overview: `
<p>读取板（reading board）是一块小小的<dfn data-term="pcb">PCB（印制电路板）</dfn>：一块硬板，板上的铜线把焊在上面的零件连起来。要是像第 2.1 课那样在面包板上搭同样的电路，得用几十根跳线，光是传感垫的线就要 ${LINES} 根。</p>

<p>板上的零件你都见过，每个零件都有一个简短的名字，图纸上用的就是它。第 2.1 课的 Nano 是 U1。R1 是一个 ${KOHM} 的电阻，作用和那一课里的一样：把电阻的变化变成 A0 上的电压。第 2.3 课的四片移位寄存器（shift register）是 U2 到 U5，多路选择器（multiplexer，简称 mux）是 U6。两个排线座子是 FPC1 和 FPC2：FPC1 接顶层 FPC 的 ${ROWS} 条感应线（sense line），FPC2 接底层 FPC 的 ${COLS} 条驱动线（drive line）。</p>

<p>一块电路板先从<dfn data-term="schematic">原理图（schematic）</dfn>开始：它只说明哪个引脚接哪个引脚，不管零件摆在哪里。原版图纸里，很多线不画到头，而是停在一个名字标签上，比如 SC5：标签相同的引脚是连在一起的。这块板是用 EasyEDA（立创EDA）画的，这是一款直接在网页浏览器里运行的 <dfn data-term="eda">EDA（电子设计自动化）</dfn>软件。</p>

<p>原理图里能看出一个设计上的选择：每片移位寄存器的 #OE（输出使能）引脚都接地（GND）。<code>#</code> 表示低电平有效，第 2.3 课讲过：这个引脚在 0 V 时起作用，所以输出一直打开。被选中的驱动线是 5 V，其余 ${COLS - 1} 条被拉到 0 V，而不是空着不接。否则，电流会绕道穿过其他被按下的交叉点（crossing），让一个没人按的点看起来也像被按下了，这叫<dfn data-term="ghosting">鬼影（ghosting）</dfn>。把其余驱动线拉到 0 V，能把这类电流的大部分引走。它能减轻鬼影，但不能完全消除。</p>

<p>接下来是 <dfn data-term="pcb-layout">PCB 版图（PCB layout）</dfn>：板子按真实大小画出来，${SIZE} mm，每个零件放在自己的位置上，再用铜线连起来。EasyEDA 会照着原理图生成版图：每个零件变成它的<dfn data-term="footprint">封装（footprint）</dfn>，也就是焊它引脚的那组铜焊盘；要接通的两个焊盘之间，先用一根细直线连着，这叫<dfn data-term="ratline">飞线（ratline）</dfn>。设计的人把零件拖到合适的位置，再沿着每根飞线画出铜线。文件导出之前，设计规则检查（DRC）会找出离别的铜线不到 ${GAP} mm 的地方 ${EXTERNAL}。</p>

<p>每条铜线叫一条<dfn data-term="trace">走线（trace）</dfn>，这块板上的走线都是 ${TRACE} mm 宽。这是一块双层板，正面一层铜，背面一层铜。一条走线要从另一条上面过去时，就钻进一个<dfn data-term="via">过孔（via）</dfn>，也就是一个内壁镀铜的小孔，到另一面接着走；这块板上有 ${VIAS} 个过孔。Nano 插在两排<dfn data-term="header-sockets">排母（header sockets）</dfn>上。排母是一排内壁镀金属的小孔，Nano 的针脚正好插进去；它把 Nano 架得够高，两片移位寄存器 U4 和 U5 就藏在它下面，所以板子可以做得很小。</p>

<p>要让工厂把它做出来，EasyEDA 会导出三种文件。<dfn data-term="gerber">Gerber 文件</dfn>每一层一张图：铜层、外形、钻孔，还有<dfn data-term="solder-mask">阻焊层（solder mask）</dfn>和<dfn data-term="silkscreen">丝印（silkscreen）</dfn>。阻焊层就是板上那层绿色的漆，丝印是板上白色的字。<dfn data-term="bom">BOM（物料清单）</dfn>列出 5 种零件，<dfn data-term="pick-and-place">坐标文件（pick-and-place）</dfn>写着 8 个小零件各自的位置和角度。JLCPCB（嘉立创）这样的工厂会把板子做出来，再把零件焊上去，这叫贴片，做好的板叫 <dfn data-term="pcba">PCBA（贴片成品板）</dfn>。</p>

<p>${ORDER.boards} 块板一共 ${usd(ORDER_TOTAL)}（不含运费）：做板 ${usd(ORDER.pcb)}，贴片 ${usd(ORDER.pcba)}。贴片费里大部分是每张订单只收一次的：开机费 ${usd(ORDER.setup)}，还有四种不常用零件的扩展库费 ${usd(ORDER.extended)}。所以订得越多，每块板越便宜。板子大约一周送到。</p>

<p>Nano 不在这张订单里，要你自己装：在板上留给 Nano 的 ${HOLES} 个孔里焊上两条 15 针的排母 ${INFERRED}，再把 Nano 插进去；也可以把 Nano 直接焊上。然后烧录（flash）固件（firmware），第 1.4 课会一步步带你做。想做一块一样的板，硬件指南里有它的 Gerber 文件、BOM 和坐标文件，用它们下单就行。</p>

<p>把这些零件连起来，就是两条通路。驱动通路给一条驱动线通电：D2 和 D3，然后是 U2–U5，再经过 FPC2 到传感垫。感应通路听一条感应线：从传感垫经过 FPC1、U6 到 A0，再加上 R1。读数属于两条线相交的那一个交叉点。第 2.6 课会讲读取板怎样走遍全部 ${TAXELS} 个交叉点，每秒 ${FRAME_HZ} 次。</p>`,
  wiring: {
    intro: "把原理图做成一张表：读取板上的每一处连接。除了排线的对应关系，其余都来自读取板的原理图，并用铜走线核对过。每根线在一帧里传的是什么，见第 2.6 课。",
    rows: [
      { to: "U2 SER（数据输入）", note: "数据引脚：送进第一片移位寄存器的 1 或 0。" },
      { to: "U2–U5 的 SRCLK 和 RCLK", note: "移位时钟和锁存时钟共用一根线：每拍一下，位就挪一格并被锁存（第 2.3 课）。" },
      { from: "U2、U3、U4 的 QH′", to: "下一片的 SER", note: `级联：${CHIPS} × 8 个格子合起来，就像一排 ${COLS} 个格子。U5 的 QH′ 没有连接。` },
      ...[0, 1, 2, 3].map((g) => {
        const a = driveLineInfo(g * 8);
        const b = driveLineInfo(g * 8 + 7);
        return { to: `驱动线 ${g * 8 + 1}–${g * 8 + 8}（${a.net}–${b.net}）`, note: `FPC2 第 ${a.fpc2Pin}–${b.fpc2Pin} 针。` };
      }),
      { from: "U2–U5 的 #OE", note: `输出始终打开：被选中的线为 HIGH，其余 ${COLS - 1} 条被驱动为 LOW。` },
      { from: "U2–U5 的 #SRCLR", note: "从不清零：格子里的位一直留着。" },
      { note: "用二进制表示的通道号；S0 是最低位（代表 1）。" },
      { to: "U6 E#（使能，低电平有效）", note: "为 LOW 时，多路选择器打开。" },
      { from: "FPC1 第 k 针（16 针）", to: "U6 通道 k − 1", note: `所以在这块传感垫上，第 1–${MUX_OFFSET} 针（通道 0–${MUX_OFFSET - 1}）什么也没接。` },
      { to: `Nano A0，另有 R1 ${R1 / 1000} kΩ 接到 GND`, note: "被选中的感应线上的电流，在 A0 处变成电压。" },
      { to: "U2–U6 的 VCC · GND", note: "每片芯片的电源，来自 USB 线。" },
      { to: "你的电脑", note: "5 V 电源从这里进来，数据帧从这里发出去。" },
      {
        from: "FPC2（32 针）· FPC1（16 针）",
        to: `底层 FPC 的驱动线 · 顶层 FPC 的感应线（FPC1 第 ${MUX_OFFSET + 1}–${LAST + 1} 针）`,
        note: "扁平排线。哪条铜线落在哪个针脚上，是按直通排线假设的。",
      },
    ],
    foot: "Nano 是 U1，芯片是 U2–U6，编号与读取板上的一致。<code>QH′</code> 是 595 的串行输出，也就是从最后一个格子掉出去的那一位。针脚从 1 开始数，多路选择器的通道从 0 开始数，与读取板和芯片的数据手册（datasheet）一致。",
  },
  specs: [
    { label: "读取板", note: "FlexiTac 论文中取整为 56.8 × 39.9 mm" },
    { label: "设计软件", value: "EasyEDA 标准版（v6.5）", note: "原理图和 PCB 版图都在网页浏览器里画" },
    { label: "从原理图到版图", value: "封装之间先用直线（飞线）连着，再沿着飞线画走线", note: "EasyEDA 的“转换到 PCB”" },
    { label: "铜层", note: "正面、背面各一层，用过孔连通" },
    { label: "走线", value: `宽 ${TRACE} mm，间距至少 ${GAP} mm`, note: "板上每条走线都一样宽；间距是这块板自己的设计规则，EasyEDA 的设计规则检查照着它来查铜线" },
    { label: "过孔", value: `${VIAS} 个 · 孔径 ${num("board.viaDrill")} mm`, note: "每个都把正面的一条走线接到背面" },
    { label: "Nano 排针孔", note: "两排，每排 15 个，用来焊 Nano 的排母" },
    { label: "Gerber 文件", value: "11 个：GTL、GBL、GTS、GBS、GTO、GBO、GTP、GKO、GDL 和 2 个钻孔文件", note: "两面各有铜层、阻焊层和丝印，还有锡膏层、外形、说明和钻孔" },
    { label: "用到的 Nano 引脚", value: "8 个：D2、D3（驱动）· D4–D8（mux）· A0", note: "2 个给移位寄存器；4 个选择 + 1 个使能给多路选择器；1 个模拟输入" },
    { label: "移位寄存器", note: "74HC595：每片 8 个输出，每条驱动线一个" },
    { label: "级联方式", value: "D2 → U2 → U3 → U4 → U5", note: "每片的 QH′ 接下一片的 SER；U5 的 QH′ 没有连接" },
    { label: "时钟", value: "D3 → 四片 595 的 SRCLK 和 RCLK", note: "移位和锁存共用一根线，所以输出比移位慢一拍" },
    { label: "输出使能", value: "#OE → GND", note: "输出一直打开；没被选中的驱动线保持 LOW" },
    { label: "多路选择器", note: "16 个通道接到一个输出 COM" },
    { label: "用到的通道", note: `感应线 n → 通道 n + ${MUX_OFFSET - 1}；通道 0–${MUX_OFFSET - 1} 不用` },
    { label: "选择与使能", value: "D4–D7 接 S0–S3 · D8 接 E#" },
    { label: "输出", value: "U6 的 COM 接 A0 · R1 从 A0 接到 GND" },
    { label: "R1", note: "原理图和坐标文件上写的“20k”是文档里的错误" },
    { label: "FPC2", value: `${mpn("board.part.FPC2")} · 32 针`, note: `${COLS} 条驱动线从这里接出，到底层 FPC` },
    {
      label: "FPC1",
      value: "16 针 · 间距 0.5 mm",
      note: `${ROWS} 条感应线从第 ${MUX_OFFSET + 1}–${LAST + 1} 针接入。BOM 上写的是 FFC05001-16SBB124W5M，但它的 LCSC 编号（C2856801）对应的是 FPC-05F-16PH20，JLCPCB 实际焊上的就是这个`,
    },
    { label: "开关导通电阻", note: "典型值，4.5 V 时；与 10 kΩ 电阻和触觉像素相比很小" },
    { label: `${ORDER.boards} 块组装好的板`, note: `做板 ${usd(ORDER.pcb)} + 贴片 ${usd(ORDER.pcba)}，每块约 ${usd(ORDER_TOTAL / ORDER.boards)}，不含运费` },
    { label: "制作时间", value: "大约一周", note: "做板 24 小时，贴片 2–3 天，再加上运输" },
  ],
  steps: [
    {
      title: "一块板，全是认识的零件",
      text: `板上的这些零件，你在第 2.1、2.3 和 2.4 课都见过：Nano、R1、两种芯片和两个排线座子。<span class="only-mouse">点击</span><span class="only-touch">轻点</span>读取板，抬起 Nano，看看每个零件的名字。`,
    },
    {
      title: "画原理图",
      text: `原理图只说明哪个引脚接哪个引脚，不管零件摆在哪里。从 D2、D3 出发，找到串成一串的四片移位寄存器。<span class="only-mouse">点击</span><span class="only-touch">轻点</span>一个零件看它的连线，也可以打开原版图纸。`,
    },
    {
      title: "摆零件、走铜线",
      text: `这是真实的板子，${SIZE} mm，正反两面都有走线。亮着的是时钟线，它经过过孔走到另一面。按<b>布线之前</b>，看看这些走线是沿着哪些细线画出来的。`,
    },
    {
      title: "交给工厂",
      text: `EasyEDA 导出 Gerber 文件、BOM 和坐标文件。工厂做了 ${ORDER.boards} 块板并焊好零件，共 ${usd(ORDER_TOTAL)}（不含运费），大约一周。Nano 由你自己装上并烧录（第 1.4 课）。`,
    },
    {
      title: "两条通路",
      text: `移位寄存器给一条驱动线通电（粉色），多路选择器把一条感应线接到 A0（青绿色）。两条线在传感垫上的一个交叉点相遇，第 2.6 课会把传感垫插上。`,
    },
  ],
  quiz: [
    {
      q: `驱动全部 ${COLS} 条驱动线，需要用到 Arduino 的几个引脚？`,
      why: `只要 D2（数据）和 D3（时钟）。级联的移位寄存器把这两个引脚上的一串位，变成 ${COLS} 个输出。`,
    },
    {
      q: `驱动线 ${ASK}（从 1 开始数）来自哪片芯片？`,
      why: `每片芯片有 8 个输出：U2 驱动第 1–8 条，U3 驱动第 9–16 条，U4 驱动第 17–24 条，U5 驱动第 25–32 条。第 ${ASK} 条是 ${askChip} 的输出 ${driveLineInfo(ASK - 1).q}。`,
    },
    {
      q: "多路选择器 U6 是做什么的？",
      choices: ["每次给一条驱动线通电", "每次把一条感应线接到 Nano 的 A0 引脚", "把一帧数据存起来，等电脑来取", "把 USB 电源变成 5 V"],
      why: `它是一个电子旋钮开关：D4–D7 从它的 16 个通道中选一个，那个通道上的感应线就接到 A0。${ROWS} 条感应线在通道 ${MUX_OFFSET}–${LAST} 上。`,
    },
    {
      q: "Nano 下面藏着哪两片芯片？",
      choices: ["U2 和 U3", "U4 和 U5", "U3 和 U6", "U2 和 U6"],
      why: "U4 和 U5，也就是这串移位寄存器的最后两片：抬起 Nano 就能看到。U2、U3、U6 和 R1 都露在外面。",
    },
    {
      q: "原理图和 PCB 版图画的是同一块板。哪一样只有版图上才有？",
      choices: ["哪些引脚连在一起", "每个零件摆在哪里、铜线怎么走", "每个芯片的型号", "哪个引脚是时钟"],
      why: "原理图只说明哪个引脚接哪个引脚。版图才是真实的板子：每个零件摆在哪里，每条走线走哪条路、在哪一面、有多宽。",
    },
    {
      q: "在双层板上，一条走线必须跨过另一条走线。设计者会用什么办法？",
      choices: ["过孔，把其中一条带到另一面", "更宽的走线", "在两条线之间加一个电阻", "在交叉的地方点一团焊锡"],
      why: `过孔是穿过板子的一个镀铜小孔。走线从这里钻下去，在另一面从那条线底下穿过，还可以再从另一个过孔回到正面。这块板上有 ${VIAS} 个过孔。点一团焊锡会把两条走线连成一根线。`,
    },
  ],
};
