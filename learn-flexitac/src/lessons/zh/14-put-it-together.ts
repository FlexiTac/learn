// Chinese for src/lessons/14-put-it-together.ts (docs/i18n.md; words per docs/i18n-terms-zh.md: 覆膜 lamination sheet,
// 感应线 / 驱动线, 交叉点, 金手指, 转接板 extender, 排线 FFC). An empty slot shows the English.
import { COLS, ROWS } from "@shared/data/constants.mjs";
import type { LessonZh } from "../../i18n/localize";

const TAXELS = ROWS * COLS;

export const zh: LessonZh = {
  id: "put-it-together",
  title: "动手拼装",
  kicker: "从零件到机器人",
  lede: `一块 FlexiTac 的全部零件都摆在工作台上。按工作台下方进度条的顺序把它们拖到一起，从两块光秃秃的 FPC 一直拼到接好读取板的传感垫；不确定下一步时，点“提示”。`,
  features: [
    { title: "拼出传感垫", text: "覆膜、FPC 和 Velostat，按能感知压力的顺序叠好" },
    { title: "接好线", text: "每条尾线配对的转接板，每个座子配对的排线" },
    { title: "装好读取板", text: "最后插上 Nano；卡住时有提示帮你" },
  ],
  overview: `
<p>第 1.4 课照着照片，用手做出了一块传感垫。这一课在一张 3D 工作台上，由你自己把它一个零件一个零件地拼起来：两块 FPC、两张覆膜（lamination sheet）、一小块 Velostat、两块转接板、两根扁平排线、读取板和它的 Arduino Nano。每一个动作都是你在真实桌面上会做的事，顺序也一样。工作台下方的进度条标出了这个顺序，做到哪一步，视角就移到工作台的哪一块。</p>
<p>先把每块 FPC 铜面朝上贴到一张覆膜上。覆膜是一面带胶的透明薄膜，给这块薄薄的电路一个平整、挺括的背面。上层 FPC 有 ${ROWS} 条感应线（sense line），下层 FPC 有 ${COLS} 条驱动线（drive line），所以贴好的两块分别叫上半部分和下半部分。</p>
<p>Velostat 铺在下半部分上，盖住它的电极。然后把上半部分翻过来盖上去，让它的铜面贴住 Velostat，它的线和下半部分的线十字交叉。两条线交叉的每个地方都是一个触摸点，一共 ${TAXELS} 个，这就是传感垫。第 1.4 课接着会用聚酰亚胺胶带（polyimide tape）把边封住，免得各层滑开；这张工作台省掉了胶带这一步。</p>
<p>每块 FPC 都有一条尾线，尾端是一排金手指（gold finger）。下层尾线有 ${COLS} 根，要用 32 针转接板（extender），也就是一块两边各有一个座子的小板。上层尾线有 ${ROWS} 根，用的是 16 针转接板，空着四个位置。真实的传感垫上，两条尾线从同一个角伸出来，所以上层尾线要从宽的转接板上方翘过去，才能插进自己的转接板；工作台上也是这样画的。</p>
<p>每块转接板空着的一边插一根扁平排线（FFC），排线的另一头插到读取板上。16 针排线把感应线送到 FPC1，FPC1 通到多路选择器；32 针排线把驱动线送到 FPC2，FPC2 通到四个移位寄存器（第 2.3 和 2.5 课会把这些芯片拆开讲）。最后把 Nano 插进读取板的两排座子，USB 口朝向你。把它接到电脑上，读取板就能读出整块传感垫，就像第 1.3 课那样。</p>
<p>工作台不会让零件用错误的方式拼到一起。尾线配错的转接板、插错座子的排线、还没放 Velostat 就合上的上半部分，都会被拒绝，并告诉你原因。不知道下一步做什么时，“提示”会给出下一个动作，它的“替我做这一步”会替你做这一个动作。全部拼好后，Nano 的电源灯会亮，这一课就算完成了。</p>`,
  specs: [
    { label: "上层 FPC", value: `${ROWS} 条感应线，${ROWS} 根金手指` },
    { label: "下层 FPC", value: `${COLS} 条驱动线，${COLS} 根金手指` },
    { label: "感应区域", note: "两层线重叠的地方" },
    { label: "覆膜", value: "2 张，预先裁好，每块 FPC 一张", note: "这里画成 30 × 72 mm" },
    { label: "转接板", value: "16 针和 32 针，间距 0.5 mm", note: "两边各一个座子：一边插尾线，一边插排线" },
    { label: "扁平排线", value: "16 针和 32 针 FFC，间距 0.5 mm" },
    { label: "读取板座子", value: "FPC1：16 针（感应线）· FPC2：32 针（驱动线）" },
    { label: "Nano 座子", value: "两排各 15 个，间距 2.54 mm" },
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
  ],
};
