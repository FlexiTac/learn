// Chinese for src/lessons/03-arduino-fsr.ts (docs/i18n.md; words per docs/i18n-terms-zh.md). An empty slot shows the English.
import { COLS, FRAME_HZ, ROWS } from "@shared/data/constants.mjs";
import { adcCode, CONVERSION_S, PRESCALER, STEPS } from "@shared/models/adc.mjs";
import type { LessonZh } from "../../i18n/localize";
import { FSR_TABLE, STEP_MV } from "../../widgets/bench/fsr";

const TAXELS = ROWS * COLS;
const FASTER = 128 / PRESCALER; // the Arduino core's prescaler 128 against the firmware's (the English file says where)
const FIRMWARE_US = Math.round(CONVERSION_S * 1e6);
const ohms = (r: number) => (r >= 1000 ? `${r / 1000} kΩ` : `${r} Ω`);

export const zh: LessonZh = {
  id: "arduino-fsr",
  title: "用 Arduino 读一个力传感器",
  kicker: "Arduino 基础",
  lede: `先认识读取板上的那台小电脑 Arduino Nano，再给它接一个力传感器，把你按的力度读成 0 到 ${STEPS - 1} 之间的一个数。`,
  features: [
    { title: "Arduino Nano", text: "一块在电脑上写好程序、上传进去就能运行的小板" },
    { title: "一个力传感器", text: "一按下去，它的电阻就变小" },
    { title: "analogRead(A0)", text: `把 0–5 V 变成 0 到 ${STEPS - 1} 之间的一个数` },
  ],
  overview: `
<p><dfn data-term="arduino">Arduino</dfn> 是一块开源的小电路板，上面有一颗可以编程的芯片；配套的还有免费的 Arduino IDE，也就是你在电脑上给它写代码的软件。它当初是为从没做过电子制作的学生设计的。FlexiTac 的读取板（reading board）上用的也是一块 Arduino，叫 Arduino Nano。</p>
<p>这颗芯片是<dfn data-term="microcontroller">微控制器（microcontroller）</dfn>，相当于做在一颗芯片上的一台小电脑，Nano 上的是 ATmega328P。你在电脑上给它写的程序叫 <dfn data-term="sketch">Arduino 程序（sketch）</dfn>，写好后通过 USB 线上传到板子上。每个程序都有一个 <code>setup()</code>，在板子启动时运行一次；还有一个 <code>loop()</code>，之后只要通着电，就一遍又一遍地运行。</p>
<p>Nano 两条长边上的引脚，把它和你搭的电路连起来。<dfn data-term="digital-pin">数字引脚（digital pin）</dfn>D0 到 D13 只有两种状态：<dfn data-term="high-low">HIGH（高电平）</dfn>是 5 V，LOW（低电平）是 0 V，用来开灯、关灯已经够了。<dfn data-term="analog-pin">模拟引脚（analog pin）</dfn>A0 到 A7 能测量 0 到 5 V 之间的任何电压。电源引脚给你接上的东西供电，最常用的是 5V 和<dfn data-term="ground">地（GND）</dfn>。地是 0 V 的那一边，所有电压都从它算起。</p>
<p>不想焊接，又想试一个电路，可以把 Nano 插到<dfn data-term="breadboard">面包板（breadboard）</dfn>上。面包板里面有金属条，把每一小排的五个孔连在一起，插在同一排的零件就接通了。面包板中间有一道槽，槽两边的小排互不相连，所以 Nano 跨在槽上，两排引脚不会接在一起。离得远的两排，用<dfn data-term="jumper-wire">跳线（jumper wire）</dfn>连起来。</p>
<p>这里的传感器是一个<dfn data-term="fsr">力敏电阻（force-sensing resistor，简称 FSR）</dfn>，一片薄薄的圆片，按得越用力，电阻越小。没人碰时它超过 10 MΩ（一千万欧姆），用力按时只剩几百欧姆。可是 Arduino 测不了电阻，它的模拟引脚只能测电压。</p>
<p>所以要给 FSR 配一个搭档，就是从 A0 接到地的一个 10 kΩ 电阻，叫<dfn data-term="pull-down-resistor">下拉电阻（pull-down resistor）</dfn>。电流从 5V 出发，先经过 FSR，再经过这个 10 kΩ 电阻，回到地。A0 就在两者中间。</p>
<p>它们一起组成一个<dfn data-term="voltage-divider">分压电路（voltage divider）</dfn>。两个电阻分这 5 V，电阻大的分得多。没人按时，FSR 大得几乎把 5 V 全占了，A0 上只有大约 0 V。一按下去，FSR 变小，更多的电压落到 10 kΩ 电阻上，A0 就在这个电阻的上端，跟着升向 5 V。</p>
<p>写成公式，A0 上的电压是 V = 5 V × 10 kΩ / (10 kΩ + R<sub>FSR</sub>)，R<sub>FSR</sub> 是 FSR 的电阻。按到它降到 10 kΩ、和下拉电阻一样大时，A0 正好在 2.5 V，一半的位置。第 1.2 课的触摸点用的也是这个电路、这个 10 kΩ 电阻，它在读取板上叫 R1。</p>
<p>微控制器里有一个 <dfn data-term="adc">ADC（模数转换器）</dfn>，负责把电压变成数字。它把 0–5 V 分成 ${STEPS} 格，每格约 ${STEP_MV.toFixed(1)} mV，所以 <dfn data-term="analogread">analogRead()</dfn> 返回 0 到 ${STEPS - 1} 之间的一个整数。读一次大约要 100 µs，所以 Nano 一秒钟大约能读 A0 一万次。照这个速度，FlexiTac 每秒把 ${TAXELS} 个交叉点（crossing）读 ${FRAME_HZ} 遍是来不及的。它的固件（firmware）把 ADC 调快了 ${FASTER} 倍，读一次只要大约 ${FIRMWARE_US} µs（第 2.6 课）。</p>
<p>要看到这些数字，程序用 <code>Serial.println()</code> 把每个数通过 USB 发回电脑。Arduino IDE 可以在<dfn data-term="serial-monitor">串口监视器（Serial Monitor）</dfn>里把它们一行一行列出来，也可以在串口绘图器（Serial Plotter）里画成一条移动的曲线。</p>
<p>FlexiTac 自己的固件为了快，发的是原始字节而不是文字。所以第 1.4 课提醒你，用串口监视器看只会是乱码。一个字节最大只到 255，所以固件发送前先把每个读数除以 4，这就是你在第 1.3 课见到的 0 到 255 的读数。</p>
<p>FlexiTac 传感垫上的每个交叉点，都像一个小小的 FSR。它是一条上层的线和一条下层的线，中间夹着 Velostat，按下去电阻就变小。只有一点不同：Velostat 没人按时也会导一点电，所以没人按的交叉点，读数从来不会正好是 0。</p>
<p>还有，Nano 只有 8 个模拟引脚，一块传感垫却有 ${TAXELS} 个交叉点。怎样用一个 A0 把它们全读完，是下一课的内容。</p>`,
  wiring: {
    intro: "三根跳线就能接好电路。FSR 的每只脚、电阻的每条腿，都和某根跳线的一头插在同一小排里；同一小排的五个孔，在面包板里面是连通的。电阻跨过中间的槽，插到另一边的一排，黑线也插在那一排。FSR 和电阻都不分正反，两个 GND 引脚接哪个都行。",
    rows: [
      { from: "Nano 5V", to: "FSR 的一只脚", note: "红线：给传感器接上 5 V" },
      { from: "FSR 的另一只脚", to: "Nano A0", note: "黄线：A0 在这里测电压" },
      { from: "FSR 的另一只脚", to: "10 kΩ 电阻", note: "同一排：下拉电阻就从 A0 测电压的那一点接出去" },
      { from: "10 kΩ 电阻", to: "Nano GND", note: "黑线：回到 0 V" },
      { from: "Nano USB", to: "电脑", note: "供电、上传程序、送回读数，都靠这根线" },
    ],
    foot: "接哪个模拟引脚都行。这个程序读的是 A0，读取板也是通过 A0 读每一个交叉点的。",
  },
  code: {
    caption: "C++ · Arduino · A0 上的一个力传感器",
    params: [{ label: "WAIT（毫秒）" }],
    notes: [
      "<code>setup()</code> 只在板子启动时运行一次。<code>Serial.begin(9600)</code> 以 9600 baud 打开 USB 连接，串口监视器也要设成这个速度。",
      `<code>loop()</code> 一遍又一遍地运行。每一遍，<code>analogRead(SENSOR)</code> 量一次 A0 上的电压（<code>SENSOR</code> 就是 A0），返回 0 到 ${STEPS - 1} 之间的一个整数。`,
      "<code>Serial.println(value)</code> 把这个数当作文字发出去，再换一行，所以每个读数在串口监视器里是一行，在串口绘图器里是一个点。",
      "<code>delay(WAIT)</code> 停 <code>WAIT</code> 毫秒，所以设成 100 时，一秒钟大约读 10 次。改一下方框里的数字，再点<b>运行</b>。工作台上的绘图器和监视器会换成新的速度，控制台会打印最近的几个读数。",
    ],
  },
  specs: [
    { label: "微控制器", value: "ATmega328P，16 MHz" },
    { label: "引脚", value: "14 个数字引脚（D0–D13），8 个模拟引脚（A0–A7）" },
    { label: "工作电压", note: "用 USB 供电，或在 VIN 上接 7–12 V" },
    { label: "USB 接口", value: "Mini-B 型" },
    { label: "板子尺寸" },
    { label: "ADC", value: `10 位：0–5 V 对应 0–${STEPS - 1}`, note: `每格约 ${STEP_MV.toFixed(1)} mV` },
    { label: "读一次 analogRead", value: "约 100 µs", note: "一秒钟大约能读一万次" },
    { label: "FSR 没人按时", note: "按下之前相当于断路" },
    { label: "FSR 的受力范围", value: "约 0.2–20 N" },
    { label: "下拉电阻", note: "和读取板上的 R1 阻值一样；那颗是很小的贴片电阻" },
    {
      label: "工作台上的 FSR 曲线",
      value: "Adafruit 表里的 4 个点，在对数坐标上连起来",
      note: `${FSR_TABLE.map(([f, r]) => `${f} N → ${ohms(r)}`).join("，")}；真实的 FSR 彼此相差约 10 %`,
    },
  ],
  steps: [
    {
      title: "认识 Arduino Nano",
      text: "这就是 Arduino Nano，FlexiTac 用的也是这块小板。它的微控制器运行你写的程序，引脚把它和你的电路连起来。点一下标签或零件，让它亮起来。",
    },
    {
      title: "接一个力传感器",
      text: "三根线加一个 10 kΩ 电阻：5V 接到力传感器（FSR），它的另一只脚接 A0，电阻再从那里接到 GND。看电路按这个顺序亮起来，右边画的是同一个电路。",
    },
    {
      title: "按一按",
      text: "按住传感器，往下拖表示更用力。它的电阻变小，A0 上的电压升高，analogRead 从 0 往 1023 爬。绘图器把它画出来，就像 Arduino IDE 里那样。",
    },
    {
      title: "一个传感器占一个引脚",
      text: `Nano 只有 8 个模拟引脚，一块 FlexiTac 传感垫却有 ${TAXELS} 个交叉点，每个都是一个小力传感器。一个引脚读一个，根本读不完。第 2.3 课讲怎样用一个 A0 全部读完。`,
    },
  ],
  quiz: [
    {
      q: "力传感器为什么要配一个接到地的 10 kΩ 电阻？",
      choices: ["防止传感器发热", "Arduino 要靠它才能开机", "Arduino 只能测电压，两者组成分压电路", "它把读数存起来，等 analogRead 来取"],
      why: "模拟引脚测的是电压，不是电阻。有了下拉电阻，FSR 电阻的变化就变成了 A0 上电压的变化。",
    },
    {
      q: "没有东西碰 FSR。analogRead(A0) 返回多少？",
      choices: ["0", "512", "1023", "一个随机数"],
      why: `没人碰时，FSR 相当于断路。没有电流，下拉电阻把 A0 拉在 0 V，所以 analogRead 返回 ${adcCode(0)}。要是没有下拉电阻，A0 什么也没接，读数就会乱跳。`,
    },
    {
      q: "A0 上是 2.5 V。analogRead(A0) 大约返回多少？",
      choices: ["250", "512", "1023", "2500"],
      why: `ADC 把 0–5 V 分成 ${STEPS} 格，2.5 V 正好在中间：2.5 × ${STEPS} / 5 = ${adcCode(2.5)}。`,
    },
  ],
};
