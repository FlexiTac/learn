// Chinese for src/lessons/13-fingers-and-cables.ts (docs/i18n.md; words per docs/i18n-terms-zh.md). Lists go by place,
// as in the English file; an empty slot shows the English. The stage's own words are in src/widgets/chips-lab.ts.
import { COLS, MUX_OFFSET, ROWS } from "@shared/data/constants.mjs";
import { stack } from "@shared/data/index.mjs";
import { getFact } from "../../content/facts";
import type { LessonZh } from "../../i18n/localize";

const LINES = ROWS + COLS;
const LAST = MUX_OFFSET + ROWS - 1;
const NF_T = getFact("fpc_top.fingers.count").value as number;
const NF_B = getFact("fpc_bot.fingers.count").value as number;
const FW = (getFact("fpc_top.fingers.size").value as [number, number])[0];
const PITCH = getFact("fpc_top.fingers.pitch").value as number;
const FPC_T = getFact("fpc_top.thickness").value as number;
const THICK = stack.fpcBuild.goldFingerThickness;

export const zh: LessonZh = {
  id: "fingers-and-cables",
  title: "金手指和排线",
  kicker: "芯片和连接器",
  lede: `传感垫的 ${LINES} 条线怎样接到读取板上：两条尾线上的金手指、一根 FFC 排线，和一个带锁扣的座子。`,
  features: [
    { title: "金手指", text: "每条尾线末端那排裸露的镀金触点" },
    { title: "FFC 排线", text: "并排封在塑料薄膜里的扁平铜条" },
    { title: "ZIF 座子", text: "掀开锁扣，插进排线，再压下" },
  ],
  overview: `
<p>第 2.3 课的芯片负责切换传感垫的线，可这些线得先接到芯片上。一共 ${LINES} 条线：顶层 FPC（Top FPC）的 ${ROWS}
条感应线，和底层 FPC 的 ${COLS} 条驱动线。这一课沿着它们走一遍：从传感垫的两条尾线出发，经过一块小转接板和一根排线，插进读取板上的两个座子。</p>

<p>每块 FPC 的尾线末端都有一排<dfn data-term="gold-fingers">金手指（gold fingers）</dfn>：镀了金的裸露触点。金不会氧化变色，所以触点一直接触良好。顶层
FPC 有 ${NF_T} 根，底层 FPC 有 ${NF_B} 根，每根宽 ${FW} mm，相邻两根中心相距 ${PITCH} mm。背面贴着的<dfn
data-term="stiffener">补强板（stiffener）</dfn>把 ${FPC_T} mm 的薄膜加厚到 ${THICK} mm，正是座子要求的厚度。内存条、显卡和游戏卡带也是这样插进去的。</p>

<p>每条尾线先插进一块小小的转接板（extender），板子两边各有一个座子，和第 1.5 课用的一样。从转接板的另一边，再由一根 <dfn
data-term="ffc">FFC 排线（flat flexible cable）</dfn>接到读取板，这样读取板可以离传感垫远一些。排线里是一条条并排的扁铜线，外面包着塑料膜，两端露出触点，每一端背面都贴着一块补强板。笔记本电脑、相机和打印机里用的也是这种排线。</p>

<p>在读取板上，每根排线插进一个 <dfn data-term="zif-connector">ZIF 座子（ZIF connector）</dfn>。ZIF
的意思是零插拔力：掀开锁扣，不用使劲就能把排线滑进去，再压下锁扣，座子里的弹片就压在裸露触点上。触点必须对着弹片。排线翻过来也一样插得进去，却什么都接不通。读取板上的两个座子标作
FPC1（接顶层 FPC 的 ${ROWS} 条感应线）和 FPC2（接底层 FPC 的 ${COLS} 条驱动线）。</p>

<p>把传感垫接上，在每个座子上都是同一个道理：打开锁扣，把那一端插进去，触点对着弹片，再合上锁扣。不同的只是朝向。硬件指南用的转接板，弹片在上面，所以尾线插进去时金手指朝上。读取板上的座子，弹片在下面，所以排线插进去时触点朝下。</p>

<p>第 3 步让你亲手接好这两处，看着这条线从传感垫一直亮到读取板。底层 FPC 的尾线也这样经过自己的转接板和排线，接到 FPC2。</p>

<p>第 2.5 课把 Nano、第 2.3 课的两种芯片和这两个座子放到一块小电路板上，再跟着这块板从一张图纸走到工厂。</p>`,
  specs: [
    { label: "顶层 FPC 金手指", note: "每条感应线一根" },
    { label: "底层 FPC 金手指", note: "每条驱动线一根" },
    { label: "金手指尺寸", note: "宽 × 长，两条尾线一样" },
    { label: "金手指间距", note: "中心到中心" },
    { label: "金手指处的厚度", note: `${FPC_T} mm 的 FPC 加上补强板（下单时的选项）` },
    { label: "FFC 转接板", value: "间距 0.5 mm · 触点朝上 · 抽屉式锁扣", note: "硬件指南用的 Adafruit 转接板，20 针和 40 针。把两侧的“耳朵”拉出来就打开，推回去就锁住。要用两端触点在同一面的排线（A-A 型）" },
    { label: "FPC2 座子", value: "THD0515-32CL-SN · 32 针", note: `${COLS} 条驱动线` },
    { label: "FPC2 类型", value: "间距 0.5 mm · 翻盖锁扣 · 下接触", note: "适配 0.3 mm 厚的排线" },
    { label: "FPC1 座子", value: "16 针 · 间距 0.5 mm", note: `${ROWS} 条感应线，接在第 ${MUX_OFFSET + 1}–${LAST + 1} 针；和 FPC2 一样是翻盖锁扣（据读取板照片）` },
    { label: "排线触点处", value: "厚 0.3 mm · 间距 0.5 mm", note: "读取板的座子要求的厚度（LCSC C283153；Hirose FH12 也是 0.3 ± 0.05 mm）" },
    { label: "排线类型", value: "两端的触点在同一面", note: "称为 A 型（Type A）" },
    { label: "常见 ZIF 座子的额定寿命", value: "约 20 次插拔", note: "Hirose FH12（0.5 mm）。资料里没有读取板自己那两个座子的额定值：插拔要轻，次数别太多" },
  ],
  steps: [
    {
      title: "金手指",
      text: `每条尾线末端都有一排金色触点，一条线一根：顶层 FPC ${NF_T} 根，底层 FPC ${NF_B} 根，间距 ${PITCH}&nbsp;mm。点一根金手指近看。内存条也这样插进去。`,
    },
    {
      title: "排线和座子",
      text: "掀开锁扣，插入排线，再压下锁扣，弹片就压在它的裸露触点上。再把排线翻过来试一次。触点背对着弹片，什么也接不通。",
    },
    {
      title: "把传感垫接上",
      text: "打开转接板的锁扣，插入尾线，让金手指对着弹片，再合上锁扣。然后把排线照样插进 FPC1。哪一段翻过来插，那条线就接不通。",
    },
  ],
  quiz: [
    {
      q: "为什么每条尾线末端的触点要镀金？",
      choices: ["金不会氧化变色，触点一直干净", "金能让尾线更硬", "铜不能传信号", "好看出哪面朝上"],
      why: "裸铜会慢慢氧化变色，氧化的触点接触不好。金一直干净，所以金手指每次插上都接触良好。让末端变硬的是背面的补强板。",
    },
    {
      q: "一根排线已经插到底、锁扣也压好了，可读取板在这些线上什么都读不到。先检查什么？",
      choices: ["它的裸露触点是否朝着座子的弹片", "排线够不够长", "锁扣是不是还开着", "Nano 有没有 5 V 供电"],
      why: "排线翻过来也一样插得进去，但裸露触点背对弹片，哪条线都接不通。掀开锁扣，把排线翻过来，再压下锁扣。",
    },
    {
      q: `顶层 FPC 的尾线有 ${NF_T} 根金手指。它的排线该插进读取板上的哪个座子？`,
      choices: ["FPC1", "FPC2", "哪个都行", "Nano 的 USB 口"],
      why: `FPC1 接 ${ROWS} 条感应线（在它的第 ${MUX_OFFSET + 1}–${LAST + 1} 针），再把它们送到多路选择器。FPC2 把移位寄存器的输出送到底层 FPC 的 ${COLS} 条驱动线。`,
    },
  ],
  wiring: {
    intro: "传感垫的线怎样从两条尾线走到读取板的两个座子。第 2.5 课列出了读取板上的全部连接。",
    rows: [
      { from: `顶层 FPC 尾线（${NF_T} 根金手指）`, to: "FFC 转接板", note: "每条感应线一根金手指，朝上对着转接板的弹片。" },
      { from: "FFC 转接板", to: "FFC 排线", note: "一块小板上，两个座子对接。" },
      { from: "FFC 排线", to: `FPC1 的第 ${MUX_OFFSET + 1}–${LAST + 1} 针`, note: `${ROWS} 条感应线，接着接到 mux 通道 ${MUX_OFFSET}–${LAST}（第 2.3 课）。` },
      { from: `底层 FPC 尾线（${NF_B} 根金手指）`, to: "FFC 转接板，再用 FFC 排线接到 FPC2", note: `${COLS} 条驱动线，来自移位寄存器的输出。` },
    ],
    foot: `全程间距 ${PITCH} mm。座子的针从 1 开始数，mux 通道从 0 开始数，和读取板上一致。`,
  },
};
