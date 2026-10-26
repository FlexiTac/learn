// Chinese for src/lessons/12-build-your-own.ts (docs/i18n.md; words per docs/i18n-terms-zh.md). An empty slot shows the English.
// The numbers and prices come from the English lesson's own tables (BOM, LCSC) and the shared data.
// The build checklist's cards (BUILD in the English lesson) are in ./_build.ts (BUILD_ZH, read by the widget); the
// media list below takes their photo and clip words from there.
import { BAUD, COLS, FRAME_HZ, HEADER, MUX_OFFSET, R1, ROWS } from "@shared/data/constants.mjs";
import { getFact, num } from "../../content/facts";
import type { LessonZh } from "../../i18n/localize";
import { BOM, BUILD, LCSC, perSensor, usd } from "../12-build-your-own";
import { BUILD_ZH } from "./_build";

const h3 = (t: string) => `<h3 class="section-title" style="margin:1.6em 0 .3em">${t}</h3>`;
const BUILD_MIN = num("build.time");
const BAUD_TXT = BAUD.toLocaleString("en-US");
const LAST_CH = MUX_OFFSET + ROWS - 1;
const HDR = HEADER.map((b) => b.toString(16).toUpperCase()).join(" ");
const inf = '<span class="badge badge-inferred" title="根据固件、查看器和共享模型推断，资料中没有写明">推断</span>';
const ext = '<span class="badge badge-external" title="来自 FlexiTac 资料之外">外部</span>';
/** A badge and the full stop after it never part at a line end. */
const nw = (t: string) => `<span style="white-space:nowrap">${t}</span>`;
const fpcThick = getFact("fpc_top.thickness").value as number;

/** The BOM's part names (the English BOM, by its id). */
const BOM_PART: Record<number, string> = {
  1: "顶层 + 底层 FPC 一对",
  2: "聚酰亚胺胶带，4 in × 108 ft",
  3: "Velostat / Linqstat 薄膜（Adafruit 1361）",
  4: "带胶覆膜",
  5: "读取板 PCB，已组装",
  6: "Arduino Nano",
  7: "扁平排线，32 针（5 根装）",
  8: "扁平排线，16 针（5 根装）",
  9: "Mini USB 线（2 根装）",
  10: "20 针 FFC 转接板（Adafruit 4523）",
  11: "40 针 FFC 转接板（Adafruit 5203）",
};
/** The reading-board parts' jobs (the English LCSC table, by its ref). */
const LCSC_WHAT: Record<string, string> = {
  FPC1: "16 针、0.5 mm 扁平排线插座：感应线从这里进来",
  FPC2: "32 针、0.5 mm 扁平排线插座：驱动线从这里出去",
  R1: `${R1 / 1000} kΩ 电阻，分压电路（voltage divider）中下面的那个电阻`,
  "U2–U5": `移位寄存器：${COLS} 条驱动线`,
  U6: `16 通道多路选择器：${ROWS} 条感应线在通道 ${MUX_OFFSET}–${MUX_OFFSET + ROWS - 1}`,
};

const pick = (z: string | undefined | null, en: string) => (z && z.trim() ? z : en);

