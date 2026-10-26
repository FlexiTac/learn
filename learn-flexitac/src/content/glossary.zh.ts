// Chinese for the glossary (src/content/glossary.ts), keyed by term id. A term without an entry (or a field left out)
// shows the English. Follow docs/i18n-terms-zh.md: `term` is the Chinese name ("触觉像素"; product and part names that
// stay English, like Velostat or FPC, leave `term` out), `aka` other names in Chinese or English (joined with " · ",
// the way the glossary page joins the English name in front of them), `def` the definition (HTML, plain short
// sentences). Inside a definition, another key concept is bilingual at its first mention: 驱动线（drive line）. The
// numbers come from the shared data, as in the English file. The glossary page shows the Chinese name with the
// English one beside it, and the <dfn> popovers in a Chinese lesson use `def`.
import { BAUD, COLS, FRAME_BYTES, FRAME_HZ, MUX_OFFSET, R1, ROWS } from "@shared/data/constants.mjs";

export interface TermZh {
  term?: string;
  aka?: string;
  def?: string;
}

export const GLOSSARY_ZH: Record<string, TermZh> = {
  taxel: {
    term: "触觉像素",
    aka: "tactile pixel · 触摸点",
    def: `一个能感知按压的小点，就像相机里的像素，只不过它感受的是压力。在 FlexiTac 上，每个触觉像素就是一条驱动线（drive line）跨过一条感应线（sense line）的地方。传感垫共有 ${ROWS} × ${COLS} = ${ROWS * COLS} 个。`,
  },
  piezoresistive: {
    term: "压阻",
    aka: "piezoresistance · 压阻效应",
    def: "形容这样一种材料：挤压它，它的电阻（resistance）就会改变。Velostat 就是压阻材料：按压会让它的电阻变小。",
  },
  velostat: {
    aka: "Linqstat",
    def: "一种掺了碳的黑色薄塑料膜。不按时它只导一点点电，按下去就导电得多。FlexiTac 用的是一张 0.1 mm 厚的 Velostat（Adafruit 1361）。",
  },
  resistance: {
    term: "电阻",
    aka: "欧姆 · Ω",
    def: "电流穿过一个东西有多难，单位是欧姆（Ω）。细吸管比粗水管更难让水通过；电阻越大，能通过的电流（current）就越小。",
  },
  fpc: {
    aka: "flexible printed circuit · 柔性电路板",
    def: "印在又薄又能弯的塑料膜（聚酰亚胺，polyimide）上的电路板，而不是硬的玻璃纤维板。FlexiTac 的两张铜线片都是 FPC，厚 0.2 mm。",
  },
  ffc: {
    aka: "flat flexible cable · 扁平柔性排线",
    def: "一种扁平的排线，里面并排着很多根导体。它把传感垫两张 FPC 的尾线接到读取板（reading board）的连接器上。",
  },
  electrode: {
    term: "电极",
    def: "直接接触被测材料的导体。在 FlexiTac 上，电极就是每张 FPC 上细细的铜线，宽 0.6 mm，间距 2.0 mm。",
  },
  "drive-line": {
    term: "驱动线",
    def: `底层 FPC（Bottom FPC）上的 ${COLS} 条铜线之一。读取板每次只给一条驱动线通电。固件把它们叫作“列”（<i>columns</i>）。`,
  },
  "sense-line": {
    term: "感应线",
    def: `顶层 FPC（Top FPC）上的 ${ROWS} 条铜线之一。读取板每次只“听”一条感应线，测量那里的电压（voltage）。固件把它们叫作“行”（<i>rows</i>）。`,
  },
  pitch: {
    term: "间距",
    aka: "节距",
    def: "相邻两条线（或两个引脚）中心到中心的距离。FlexiTac 电极的间距是 2.0 mm；排线金手指（gold fingers）的间距是 0.5 mm。",
  },
  polyimide: {
    term: "聚酰亚胺",
    aka: "Kapton",
    def: "一种结实、耐高温、琥珀色的塑料。FPC 的基底薄膜就是它；聚酰亚胺胶带（polyimide tape）则用来封住传感垫的四边。",
  },
  "laminating-sheet": {
    term: "覆膜",
    aka: "lamination sheet",
    def: "一面带胶的薄塑料膜。制作时，先把每张 FPC 各贴在一张覆膜上；之后两张覆膜把整叠材料包在中间，让铜线一直紧贴着 Velostat。",
  },
  slot: {
    term: "槽",
    def: "FPC 上两条相邻铜线之间完全切穿的一道细长缝。有了这些槽，每张薄片就变成一排细条，像一把梳子。",
  },
  compliance: {
    term: "柔顺性",
    def: "一个东西被推时有多容易让开或弯曲，和刚度（stiffness）正好相反。槽让 FPC 的柔顺性更高，传感垫就能包住弯曲的物体。",
  },
  "supporting-beam": {
    term: "支撑梁",
    def: "顶层 FPC 中间那条没被切开的横条，槽到这里就停住。它把所有长条连在一起，让薄片不会翘起变形。",
  },
  stiffener: {
    term: "补强板",
    def: "贴在 FPC 背面的一层额外薄膜，让某一块区域变硬。FlexiTac 在金手指（gold fingers）背后贴了一块，这样尾线能干脆地插进连接器。",
  },
  "gold-fingers": {
    term: "金手指",
    aka: "fingers",
    def: "软尾线末端一排镀金的触点。它们插进连接器里，就像游戏卡带上的那排触点。",
  },
  gerber: {
    term: "Gerber 文件",
    def: "工厂做电路板用的标准图纸，每一层一个文件（铜层、外形、钻孔……）。这些课程里的大多数尺寸都是从这些文件里量出来的。",
  },
  "shift-register": {
    term: "移位寄存器",
    aka: "74HC595",
    def: `一种芯片：它在数据引脚上一次接收一位（bit），每来一个时钟脉冲就把这些位沿着一排输出往后挪一格，并把它们保持住。四片级联的 74HC595，用 Arduino 的 2 个引脚就能控制 ${COLS} 路驱动输出。`,
  },
  multiplexer: {
    term: "多路选择器",
    aka: "mux · CD74HC4067",
    def: `一个电子“旋钮开关”：四个选择引脚（select pins）决定 16 个输入中哪一个接到唯一的输出上。FlexiTac 的 ${ROWS} 条感应线接在通道（channel）${MUX_OFFSET}–${MUX_OFFSET + ROWS - 1} 上，共用一个模拟引脚。`,
  },
  "voltage-divider": {
    term: "分压电路",
    def: `两个电阻串联（in series）时，会按各自的大小按比例分掉一个电压。触觉像素（taxel）和读取板上的 ${R1 / 1000} kΩ 电阻串联，一起分掉 5 V；电阻上分到的那一份，就是 Arduino 读到的值。`,
  },
  adc: {
    aka: "analog-to-digital converter · 模数转换器",
    def: "微控制器（microcontroller）里测量电压、再把它变成数字的那部分。Arduino Nano 的 ADC 把 0–5 V 变成 0–1023（10 位）。",
  },
  byte: {
    term: "字节",
    def: "8 个位（bit）：0 到 255 之间的一个整数。FlexiTac 去掉 ADC 读数最低的两位，把每个触觉像素（taxel）的读数作为一个字节发出去。",
  },
  baud: {
    term: "波特率",
    aka: "baud rate",
    def: `串口每秒钟信号变化的次数；对 USB 串口来说，大致就是每秒传多少位。FlexiTac 的固件以 ${BAUD.toLocaleString("en-US")} baud 通信。`,
  },
  frame: {
    term: "帧",
    def: `把每个触觉像素（taxel）都读一遍得到的一整份数据，就像视频里的一张照片。FlexiTac 的一帧有 ${FRAME_BYTES} 字节：先是帧头（header）<code>AA 55</code>，再是 ${ROWS * COLS} 个读数。它每秒发送 ${FRAME_HZ} 帧。`,
  },
  header: {
    term: "帧头",
    aka: "AA 55",
    def: "每一帧开头那两个固定的字节。电脑在字节流里寻找它们，才知道新的一帧从哪里开始。",
  },
  firmware: {
    term: "固件",
    def: "在微控制器（microcontroller）上运行的程序。FlexiTac 的固件一直在循环：选一条线、读取、发送。",
  },
  "arduino-nano": {
    def: "一块带 USB 口的小型微控制器（microcontroller）板。它插在读取板（reading board）上，运行扫描固件，再把一帧帧数据发给电脑。",
  },
  baseline: {
    term: "基线",
    def: "没人触摸时，每个触觉像素（taxel）的读数。查看器记下前 30 帧的中位数（median）并把它减掉，这样只有变化才会显示出来。",
  },
  heatmap: {
    term: "热力图",
    def: "用每个格子的颜色来表示一个数的图。FlexiTac 的查看器把每个触觉像素从深紫色（没有触摸）涂到黄色（用力触摸）。",
  },
  ghosting: {
    term: "鬼影",
    def: "在没人按的交叉点（crossing）上出现的假读数。电流会绕道穿过其他被按住的触觉像素，再从正在读的那条线里出来。把没用到的驱动线接地（GND）能减轻鬼影，但不能完全消除。",
  },
  "time-multiplexing": {
    term: "分时复用",
    def: `让少数几根导线轮流、飞快地为很多信号服务。FlexiTac 只用 ${ROWS + COLS} 根线就能读 ${ROWS * COLS} 个触觉像素（taxel）：一次读一个交叉点，每秒读完 ${FRAME_HZ} 轮。`,
  },
  "output-latch": {
    term: "输出锁存器",
    aka: "storage register · 存储寄存器",
    def: "74HC595 内部的第二排“格子”。在一个时钟边沿，它把移位格子里的内容一次复制到输出引脚上，所以输出是同时改变的，不会在移位时一个接一个地跳。",
  },
  "rising-edge": {
    term: "上升沿",
    def: "信号从 LOW（0 V）切换到 HIGH 的那一瞬间。74HC595 这类芯片就在这一刻动作，就像按下按钮的瞬间，相机快门“咔嚓”一声。",
  },
  "active-low": {
    term: "低电平有效",
    def: "引脚在 LOW（0 V）时才起作用，而不是在 HIGH 时。多路选择器（multiplexer）的使能引脚 E# 就是低电平有效：给它 LOW，芯片才打开。名字后面的 # 或名字上方的横线，就表示这种引脚。",
  },
  channel: {
    term: "通道",
    aka: "mux channel",
    def: `多路选择器（multiplexer）16 个带编号的输入之一，编号 0 到 15。传感垫的 ${ROWS} 条感应线接在通道 ${MUX_OFFSET} 到 ${MUX_OFFSET + ROWS - 1} 上。`,
  },
  "select-pins": {
    term: "选择引脚",
    aka: "S0–S3",
    def: "决定多路选择器（multiplexer）接通哪个通道的四个引脚 S0 到 S3。每个引脚是 0 或 1，合起来就是通道号的二进制写法（S0 代表 1，S1 代表 2，S2 代表 4，S3 代表 8）。",
  },
  flash: {
    term: "烧录",
    aka: "upload · 上传",
    def: "把程序复制进微控制器的存储器，断电后它也会留在那里。FlexiTac 的固件（firmware）只需要往 Nano 里烧录一次。",
  },
  bootloader: {
    term: "引导程序",
    def: "Nano 上本来就有的一个小程序，负责通过 USB 接收新固件。很多 Nano（尤其是兼容板）带的是旧版：如果上传失败并提示 <i>not in sync</i>，就选 <i>ATmega328P (Old Bootloader)</i>。",
  },
  fqbn: {
    aka: "fully qualified board name · 板卡全名",
    def: "arduino-cli 给一种板卡起的名字，写成 厂商:架构:板卡（vendor:architecture:board）。Nano 的是 <code>arduino:avr:nano</code>。",
  },
  median: {
    term: "中位数",
    def: "把一组数排好序后正中间的那个数。和平均数不同，一个突然冒出来的怪值拉不动它，所以查看器用它来定每个触觉像素（taxel）的静止值。",
  },
  threshold: {
    term: "阈值",
    def: "一条分界线：比它小的都当作 0。查看器从每个读数里减去一个小小的阈值，这样电噪声就不会被当成触摸。",
  },
  normalise: {
    term: "归一化",
    aka: "normalize",
    def: "把一组数按比例缩放到 0 到 1 之间。查看器把每一帧都除以这一帧的最大值，所以热力图（heatmap）显示的是你按在哪里，而不是按得多重。",
  },
  ema: {
    term: "指数移动平均",
    aka: "exponential moving average",
    def: "把最新的值和上一次的结果不断混合：显示值 = alpha × 新值 + (1 − alpha) × 上一次的值。alpha 越小，画面越平稳，但反应也越慢。",
  },
  viridis: {
    term: "viridis 色图",
    def: "一种从深紫、青绿到黄色的色图（colour map）。它的亮度一路平稳升高，所以色盲的人也能看清，印成黑白也照样能读。",
  },
  bom: {
    aka: "bill of materials · 物料清单",
    def: "做一样东西所需的全部零件清单，写明数量和零件型号。工厂按它采购零件、把零件贴到板上。",
  },
  pcba: {
    aka: "printed circuit board assembly · 贴片成品板",
    def: "下单时请工厂把零件直接焊在电路板上，而不是只收到一块空板。",
  },
  current: {
    term: "电流",
    aka: "安培 · A",
    def: "每秒流过某一点的电荷有多少，单位是安培（A）。就像水管里流过的水量。",
  },
  voltage: {
    term: "电压",
    aka: "伏特 · V",
    def: "两点之间的电“推力”，单位是伏特（V）。就像水压：正是它让电流流动起来。",
  },
  "ohms-law": {
    term: "欧姆定律",
    def: "电压 = 电流 × 电阻（V = I × R）。推得更用力，或者阻碍更小，流过的电流就更大。",
  },
  resistivity: {
    term: "电阻率",
    aka: "ρ · Ω·cm",
    def: "材料本身阻碍电流的程度：用这种材料做一个边长 1 cm 的标准立方体，它的电阻就是电阻率。一块材料的电阻 = 电阻率 × 长度 ÷ 横截面积。",
  },
  bit: {
    term: "位",
    aka: "比特",
    def: "一个二进制数字，0 或 1。8 个位组成一个字节（byte）。",
  },
  prescaler: {
    term: "预分频器",
    def: "一个时钟分频器。Nano 的 ADC 用的时钟是 16 MHz 主时钟除以预分频器；FlexiTac 的固件选了一个较小的值，让每次读取都很快。",
  },
  series: {
    term: "串联",
    aka: "series",
    def: `零件一个接一个地连在一起，同一股电流依次流过每一个。触觉像素（taxel）和读取板上的 ${R1 / 1000} kΩ 电阻就是串联的。`,
  },
  "arduino-cli": {
    def: "Arduino 的命令行工具，不打开 IDE 也能编译和上传程序。第 1.6 课里的路线 A（<code>flexitac-flash</code>）需要先装好它。",
  },
  // Section 2 and 3 (2026-10-25)
  teleoperation: {
    term: "遥操作",
    aka: "teleop",
    def: "由你亲自远程操控机器人：用鼠标、摇杆，或者另一只“主”机械臂（leader arm）。录下来的遥操作过程，就是机器人最先拿来学习的示教（demonstration）。",
  },
  "sim-to-real": {
    term: "从仿真到真实",
    aka: "sim2real · sim-to-real transfer",
    def: "把机器人在仿真（simulation）里学到的本领用到真实机器人上。只有仿真表现得像真实世界（包括触觉）时，这才行得通：两者之间的差别叫作仿真与真实的差距（sim-to-real gap）。",
  },
  "reinforcement-learning": {
    term: "强化学习",
    aka: "RL",
    def: "通过反复试错来学习：机器人去尝试，做对了就得到奖励（reward），慢慢地就更多地去做能拿到奖励的事。它需要非常多次尝试，所以通常在仿真里进行。",
  },
  policy: {
    term: "策略",
    def: "机器人的决策程序：输入它此刻看到的和感觉到的，输出它的下一个动作。学会一项技能，就是把策略变得更好。",
  },
  "taxel-point": {
    term: "触觉像素点",
    aka: "simulated taxel · 仿真触觉像素",
    def: `在仿真器里，传感垫上的一个触摸点被表示成手指表面上的一个点。一块仿真的 FlexiTac 传感垫有 ${ROWS} × ${COLS} = ${ROWS * COLS} 个这样的点，相距 2 mm，编号顺序和真实的一帧（frame）相同。`,
  },
  "penetration-depth": {
    term: "穿透深度",
    aka: "d",
    def: "仿真中物体在某一点压进传感垫有多深，单位是毫米。物体碰不到的地方，深度就是 0。",
  },
  "kelvin-voigt": {
    term: "弹簧-阻尼模型",
    aka: "Kelvin-Voigt model · spring and damper",
    def: "一个弹簧和一个阻尼器（damper）并排放在一起。在触觉仿真里，每个点的反推力是 f = k<sub>n</sub>·d + k<sub>d</sub>·ḋ：弹簧那部分随深度 d 增大，阻尼那部分随深度变化的快慢增大。",
  },
  calibration: {
    term: "标定",
    def: "调整模型里的数，直到它和真实测量对得上。对仿真的传感垫来说，就是调 k<sub>n</sub> 和 k<sub>d</sub>，直到仿真的按压曲线和真实的一样。",
  },
};
