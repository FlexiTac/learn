// Chinese for src/lessons/21-put-on-a-robot.ts (docs/i18n.md; words per docs/i18n-terms-zh.md). An empty slot shows the English.
import { COLS, FRAME_HZ, ROWS } from "@shared/data/constants.mjs";
import type { LessonZh } from "../../i18n/localize";

const TAXELS = ROWS * COLS;

export const zh: LessonZh = {
  id: "put-on-a-robot",
  title: "把 FlexiTac 装到机器人上",
  kicker: "安装",
  lede: `两块传感垫、两块读取板、两根 USB 线。看 FlexiTac 怎样装到夹爪的手指上，它的触觉又怎样传到电脑。`,
  features: [
    { title: "贴上去", text: "聚酰亚胺胶带把传感垫固定住，绕过指尖贴到背面" },
    { title: "尾线绕到背面", text: "从传感垫侧面伸出，绕过手指侧面到背面" },
    { title: "每根手指一块板", text: "两块板、两根 USB 线、两张触觉图" },
  ],
  overview: `
<p><b>触觉放在哪里。</b>夹爪用手指的平面去接触物体，所以传感垫就贴在那里：每根手指的夹持面上贴一块 FlexiTac 传感垫。这台夹爪装的是柔软的鳍形软指（fin-shaped finger），它们会弯曲着包住抓住的东西，让传感垫有更多面积接触物体。</p>
<p><b>三个步骤。</b></p>
<ul>
<li><b>贴上去。</b>用薄的单面<dfn data-term="polyimide">聚酰亚胺（polyimide）</dfn>胶带把传感垫压平。每条胶带都沿着手指走：盖过传感垫，绕过指尖，贴到手指背面。这样手指弯曲时，传感垫也不会翘起来。</li>
<li><b>尾线绕到背面。</b>传感垫的两条尾线从它的侧面伸出（第 1.1 课里你从上面看到过）。每条尾线都绕过手指侧面到背面，从不越过指尖。尾线上的<dfn data-term="gold-fingers">金手指（gold fingers）</dfn>插进背面一块现成的小 <dfn data-term="ffc">FFC</dfn> 转接板（extender），再由一根约 15 cm 长的排线连到读取板（reading board）。</li>
<li><b>每根手指一块板。</b>每根手指的排线都连到它自己的读取板，读取板放在夹爪电机旁边，每块板各有一根 USB 线。电脑会看到两个串口：左手指和右手指。</li>
</ul>
<p><b>为什么每根手指一块板？</b>每块板正好读一块传感垫（${ROWS} × ${COLS} = ${TAXELS} 个触摸点），所以两块传感垫从不共用导线，也不用互相等待：各自每秒发送 ${FRAME_HZ} 帧（frame）。排线很短，只需跟着手指滑动，不用经过机器人的任何关节。但它们仍要留出余量，让手指能完全张开和合拢，而不会拉扯排线。</p>
<p><b>其他夹爪。</b>这只是一个例子。同样的三个步骤也适用于平行平爪、ALOHA 和 xArm 的夹爪以及 LeRobot 机械臂：把传感垫贴在夹持面上，把尾线插进转接板，再用排线连到读取板。要换的只是承载手指的支架。</p>
<p class="aside">安装方式参照 FlexiTac 团队自己的实物（他们的照片）。机器人是装有 UMI 软指的 reBot-DevArm。手指支架和板托是专为这台夹爪画的（<span class="badge badge-proposed">建议做法</span>），只是其中一种方案。第 5 步里的触觉图是仿真出来的（<span class="badge badge-illustrative">示意</span>）。</p>`,
  specs: [
    // Touch spots per pad | 384 taxels (fact sensor.taxels)
    { label: "每块传感垫的触摸点" },
    // Sensing area | 24 × 64 mm (fact pad.activeArea)
    { label: "感应面积" },
    { label: "传感垫和读取板", value: "2 块传感垫、2 块读取板、2 根 USB 线" },
    { label: "读取板的位置", value: "夹爪电机旁边，每根手指一块" },
    { label: "排线长度", value: "约 15 cm，为完整行程留出余量" },
    // 100 Hz (fact system.frameRate)
    { label: "每块板的帧率", note: "每块板发送自己那块传感垫的帧" },
    // 386 bytes (fact firmware.frameBytes)
    { label: "帧大小", note: "每块板、每一帧" },
    { label: "软指", value: "UMI 鳍形软指，TPU 95A，40 × 123.4 × 25.8 mm" },
    // 0–100 mm
    { label: "夹爪开合范围" },
    { label: "支架和板托", value: "为这台夹爪绘制" },
  ],
  steps: [
    {
      title: "有触觉的机器人",
      text: `这台机器人的每根软指上都贴着一块 FlexiTac 传感垫，正好在手指接触抓取物的地方。同样的步骤也适用于平爪和其他夹爪。`,
    },
    {
      title: "把传感垫贴上",
      text: `把传感垫平放在手指的夹持面上。用几条聚酰亚胺胶带把它压平：盖过传感垫，绕过指尖，贴到手指背面。`,
    },
    {
      title: "尾线绕到背面",
      text: `尾线从传感垫的侧面伸出。把它们绕过手指侧面折到背面，不要越过指尖，让金色触点藏在手指后面。`,
    },
    {
      title: "转接板和排线",
      text: `每条尾线插进一块小 FFC 转接板。排线（约 15 cm）再连到电机旁这根手指的读取板。夹爪开合时，留意排线留出的那圈余量。`,
    },
    {
      title: "两块板，两根 USB 线",
      text: `每块板有自己的 USB 线，所以电脑会得到两张触觉图：左和右。点击一根手指来按压它的传感垫，看它的触觉图亮起来。`,
    },
  ],
  quiz: [
    {
      q: "为什么传感垫的尾线要绕到手指背面？",
      choices: ["让传感垫更灵敏", "让金色触点和排线远离手指抓住的东西", "因为胶带只能贴在那里", "给传感垫保暖"],
      why: `在背面，金色触点、转接板和排线都不碍事：只有平整的传感垫接触物体。`,
    },
    {
      q: "一台两指夹爪，每根手指一块传感垫，按本课的方式接线。有几根 USB 线连到电脑？",
      why: `每根手指一块读取板，每块板有自己的 USB 线：一共两根，所以电脑会看到两个串口。`,
    },
    {
      q: "为什么排线要留出一圈余量？",
      choices: ["让手指能完全张开和合拢，而不拉扯排线", "让信号更强", "因为短排线传不了 32 条线", "给读取板散热"],
      why: `手指会来回滑动，读取板却固定在电机旁边。那圈余量吸收了距离的变化，所以排线永远不会被拉紧。`,
    },
  ],
  parts: {
    intro: `本课给一台两指夹爪加上的东西（传感垫和读取板就是第 1 部分里的那些）。`,
    rows: [
      { name: "FlexiTac 传感垫", note: "每根手指的夹持面上一块。" },
      { name: "单面聚酰亚胺胶带", qty: "几条", note: "把每块传感垫压平；每条胶带盖过传感垫，绕过指尖，贴到背面。" },
      { name: "FFC 转接板（20/40 针，来自 BOM）", note: "每根手指两块，每条尾线一块：一侧插尾线的金手指，另一侧插排线。" },
      { name: "FFC 排线，0.5 mm 间距，约 15 cm", note: "每根手指一根 32 针、一根 16 针，从转接板连到这根手指的读取板，留出余量。" },
      { name: "带 Arduino Nano 的读取板", note: "每根手指一块，放在夹爪电机旁边。" },
      { name: "USB 线（mini-USB 转 USB-A）", note: "每块板一根，连到电脑：两个串口，左和右。" },
      { name: "手指支架和板托", note: "打印件，在这台夹爪上承载手指和读取板。" },
    ],
    foot: `软指本身（UMI 鳍形软指，用 TPU 95A 打印）在本课开始时已经装在机器人上了。`,
  },
};
