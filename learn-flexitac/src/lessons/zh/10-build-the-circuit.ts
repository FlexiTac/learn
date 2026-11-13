// Chinese for src/lessons/10-build-the-circuit.ts (docs/i18n.md; words per docs/i18n-terms-zh.md: strip 小排, power
// rail 电源轨, short circuit 短路, floating 悬空, as the build engine's words). An empty slot shows the English.
import { COLS, ROWS } from "@shared/data/constants.mjs";
import type { LessonZh } from "../../i18n/localize";
import { FSR_TABLE } from "../../widgets/bench/fsr";
import { F_PRESS, RESPONSIVE } from "../../widgets/build/engine";

const TAXELS = ROWS * COLS;
const ohms = (r: number) => (r >= 1000 ? `${r / 1000} kΩ` : `${r} Ω`);

export const zh: LessonZh = {
  id: "build-the-circuit",
  title: "亲手搭起来，让它工作",
  kicker: "Arduino 基础",
  lede: `在一块空面包板上亲手搭出第 2.1 课的电路，拼好程序，上传，再按一按传感器。只有接线和程序对得上，它才会工作。`,
  features: [
    { title: "面包板", text: "放好 Nano、传感器和电阻" },
    { title: "跳线", text: "把该连的小排连起来" },
    { title: "上传，按一按", text: "接线和程序都对，它才会工作" },
  ],
  overview: `
<p>第 2.1 课的电路是现成搭好的。这一课你要自己动手，从一块空面包板开始，搭到传感器一按就有反应。零件你来放，跳线你来接，程序你来拼，再上传到板子上。</p>
<p>面包板看上去是一排排互不相干的孔，其实里面有金属夹片，把孔一组一组连在一起。在这块面包板上，每个编了号的列有两组孔，每组五个：a 到 e 行一组，f 到 j 行一组。每一组叫一个<dfn data-term="strip">小排（strip）</dfn>。插在一个小排里的脚或线，会和这个小排里的所有东西连通，和别处都不连。</p>
<p>面包板的上下两条边上是<dfn data-term="power-rail">电源轨（power rail）</dfn>，标着 + 和 −。每条电源轨是一整条长长的小排，所以一根线就能把 5V 或 GND 引到面包板上任何地方。</p>
<p>中间那道槽上没有夹片横跨，上下两半互不相连。Nano 的两排引脚离得太远，进不了同一小排，所以它跨在槽上，一边一排。这样每个引脚都有自己的一小排。</p>
<p>要搭的就是第 2.1 课的电路。5V 接到力传感器（FSR）的一只脚上；它的另一只脚接到 A0，也接到 10 kΩ 的下拉电阻；电阻的另一条腿接到 GND。在面包板上，“接到”的意思是“在同一个小排里”，直接插在一起或者用跳线连过去都行。</p>
<p>工作台检查你的电路，靠的是电的规律，而不是对照唯一的标准答案。它先算出哪些孔连在一起，再算出每个引脚上的电压，最后算出 <code>analogRead()</code> 会返回什么。只要该连的都连对了，零件放在哪里、跳线是什么颜色都没关系。</p>
<p>出了问题，看现象就知道该去哪里找。USB 一插上板子就断电，说明有<dfn data-term="short-circuit">短路（short circuit）</dfn>：5V 直接连到了 GND。读数一直是 1023，说明 A0 直接连到了 5V。读数乱跳，说明 A0 处于<dfn data-term="floating">悬空（floating）</dfn>状态，没有东西把它的电压定住。</p>
<p>串口监视器一片空白，问题在程序或者 USB 线。满屏乱码，说明程序和监视器用的<dfn data-term="baud">波特率（baud rate）</dfn>不一样，也就是连接的速度不同。每一种失败，工作台都会说出原因并给出提示。</p>
<p>第 2.1 课留下的问题还在。这一个传感器就占了 Nano 8 个模拟引脚中的一个，而一块 FlexiTac 传感垫有 ${TAXELS} 个交叉点。第 2.3 课介绍两颗芯片，让一个引脚就能把它们全部读完。</p>`,
  wiring: {
    intro: "对照这个电路检查你的接线，它是第 2.1 课的电路搭在工作台这块面包板上的样子。你的零件放在别处也可能是对的，关键是哪些小排连在了一起。",
    rows: [
      { from: "Nano", to: "第 3–17 列，c 行和 g 行", note: "跨在槽上：数字引脚在 c 行，模拟引脚和电源引脚在 g 行" },
      { from: "Nano 5V（14g）", to: "FSR 引脚 1（24j）", note: "红线，从 14h 到 24h" },
      { from: "Nano A0（6g）", to: "FSR 引脚 2（25j）", note: "黄线，从 6i 到 25i" },
      { from: "FSR 引脚 2（25j）", to: "10 kΩ 电阻（25g）", note: "同一小排 25f–25j：A0 就在这里测电压" },
      { from: "10 kΩ 电阻（25e）", to: "Nano GND（14c）", note: "黑线，从 25b 到 14b；跨过中间槽的是电阻。" },
      { from: "Nano USB", to: "电脑", note: "供电、上传程序、送回读数，都靠这根线" },
    ],
    foot: "FSR 的尾巴伸出面包板的下边。两个 GND 引脚接哪个都行，经过电源轨接过去也可以。",
  },
  code: {
    caption: "C++ · Arduino · 代码块拼成的程序",
    notes: [
      "<code>setup()</code> 只运行一次。<code>Serial.begin(9600)</code> 以 9600 baud 打开 USB 连接，串口监视器也要用同样的速度接收。",
      "<code>loop()</code> 一遍又一遍地运行：把 A0 读进 <code>value</code>，作为一行发出去，再停 100 ms。",
      "顺序很重要。变量要等新建它的那一行运行过才存在，而且只在它所在的函数里有效。先打印 <code>value</code> 再读取的程序，编译不通过。",
      "每个干扰项都会弄坏一样东西。<code>digitalRead</code> 只会给出 0 或 1，<code>Serial.print</code> 让数字挤成一串，<code>pinMode(A0, OUTPUT)</code> 和传感器对着干。用 115200 baud，监视器也得调到 115200。",
    ],
  },
  specs: [
    { label: "面包板", value: "半尺寸，400 个孔", note: "30 列，每列 10 个孔，外加 2 对电源轨" },
    { label: "孔距", value: "2.54 mm（0.1 英寸）" },
    { label: "一个小排", value: "5 个孔连通", note: "同一列的 a–e 行，或者 f–j 行" },
    { label: "中间的槽", value: "把上下两半隔开", note: "芯片和 Nano 都跨在它上面" },
    { label: "电源轨", value: "沿整条边连通", note: "通常如此；有些更长的面包板在中间断开" },
    { label: "下拉电阻", note: "和读取板上的 R1 阻值一样" },
    { label: "怎样算能用", value: `按下 ${F_PRESS} N，读数变化 ${RESPONSIVE} 以上`, note: "本工作台自己定的及格线，约 0.5 V" },
    {
      label: "工作台上的 FSR 曲线",
      value: "Adafruit 表里的 4 个点，在对数坐标上连起来",
      note: `${FSR_TABLE.map(([f, r]) => `${f} N → ${ohms(r)}`).join("，")}；和第 2.1 课是同一条曲线`,
    },
  ],
  steps: [
    {
      title: "放好 Nano",
      text: "把 Nano 从右边的零件盘拖到面包板上。它会跨在中间的凹槽上卡好，一边一排引脚。点一下任何零件，就能看到它是什么；在空白处拖动可以转动视角。",
    },
    {
      title: "放上传感器和电阻",
      text: "把力传感器（FSR）和 10 kΩ 电阻拖到面包板上。每只脚都要占一个自己的小排，不然这个零件就被短接了。要给零件转向，先选中它，再按 R。",
    },
    {
      title: "接线",
      text: "从一个孔拖到另一个孔，接一根跳线：5V 接 FSR 的一只脚，A0 接它的另一只脚和电阻，电阻再接 GND。每接好一处，右边面板里的电路图就亮起一段。",
    },
    {
      title: "写程序",
      text: "把代码块拖进 setup() 和 loop()，其中有几块是干扰项。方框里的引脚、波特率和停顿时间都可以改。点“验证”看看能不能编译。",
    },
    {
      title: "上传，按一按",
      text: `插上 USB，上传，再按传感器。一个传感器就占了 Nano 8 个模拟引脚中的一个，传感垫却有 ${TAXELS} 个交叉点。第 2.3 课讲怎样用一个引脚把它们全读完。`,
    },
  ],
  quiz: [
    {
      q: "不管按不按，串口监视器一直显示 1023。哪里出了问题？",
      choices: ["传感器的两只脚插在同一小排里", "少了电阻", "程序和监视器的波特率不一样", "USB 线没插"],
      why: "这一小排把传感器的两只脚连通了，传感器被短接。A0 一直是 5 V，怎么按 analogRead 都返回 1023。把传感器转个方向，让两只脚插进两个小排。",
    },
    {
      q: "没人碰传感器，读数也在乱跳。哪里出了问题？",
      choices: ["程序读 A0 读得太勤", "没有东西把 A0 连到 GND", "传感器按得太轻", "接 5V 的线太长"],
      why: "没人碰时，传感器相当于断路。没有接到 GND 的下拉电阻，就没有东西确定 A0 的电压，引脚悬空，读数四处漂移。从 A0 那一小排接一个 10 kΩ 电阻到 GND，就能把它拉在 0 V。",
    },
    {
      q: "串口监视器里满是 ⸮⸮⸮ 和奇怪的符号。哪里出了问题？",
      choices: ["传感器按得太重", "电阻插反了", "程序和监视器的波特率不一样", "Serial.println 应该换成 Serial.print"],
      why: "收发两头要用同一个速度，也就是每秒传多少位。速度不一样，监视器就会在错误的地方切分数据，字节变成乱码。把监视器调到 Serial.begin 里的那个速度。顺便说一句，电阻没有正反。",
    },
  ],
};