export const zh: LessonZh = {
  id: "build-your-own",
  title: `自己动手做：约 ${BUILD_MIN} 分钟`,
  kicker: "用起来",
  lede: `订购两块柔性电路板和一块小电路板，然后亲手把传感垫做出来：贴覆膜、放 Velostat、封边、接线。零件到手后，大约只要 ${BUILD_MIN} 分钟。接着给 Nano 烧录（flash）固件；如果画面看起来不对，再动手排查。`,
  features: [
    { title: "4 个步骤", text: "贴膜、叠层、封边、接线" },
    { title: `约 ${BUILD_MIN} 分钟`, text: "零件到手之后" },
    { title: "测试、烧录、排错", text: "先点亮测试，再运行 <code>flexitac-flash</code>，然后排查常见问题" },
  ],
  // the media list is BUILD's photos and clips, in order (the English lesson's `media`)
  media: BUILD.flatMap((s) => {
    const z = BUILD_ZH[s.id];
    const title = pick(z?.title, s.title);
    return [
      ...s.photos.map((p, i) => ({ alt: pick(z?.photos?.[i], p.alt), caption: title })),
      ...(s.clip ? [{ alt: pick(z?.clip, s.clip.caption), caption: pick(z?.clip, s.clip.caption) }] : []),
    ];
  }),
  overview: `
<p>这门课讲的一切，最后都落到一块你在书桌上就能做出来的传感垫上。两张 <dfn data-term="fpc">FPC（柔性电路板）</dfn>承载铜线，由电路板工厂制造；其余的都是文具：<dfn data-term="laminating-sheet">覆膜（laminating sheet）</dfn>、一小块 Velostat，以及<dfn data-term="polyimide">聚酰亚胺胶带（polyimide tape）</dfn>，也就是电子工程师到处都在用的那种耐热的琥珀色胶带。制作清单里的照片和短视频来自作者的硬件指南和视频。边做边勾选方框，页面会记住你的进度。</p>

${h3("四个步骤")}
<ol>
  <li><b>把每张 FPC 贴到一张覆膜上并对齐。</b>覆膜给薄薄的电路一个平整、挺括的背衬。</li>
  <li><b>把 Velostat 夹在两者之间。</b>把它放在电极（electrode）的正中，合上三明治：现在它已经能感知了。</li>
  <li><b>用聚酰亚胺胶带封边。</b>胶带把各层固定住，使用时不会滑开。</li>
  <li><b>接到读取板（reading board）。</b>每条尾线的<dfn data-term="gold-fingers">金手指（gold fingers）</dfn>插进一个连接器，再用扁平的 <dfn data-term="ffc">FFC 排线（flat flexible cable）</dfn>连到读取板。</li>
</ol>
<p class="aside" style="margin-top:.75em">指南说每块传感垫“&lt; 3 mins”；论文说大约 5 分钟。两者都假设零件已经裁好。</p>

${h3("第一次点亮")}
<p>用 USB 线把 Nano 接到电脑，启动查看器，捏一捏传感垫：应该有一个亮点跟着你的手指走。新买的 Nano 里是空的，所以第一次要先装上扫描程序。制作清单的最后两张卡片<b>烧录</b>和<b>排错</b>，分别对应下面两节。</p>

${h3("烧录固件")}
<p><dfn data-term="flash">烧录（flash）</dfn> Nano，就是通过 USB 把<dfn data-term="firmware">固件（firmware）</dfn>，也就是第 1.4 课里的扫描程序，复制到它的存储器里。只需要做一次：拔掉电源后程序还在，Nano 一通电就开始扫描。有四个设置必须和你的传感垫、查看器一致：</p>
<ul>
  <li><code>ROW_COUNT ${ROWS}</code>：要读多少条感应线（sense line）。固件把感应线叫作 <i>rows</i>，即“行”。</li>
  <li><code>COLUMN_COUNT ${COLS}</code>：要读多少条驱动线（drive line），即“列”（<i>columns</i>）。</li>
  <li><code>MUX_CHANNEL_OFFSET ${MUX_OFFSET}</code>：传感垫的第一条感应线在多路选择器（multiplexer，简称 mux）的通道 ${MUX_OFFSET} 上，所以 ${ROWS} 条线是通道 ${MUX_OFFSET}–${LAST_CH}。</li>
  <li><code>BAUD_RATE ${BAUD_TXT}</code>：<dfn data-term="baud">波特率（baud rate）</dfn>，也就是 USB 串口通信的速度。</li>
</ul>
<p style="margin-top:.75em">PyFlexiTac 的默认值正是这些，所以走捷径时不需要加任何选项。</p>
<p><b>方法 A · PyFlexiTac（推荐）</b></p>
<ol>
  <li>安装 Python 3，然后运行 <code>pip install "flexitac[examples]"</code>。这样你就有了 <code>flexitac-flash</code>、<code>flexitac-stream</code>、<code>flexitac-heatmap</code> 和 <code>flexitac-find-port</code>。</li>
  <li>安装 <dfn data-term="arduino-cli">arduino-cli</dfn>，然后执行一次 <code>arduino-cli core update-index</code> 和 <code>arduino-cli core install arduino:avr</code>（这是 Nano 芯片的支持包）。</li>
  <li>插上 Nano，运行 <code>flexitac-flash</code>。它把四个设置填进固件模板，编译，再上传。</li>
  <li>如果它提示 <i>no Arduino board detected</i>（没有检测到 Arduino 板），就自己指定端口和板卡：<code>flexitac-flash --port /dev/ttyUSB0 --fqbn arduino:avr:nano</code>。<dfn data-term="fqbn">FQBN（板卡全名）</dfn>是 arduino-cli 给每种板卡起的名字。</li>
</ol>
<p><b>方法 B · Arduino IDE</b></p>
<ol>
  <li>打开 ${ROWS} 行的程序：PyFlexiTac 的 <code>flexitac/firmware/template.ino</code> 已经写好了四个设置。（硬件仓库里的 <code>32_16_fast.ino</code> 是 16 行的版本；如果用它，要把设置改成一致。）</li>
  <li>选 <b>Tools → Board → Arduino AVR Boards → Arduino Nano</b>，再选 <b>Tools → Port</b>：Linux 上是 <code>/dev/ttyUSB0</code>，Windows 上是 <code>COM3</code> 之类，macOS 上是 <code>/dev/cu.usbserial-…</code>。</li>
  <li>点击 <b>Upload</b>，等到出现 <i>Done uploading</i>。如果失败并提示 <i>not in sync</i>，就选 <b>Tools → Processor → ATmega328P (Old Bootloader)</b>，再试一次 ${nw(`${ext}。`)}<dfn data-term="bootloader">引导程序（bootloader）</dfn>是 Nano 上一个很小的程序，负责接收新固件；很多 Nano，尤其是兼容板，用的是旧版引导程序。（用 <code>flexitac-flash</code> 时加上 <code>--fqbn arduino:avr:nano:cpu=atmega328old</code>。）</li>
</ol>
<p style="margin-top:.75em"><b>检查一下。</b>运行 <code>flexitac-stream --port /dev/ttyUSB0</code>：<b>fps</b> 会稳定在 ${FRAME_HZ} 左右，<b>raw_max</b> 静止时很小，一按就跳高。然后运行 <code>flexitac-heatmap --port /dev/ttyUSB0</code>。不要用 IDE 的 Serial Monitor（串口监视器）来检查：帧是原始字节，所以它只会显示乱码；而且它开着的时候，别的程序都用不了这个端口。</p>

${h3("画面不对时")}
<p>问题分两类：要么没有帧到达电脑（程序、端口或速率的问题），要么帧到了但画面不对（排线和传感垫的问题）。常见的嫌疑有：</p>
<ul>
  <li><b>没有串口，或者串口选错了。</b><code>flexitac-find-port</code> 会让你拔掉读取板，然后告诉你消失的是哪个端口。在 Linux 上，<i>Permission denied</i>（权限被拒绝）说明你的用户还不在 <code>dialout</code> 组里：运行 <code>sudo usermod -aG dialout "$USER"</code>，然后注销再登录。如果完全没有端口：换一根 USB 线（有些线只能充电）和一个 USB 口试试 ${nw(`${ext}。`)}</li>
  <li><b>波特率不对：fps 为 0，或者出现 <code>TimeoutError</code>。</b>查看器找不到帧。两边都必须用 ${BAUD_TXT} baud，而且你告诉查看器的行数和列数，必须和烧录进去的一致。</li>
  <li><b>帧对不齐。</b>每一帧都以帧头 <code>${HDR}</code> 开头；查看器找到它，再把后面“行数 × 列数”个字节当作一幅图像。如果它期望的帧大小和读取板发送的不一样（比如用硬件仓库的 16 行查看器去读 ${ROWS} 行的固件），它就会在错误的位置切开数据流，画面上就会多出几行，或者整行错位 ${nw(`${inf}。`)}</li>
  <li><b>所有读数都是 0</b>（或者都是 255），按不按都一样，而帧在正常到达：PyFlexiTac 的 README 说，全是 0 或全是 255 是<b>接线问题，不是烧录问题</b>。重新插好两根扁平排线和传感垫的两条尾线：完全插到底，触点对着连接器的触点，卡扣扣好。排线插反了，或者尾线没插到底，最可能是罪魁祸首 ${nw(`${inf}。`)}</li>
  <li><b>有一行或一列是死的。</b>画面的每一行是一条感应线，每一列是一条驱动线，所以某一行或某一列一直不变，说明问题出在那一条线上：连接器里的一个触点、一根插歪的排线，或者一条断裂的走线 ${nw(`${inf}。`)}</li>
  <li><b>传感垫上什么都没有，却全部发亮。</b>查看器启动时会记住每个交叉点的静止值。如果之后传感垫被弯折、夹住或挤压（排线或尾线绷紧、拉扯它的边缘也算），所有读数都会高于静止值，整张图就亮起来。把它放平，让排线松弛，然后重启查看器 ${nw(`${inf}。`)}</li>
</ul>
<p class="aside">清单里的<b>排错</b>卡片是一个故障排查器，能处理这些问题，还有另外几个（没有检测到板子、旧版引导程序、mux 偏移量留成了 0）。它的画面是算出来的：共享的扫描模型让固件对着一块按症状接线的传感垫运行，再由真实的查看器代码读取这些字节。</p>

${h3("订购 FPC")}
<p>FPC 由 JLCPCB 之类的 PCB 工厂制造。你把 <dfn data-term="gerber">Gerber 文件</dfn>发给它（一个压缩包，里面是每一层铜的图纸），再在报价页面上选好选项。指南的步骤是：</p>
<ol>
  <li>上传 <code>Gerber_Top_FPC_2026-03-02.zip</code>。基材（Base material）：<b>Flex</b>。厚度：<b>${fpcThick} mm</b>。</li>
  <li>高级选项：<b>Gold fingers: Yes</b>，金手指厚度 <b>0.3 mm</b>，这样尾线才能稳稳地插进连接器。</li>
  <li>对 <code>Gerber_Bottom_FPC_2026-03-02.zip</code> 重复一遍。指南里两种各订 100 张的报价是 $133.32 + $123.98，约合<b>每对 $2.57</b>。</li>
</ol>

${h3("订购已组装好的读取板")}
<p><dfn data-term="pcba">PCBA（贴片成品板）</dfn>的意思是工厂替你把芯片焊好。你要发送三个文件：Gerber 压缩包、<dfn data-term="bom">BOM（物料清单）</dfn>，以及说明每个零件位置的贴片坐标文件（pick-and-place）。</p>
<ol>
  <li>上传 <code>Gerber_16_32.zip</code>，并在报价页面靠下的位置打开 <b>PCB Assembly</b>。</li>
  <li>上传 <code>BOM_05mm_FFC_16_32_1mux_4sr_2025-11-01.csv</code> 和 <code>PickAndPlace_PCB_05mm_FFC_16_32_1mux_4sr_2025-11-01.csv</code>。检查五个零件都已匹配，并且有货：</li>
</ol>
<div class="table-wrap" style="margin:.75em 0">
<table class="pin-table">
  <thead><tr><th scope="col">位号</th><th scope="col">零件</th><th scope="col">LCSC</th></tr></thead>
  <tbody>${LCSC.map((p) => `<tr><td style="white-space:nowrap">${p.ref}</td><td>${p.part}<br><span class="foot">${pick(LCSC_WHAT[p.ref], p.what)}</span></td><td><code style="white-space:nowrap">${p.code}</code></td></tr>`).join("")}</tbody>
</table></div>
<ol start="3">
  <li>检查组装预览和 3D 渲染图：每个芯片都应该落在自己的焊盘上。</li>
  <li>指南里订购 5 块板共花了 <b>$40.41</b>（板子 $2.00，组装 $38.41），大约一周送达。其中大部分是一次性费用（工程费 $8.12，扩展元件费 $12.16），所以订得越多，每块板的价格就降得越多。</li>
</ol>
<p style="margin-top:.75em">Nano 不在组装订单里。读取板上为它留了两排孔，每排 15 个；把 Nano（或者两排 15 针的排母）焊上去即可。<span class="badge badge-inferred" title="来自读取板的钻孔文件；指南没有展示这一步">推断</span></p>

${h3("要花多少钱")}
<p>价格按指南物料清单上印的为准，算的是一块传感垫加一块读取板。“份额”是一个传感器用掉一包的多少。</p>
<div class="table-wrap" style="margin:.75em 0">
<table class="pin-table">
  <thead><tr><th scope="col">零件</th><th scope="col">单价</th><th scope="col">份额</th><th scope="col">每个传感器</th></tr></thead>
  <tbody>${BOM.map((b) => `<tr><td>${pick(BOM_PART[b.id], b.part)}</td><td>${usd(b.price)}</td><td>${b.share}</td><td>${usd(b.share * b.price)}</td></tr>`).join("")}
  <tr><td><b>传感垫</b> · <b>读取板</b> · <b>排线</b></td><td colspan="3"><b>${usd(perSensor("Pad"))}</b> · <b>${usd(perSensor("Board"))}</b> · <b>${usd(perSensor("Cables & tools"))}</b></td></tr></tbody>
</table></div>
<p class="foot" style="margin-top:.75em">来源：硬件指南的 BOM（指南把这三项取整为约 $4、约 $30 和约 $10）。论文（第 2.4 节）给出的价格是：FPC 一对，30 件时 $3.55，1000 件时 $1.36；裸板，30 件时 $3.10，1000 件时 $2.61；一套完整的传感器约 $30。价格会变，下单前请先核对。</p>
<p class="foot">连接器：指南的视频用的是小巧的 Adafruit 转接板（BOM 第 10–11 项，标为 20 针和 40 针），需要仔细对齐。指南还推荐了一种更好用、但更大的 AliExpress 转接板（第 12 项，$0.55–0.88）：选 16 针和 32 针的版本。</p>`,
  wiring: {
    intro: "第 4 步的细节，以及用来烧录和传输数据的 USB 线：什么插到哪里。",
    rows: [
      { from: `顶层 FPC 尾线 · ${ROWS} 根金手指`, to: "16 针连接器 + 16 针 FFC", note: `感应线。尾线有 ${ROWS} 根金手指；插座有 16 个位置。` },
      { from: "16 针 FFC", to: "读取板 FPC1", note: `多路选择器通道 ${MUX_OFFSET}–${MUX_OFFSET + ROWS - 1}，假设排线是直通的。` },
      { from: `底层 FPC 尾线 · ${COLS} 根金手指`, to: "32 针连接器 + 32 针 FFC", note: "驱动线。" },
      { from: "32 针 FFC", to: "读取板 FPC2", note: `四个移位寄存器的 ${COLS} 个输出。` },
      { to: "电脑，Mini-USB 线", note: "电源进来，帧出去；烧录固件也用这根线。烧录时传感垫可以一直插着。" },
    ],
    foot: "哪根金手指落在插座的哪个针脚上，取决于每根排线是怎么翻转的；资料里没有说，所以这个对应关系标为“推断”。如果热力图上的触摸错位了 4 行、有一行是死的，或者什么都没有，请看“概览”里的<b>画面不对时</b>，或者清单里的<b>排错</b>卡片。",
  },
  code: {
    caption: "Python · 做 n 个传感器要花多少钱（按指南价格）",
    params: [{ label: "传感器数量" }],
    notes: [
      "每一项都是指南价格乘以一个传感器用掉的份额：5 根装的排线是 0.2，一张 Velostat 是 0.05。",
      "这里每个传感器都配一块自己的读取板和 Nano，这是成本的大头。一次订很多块读取板，板子的价格会低很多（见“概览”里论文给出的数字）。",
      "点<b>运行</b>，算出 <code>n</code> 个的总价。",
    ],
  },
  specs: [
    { label: "制作时间", note: "每块传感垫，零件已裁好；论文说约 5 分钟" },
    { label: "FPC 厚度（下单选项）" },
    { label: "金手指厚度（下单选项）" },
    { label: "FPC 价格，100 对", value: "每对约 $2.57" },
    { label: "FPC 一对（BOM）" },
    { label: "读取板 PCBA，5 块", value: "共 $40.41", note: "大约一周送达" },
    { label: "Arduino Nano（BOM）" },
    { label: "一套完整传感器", note: "约数" },
    { label: "Velostat" },
    { label: "感应区域" },
    { label: "Nano 排针孔", note: "两排，每排 15 个" },
    { label: "默认固件", value: `PyFlexiTac ${ROWS} 行版本（mux 偏移量 ${MUX_OFFSET}）` },
    { label: "用到的 mux 通道", note: `偏移量 ${MUX_OFFSET}：帧的第 0 行 = 通道 ${MUX_OFFSET}` },
    { label: "串口速率" },
    { label: "IDE / arduino-cli 里的板卡", note: "旧版引导程序：Processor → ATmega328P (Old Bootloader)，或 cpu=atmega328old" },
    { label: "全是 0 或全是 255", value: "接线问题，不是烧录问题" },
    { label: "没有帧（fps 0，TimeoutError）", value: "行数、列数和波特率必须与烧录的一致" },
  ],
  quiz: [
    {
      q: "哪根扁平排线把感应线接到读取板？",
      choices: ["32 针排线，接 FPC2", "16 针排线，接 FPC1", "Mini-USB 线", "哪根都行，它们是一样的"],
      why: `顶层 FPC 的 ${ROWS} 条感应线经 16 针排线接到 FPC1 和多路选择器；${COLS} 条驱动线用 32 针排线接到 FPC2。`,
    },
    {
      q: "第 3 步的聚酰亚胺封边有什么用？",
      choices: ["让传感垫能感知压力", "防止各层滑动，让传感垫经得起真实使用", "让金手指绝缘", "设定基线"],
      why: "第 2 步之后，三明治就已经能感知了。指南加上封边，是为了让它足够结实，能用于真实实验。",
    },
    {
      q: "指南里 5 块组装好的读取板花了 $40.41，而论文给出的 30 块时的价格是每块 $3.10。为什么差这么多？",
      choices: ["论文写错了", "小订单要付一次性的工程费和元件费，大订单把它们分摊掉了", "指南的板子层数更多", "论文的价格包含运费"],
      why: "工程费和扩展元件费每个订单只收一次。分到 5 块板上，它们占了大头；分到 30 块或 1000 块上，几乎可以忽略。",
    },
    {
      q: "上传停在“stk500_getsync(): not in sync”。你该试什么？",
      choices: ["选择 Processor → ATmega328P (Old Bootloader)", "把波特率降到 9600", "把 ROW_COUNT 设为 16", "拔掉传感垫"],
      why: "很多 Nano 用的是旧版引导程序，它以不同的速度接收上传。选上它，上传就能同步。",
    },
    {
      q: "帧以正确的速率到达，但即使你按下去，每个字节也都是 0。你应该先检查什么？",
      choices: ["重新烧录固件", "改波特率", "扁平排线和传感垫尾线有没有在连接器里插好", "改选旧版引导程序"],
      why: "帧能到达，说明固件和波特率都没问题。全是 0 或全是 255 是接线问题，所以要重新插好排线。",
    },
  ],
};
