// Chinese for src/lessons/02-the-sandwich.ts (docs/i18n.md; words per docs/i18n-terms-zh.md). An empty slot shows the English.
// The numbers come from the same shared data and models as the English lesson.
import { COLS, R1, ROWS } from "@shared/data/constants.mjs";
import stack from "@shared/data/stack.json";
import { vA0 } from "@shared/models/divider.mjs";
import { R_HARD, R_REST } from "@shared/models/taxel.mjs";
import { getFact, num } from "../../content/facts";
import type { LessonZh } from "../../i18n/localize";
import { fmtR } from "../../ui/ohms";

const FPC = num("fpc_top.thickness");
const VELO = num("velostat.thickness");
const LIMIT = stack.totalThickness.value;
const CORE = 2 * FPC + VELO;
const BUILD = stack.fpcBuild;
const AREA = getFact("pad.activeArea").value as number[];
const TAXELS = num("sensor.taxels");
const HZ = num("system.frameRate");
const mm = (v: number) => `${+v.toFixed(2)} mm`;
const nb = (t: string) => t.replace(/ /g, "&nbsp;");
const V_REST = vA0(R_REST, { rOn: 0 }).toFixed(2);
const V_HARD = vA0(R_HARD, { rOn: 0 }).toFixed(1);

export const zh: LessonZh = {
  id: "the-sandwich",
  title: "三明治结构",
  kicker: "传感垫",
  lede: `挤压 Velostat，它的电阻就会下降。然后从一个触摸点讲到整块传感垫：一条上层线压在一条下层线上，中间夹着 Velostat；接着是四个这样的点，最后是全部 ${TAXELS} 个，每次读取一个交叉点。五层薄片，总厚度不到 ${LIMIT}&nbsp;mm。`,
  features: [
    { title: "一个触摸点", text: "一条上层线、Velostat、一条下层线：一按，读数就升高" },
    { title: "每次一个交叉点", text: `监听一条上层线，给一条下层线通电：每幅图像 ${TAXELS} 个读数` },
    { title: `不到 ${LIMIT} mm`, text: `其中 ${mm(CORE)} 有资料依据；覆膜和胶带的厚度没有` },
  ],
  overview: `
<p>三明治好吃，是因为每一层都有自己的任务：面包负责托住，黄油负责粘合，馅料负责味道。FlexiTac 也一样：五张薄片平平地叠在一起，每一张都有它的用处。从上往下依次是：</p>
<ul>
  <li><b>覆膜（laminating sheet）</b>：上下各一张。</li>
  <li><b>顶层 FPC（Top FPC）</b>，上面有 ${ROWS} 条感应线（sense line）。</li>
  <li>中间的 <b>Velostat</b>。</li>
  <li><b>底层 FPC（Bottom FPC）</b>，上面有 ${COLS} 条驱动线（drive line）。</li>
</ul>
<p><b>中间三层负责感知。</b><dfn data-term="fpc">FPC</dfn>（柔性电路板）是印在一层又薄又能弯的塑料膜上的电路板，而不是印在硬的玻璃纤维板上。FlexiTac 的两张 FPC 每张厚 <b>${FPC} mm</b>，大约相当于两张纸。夹在它们之间的 <dfn data-term="velostat">Velostat</dfn> 厚 <b>${VELO} mm</b>。电流只有<b>穿过</b> Velostat 才能到达感应线，所以由 Velostat 决定有多少电流能通过：挤压它，通过的电流就更多。</p>
<p><b>一个触摸点。</b>顶层 FPC 的一条铜线和底层 FPC 的一条铜线交叉，中间隔着 Velostat，这就是一个<dfn title="上层一条线与下层一条线的一个交叉点：传感器的“像素”">触摸点</dfn>，也就是一个交叉点（crossing）。按压它，那里的 Velostat 导电更好，于是通过的电流更多，读取板（reading board）测到的电压就升高。</p>
<p><b>读取一个网格。</b>${ROWS} 条<dfn data-term="sense-line">感应线</dfn>沿一个方向排列，${COLS} 条<dfn data-term="drive-line">驱动线</dfn>沿另一个方向排列，所以每条感应线都和每条驱动线交叉一次：${ROWS} × ${COLS} = ${TAXELS} 个触摸点。读取板从不同时读取所有的点。它每次只监听一条感应线、只给一条驱动线通电（这条线接 5 V，其余的接 0 V），所以电流只能经过这两条线交叉的那一个点到达感应线：每个读数只反映那一个点。它逐条给驱动线通电，然后换到下一条感应线。${TAXELS} 个读数组成一幅图像，每秒 ${HZ} 幅。</p>
<p><b>铜面朝里。</b>每张 FPC <b>只有一面</b>有铜：制造文件里另一面什么都没有。要让交叉点工作，两边的铜条都必须接触 Velostat。所以底层 FPC 铜面朝上平放，顶层 FPC 则必须翻过来，<b>铜面朝下</b>。资料里从没直接这样写；这是我们根据文件和指南里的照片推断出来的，所以标了<span style="white-space:nowrap"><span class="badge badge-inferred">推断</span>。</span></p>
<p><b>外面两层把它固定在一起。</b><dfn data-term="laminating-sheet">覆膜</dfn>是一面带胶的薄塑料膜。在制作指南里，每张 FPC 先贴到各自的一张覆膜上，并按四角对齐。覆膜让 FPC 保持平整、位置不动；两张覆膜合起来又把整叠薄片包在里面，让全部 ${ROWS * COLS} 个交叉点上的铜都紧贴着 Velostat。Velostat 本身只是放在两张准备好的覆膜之间（指南第 2 步），靠整叠薄片夹住。</p>
<p>最后，用<dfn data-term="polyimide">聚酰亚胺胶带（polyimide tape）</dfn>把边缘封好。（图中和截面图里都没有画胶带，这样五个主要的层更容易看清。）聚酰亚胺就是做 FPC 用的那种结实的琥珀色塑料，所以这种胶带和传感器本身一样，又薄又结实，还能弯。指南给的理由很简单：它让传感垫“更结实，在真实实验中用得更久”。</p>
<p><b>整块有多厚？</b>论文说整块传感垫<b>不到 ${LIMIT} mm</b>。两张 FPC 加上 Velostat 是 ${FPC} + ${VELO} + ${FPC} = <b>${mm(CORE)}</b>。资料没有给出覆膜和胶带的厚度。但有一点可以确定：两张覆膜加上封边胶带，合起来一定比 ${LIMIT} − ${mm(CORE)} = <b>${mm(LIMIT - CORE)}</b> 薄。</p>
<p class="aside">第 4 步的截面图把各层画得比实际厚得多，好让你看清。按真实比例，和传感垫 ${AREA[0]} mm 的宽度相比，整个三明治只是薄薄的一片。</p>`,
  specs: [
    { label: "层数", value: "5 层 + 封边胶带", note: "覆膜、顶层 FPC、Velostat、底层 FPC、覆膜；聚酰亚胺胶带封住边缘" },
    { label: "整块传感垫" },
    { label: "顶层 FPC", note: `${ROWS} 条感应线，铜面朝下安装` },
    { label: "底层 FPC", note: `${COLS} 条驱动线，铜面朝上` },
    { label: "Velostat", note: "Adafruit 1361，4 mil" },
    { label: "Velostat 电阻率", note: "按压会降低它的电阻" },
    { label: "覆膜", value: "资料中未给出", note: "每张 FPC 贴在一张覆膜上（指南第 1 步）" },
    { label: "聚酰亚胺胶带", value: "资料中未给出", note: "封住边缘（指南第 3 步）；图中未画出" },
    { label: "FPC 铜层", value: "只有一面", note: "文件中另一层铜是空的" },
    { label: "顶层 FPC 的朝向", value: "铜面朝下", note: "这样两面的铜都接触 Velostat" },
    { label: "FPC 叠层", value: `${BUILD.copper} 铜 · ENIG 沉金`, note: `聚酰亚胺 ${BUILD.dielectric_um} µm，覆盖膜 ${BUILD.coverlay.replace("adhesive", "胶层")}` },
  ],
  steps: [
    {
      title: "挤压 Velostat",
      text: `<b>Velostat</b> 是掺了碳的黑色塑料，只有 ${nb(`${VELO} mm`)} 厚。挤压它：碳颗粒挤得更紧，电流有了更多通路，电阻就下降。它是一种<b>压阻（piezoresistive）</b>材料。`,
    },
    {
      title: "一个触摸点",
      text: `上层铜条压在下层铜条上，中间夹着 Velostat：这就是一个触摸点。下层铜条接 5&nbsp;V，上层铜条接 R1（${nb(fmtR(R1))}）。一按，它的电阻下降，R1 上的电压就升高，<span style="white-space:nowrap">≈${V_REST} → ${nb(`${V_HARD} V`)} <span class="badge badge-illustrative">示意</span>。</span>`,
    },
    {
      title: "四个触摸点",
      text: "两条上层线压在两条下层线上：四个触摸点。每次只监听一条上层线、只给一条下层线通电：每个读数就是它们交叉的那一个点。",
    },
    {
      title: `整块传感垫：${ROWS} × ${COLS}`,
      text: `同样的规则重复 ${ROWS} × ${COLS} 次：${TAXELS} 个触摸点，每个一个读数，每秒 ${HZ} 幅图像。扫描图下方是各层的截面：FPC 厚 ${nb(`${FPC} mm`)}，Velostat 厚 ${nb(`${VELO} mm`)}，总厚度不到 ${nb(`${LIMIT} mm`)}。`,
    },
  ],
  quiz: [
    {
      q: "资料给出了哪几层的厚度？",
      choices: ["全部五层", "两张 FPC 和 Velostat", "只有覆膜", "一层都没有"],
      why: `每张 FPC 厚 ${FPC} mm（来自指南中的 FPC 订单），Velostat 厚 ${VELO} mm（Adafruit 1361）。资料里没有覆膜和胶带的厚度。`,
    },
    {
      q: "为什么顶层 FPC 要铜面朝下安装？",
      choices: ["为了不让手指碰到铜", "它只有一面有铜，而这一面必须接触 Velostat", "这样覆膜粘得更牢", "不是这样的，两张 FPC 都朝上"],
      why: "在每个交叉点，电流都必须走 铜 → Velostat → 铜。既然只有一面有铜，两张 FPC 都必须朝向 Velostat，所以顶层那张要翻过来。（这是根据文件推断的，所以标为“推断”。）",
    },
    {
      q: "覆膜和聚酰亚胺胶带起什么作用？",
      choices: ["感知压力", "承载驱动线", "让各层保持平整、对齐并封好", "让传感垫变硬"],
      why: "它们不导电。它们让 FPC 保持平整、对齐，把铜压在 Velostat 上，并封住边缘，让传感垫经得起使用。",
    },
    {
      q: `论文说传感垫不到 ${LIMIT} mm，两张 FPC 和 Velostat 合计 ${mm(CORE)}。由此可知，两张覆膜加上封边胶带的厚度是多少？`,
      choices: [`正好 ${mm(LIMIT - CORE)}`, `小于 ${mm(LIMIT - CORE)}`, `大于 ${mm(LIMIT - CORE)}`, "什么也推不出"],
      why: `${LIMIT} − ${mm(CORE)}，留给两张覆膜和两条胶带的厚度小于 ${mm(LIMIT - CORE)}。这是一个上限，不是测量值。`,
    },
    {
      q: "在 2 × 2 网格中，读取板监听 S2、给 D1 通电。这个读数说的是哪个触摸点？",
      choices: ["同时说明全部四个", "S2 与 D1 交叉的那个点", "S2 上的每一个点", "S1 与 D2 交叉的那个点"],
      why: "只有 D1 接 5 V（D2 保持 0 V），也只有 S2 接到电表上，所以电流只能经过 S2 与 D1 交叉处的那一小块 Velostat 到达 S2。四个这样的读数组成 2 × 2 网格的一幅图像。",
    },
    {
      q: "你更用力地按压 Velostat，它的电阻会怎样？",
      choices: ["升高", "降低", "不变"],
      why: "Velostat 是压阻材料：挤压它会降低它的电阻，于是通过那个交叉点的电流更多。",
    },
  ],
};
