// Chinese for the lessons' Specs rows (src/content/facts.ts fact(), src/i18n/localize.ts locSpec). Follow
// docs/i18n-terms-zh.md. For each word of a row, the first of these that has it wins (else the English shows):
//   1. the lesson's own src/lessons/zh/<file>.ts `specs` entry (by place);
//   2. the fact's own words, for a row that shows the fact's own value or note: FACTS_ZH[key].value / .note, and
//      UNITS_ZH for the counted nouns formatValue() writes ("384 taxels" -> "384 个触觉像素");
//   3. SPECS_ZH[the English text]: any label, and any value or note a lesson wrote itself (most rows of most lessons);
//   4. FACTS_ZH[key].label: a fact's default label, for a label SPECS_ZH does not have.
//   UNITS_ZH   the counted nouns formatValue() writes after a number. Real units (mm, Hz, Ω, min, baud, hex) stay.
//   FACTS_ZH   per fact key (shared/data/sources.json): `label` (the default), `note` (the fact's own note) and `value`
//              (a fact whose value is a text, e.g. "top layer only"; numbers and units need none).
//   SPECS_ZH   keyed by the English text exactly as the lesson shows it (labels, values, notes). A key built from the
//              shared numbers uses them, as the English lesson does, so the two stay in step; a key that no longer
//              matches only shows the English again (and the check script lists it).
import { COLS, FRAME_HZ, MUX_OFFSET, R1, ROWS } from "@shared/data/constants.mjs";

export const UNITS_ZH: Record<string, string> = {
  "sense lines": "条感应线",
  "drive lines": "条驱动线",
  taxels: "个触觉像素",
  bytes: "字节",
  byte: "字节",
  frames: "帧",
  counts: "计数",
};

/** formatValue()'s words that are not units. */
export const FORMAT_ZH = {
  missing: "资料中未给出",
};

export interface FactZh {
  label?: string;
  note?: string;
  value?: string;
}

const LAST = MUX_OFFSET + ROWS - 1; // the last mux channel in use
const TAXELS = ROWS * COLS;

export const FACTS_ZH: Record<string, FactZh> = {
  // the pad
  "sensor.taxels": { label: "触觉像素" },
  "sensor.rows": { label: "感应线", note: `顶层 FPC 上的 ${ROWS} 条感应线 -> mux 通道 ${MUX_OFFSET}–${LAST}` },
  "sensor.cols": { label: "驱动线", note: `底层 FPC 上的 ${COLS} 条驱动线 <- 4 片 SN74HC595` },
  "sensor.muxChannels": { label: "用到的通道", note: `12x32 传感器上不用通道 0–${MUX_OFFSET - 1}` },
  "pad.activeArea": { label: "感应区域" },
  "pad.thickness": { label: "传感垫厚度" },
  "pad.layers": { label: "层数" },
  "pad.crossing": { label: "每个交叉点的铜线重叠", note: "一个交叉点上两条铜线重叠的部分" },
  "fpc_top.electrodes.pitch": { label: "线间距（pitch）" },
  "fpc_top.thickness": { label: "顶层 FPC 厚度" },
  "fpc_bot.thickness": { label: "底层 FPC 厚度" },
  "fpc_top.copperSide": { label: "FPC 铜层", value: "只有顶层有铜" },
  "fpc_top.mounting": { label: "顶层 FPC 安装方向", value: "铜面朝下（朝向 Velostat）" },
  "stack.lam_top.thickness": { label: "覆膜厚度", note: "资料中未给出" },
  "stack.pi_top.thickness": { label: "聚酰亚胺胶带厚度", note: "资料中未给出" },
  "velostat.thickness": { label: "Velostat 厚度" },
  "velostat.volumeResistivity": { label: "体积电阻率" },
  "velostat.behaviour": { label: "Velostat", value: "按压使电阻变小" },
  characterization: {
    label: "力的数据",
    note: "没有力或特性测量数据：任何“按压 -> 电阻”曲线都只是示意；不标牛顿（N）",
  },
  // the reading board
  "board.size": { label: "读取板尺寸", note: "论文中为 56.8 x 39.9 mm" },
  "board.part.U2": { label: "移位寄存器" },
  "board.part.U6": { label: "多路选择器" },
  "board.part.R1": { label: "R1 元件" },
  "board.part.FPC1": { label: "FPC1" },
  "board.part.FPC2": { label: "FPC2" },
  "board.595chain": { label: "级联方式", value: "D2 -> U2.SER; U2.QH' -> U3.SER -> U4 -> U5; U5.QH' 悬空" },
  "board.clockTie": {
    label: "时钟",
    value: "D3 -> 所有 595 的 SRCLK + RCLK",
    note: "时钟接在一起 -> 输出锁存器比移位级晚一个时钟",
  },
  "board.OE": { label: "输出使能", value: "#OE -> GND（输出始终有效，未选中的驱动线保持 LOW）" },
  "board.muxSelect": { label: "选择与使能" },
  "board.A0": { label: "输出", value: "A0 = mux 的 COM；R1 接在 A0 与 GND 之间" },
  "board.R1": { label: "R1", note: "原理图和贴片文件（PnP）上的“20k”标注是文档错误" },
  "board.R_on": { label: "开关导通电阻", note: "近似值" },
  "board.headerHoles": { label: "Nano 排针孔" },
  // the firmware and the data
  "system.frameRate": { label: "帧率" },
  "firmware.frameBytes": { label: "帧大小" },
  "firmware.header": { label: "帧头" },
  "firmware.baud": { label: "串口速率" },
  "firmware.scanStart": {
    label: "每条感应线的开头",
    value: "每行第一次读取前：shiftColumn(true); shiftColumn(false)",
  },
  "firmware.enablePulse": { label: "E# 脉冲", value: "setRow(0)：每帧一次，E# 先 HIGH 后 LOW" },
  "firmware.adcToByte": { label: "读数 → 字节", value: "raw >> 2（去掉最低两位）" },
  "firmware.adcPrescaler": { label: "ADC 预分频器", note: "16 MHz 主频下，ADC 时钟为 1 MHz" },
  "firmware.repo16.frameBytes": { label: "16 行版本", note: "16 x 32 版本，不是默认的" },
  "firmware.default": { label: "默认固件", value: `PyFlexiTac ${ROWS} 行版（mux 偏移 ${MUX_OFFSET}）` },
  // on the computer
  "host.initFrames": { label: "基线帧数" },
  "host.threshold": { label: "阈值" },
  "host.noiseScale": { label: "安静帧缩放值" },
  "host.alpha": { label: "平滑系数 alpha（EMA）" },
  "host.colormap": { label: "色图" },
  "host.restingBytes": { label: "静止时的典型字节值", note: "用来确定示意触觉像素曲线的位置" },
  // building one
  "build.time": { label: "制作时间", note: "约数" },
  "cost.unit": { label: "每个传感器的成本", note: "约数" },
  "cost.fpcPair": { label: "一对 FPC（BOM）" },
  "cost.nano": { label: "Arduino Nano（BOM）" },
};

/** Specs words by their English text, exactly as the lesson shows it: labels, and the values and notes a lesson wrote
 *  itself (see the top of this file for which wins). */
export const SPECS_ZH: Record<string, string> = {
  // ---------------------------------------------------------------- 1.1 Meet FlexiTac
  Taxels: "触觉像素",
  "Sense lines": "感应线",
  "On the Top FPC, read through the multiplexer": "在顶层 FPC 上，经多路选择器读取",
  "Drive lines": "驱动线",
  "On the Bottom FPC, driven by four shift registers": "在底层 FPC 上，由四片移位寄存器驱动",
  "Sensing area": "感应区域",
  "Line spacing (pitch)": "线间距（pitch）",
  "Centre to centre, both sheets": "中心到中心，两张 FPC 相同",
  "Pad thickness": "传感垫厚度",
  "Frame rate": "帧率",
  "Full pictures per second": "每秒完整画面数",
  "Frame size": "帧大小",
  [`AA 55 header + ${TAXELS} readings`]: `AA 55 帧头 + ${TAXELS} 个读数`,
  "Serial speed": "串口速率",
  "Velostat sheet": "Velostat 薄膜",
  "Build time": "制作时间",
  "Cost per sensor": "每个传感器的成本",

  // ---------------------------------------------------------------- 1.2 The sandwich
  Layers: "层数",
  "5 + edge tape": "5 层 + 封边胶带",
  "Laminate, Top FPC, Velostat, Bottom FPC, laminate; polyimide tape seals the edges":
    "覆膜、顶层 FPC、Velostat、底层 FPC、覆膜；聚酰亚胺胶带封住四边",
  "Whole pad": "整个传感垫",
  "Top FPC": "顶层 FPC",
  [`${ROWS} sense lines, mounted copper-down`]: `${ROWS} 条感应线，铜面朝下安装`,
  "Bottom FPC": "底层 FPC",
  [`${COLS} drive lines, copper-up`]: `${COLS} 条驱动线，铜面朝上`,
  "Velostat resistivity": "Velostat 电阻率",
  "Pressing lowers its resistance": "按压会让它的电阻变小",
  "Laminating sheet": "覆膜",
  "not given": "未给出",
  "Each FPC is stuck to one (guide step 1)": "每张 FPC 各贴在一张覆膜上（指南第 1 步）",
  "Polyimide tape": "聚酰亚胺胶带",
  "Seals the border (guide step 3); not drawn": "封住四边（指南第 3 步）；图中未画出",
  "FPC copper": "FPC 铜层",
  "one side only": "只有一面",
  "The other copper layer in the files is empty": "文件里的另一层铜是空的",
  "Top FPC mounting": "顶层 FPC 安装方向",
  "copper-down": "铜面朝下",
  "So both copper faces touch the Velostat": "这样两面的铜线都贴着 Velostat",
  "FPC build": "FPC 工艺",
  "1 oz Cu · ENIG": "1 oz 铜 · ENIG 沉金",
  "Polyimide 25 µm, coverlay PI 25 um / adhesive 25 um": "聚酰亚胺 25 µm，覆盖膜 PI 25 µm / 胶层 25 µm",

  // ---------------------------------------------------------------- 1.3 Meet the reading board
  Board: "读取板",
  "2 copper layers": "2 层铜",
  "Nano pins used": "用到的 Nano 引脚",
  "8: D2, D3 (drive) · D4–D8 (mux) · A0": "8 个：D2、D3（驱动）· D4–D8（mux）· A0",
  "2 for the shift registers, 4 select + 1 enable for the multiplexer, 1 analog input":
    "2 个给移位寄存器，4 个选择 + 1 个使能给多路选择器，1 个模拟输入",
  "Shift registers": "移位寄存器",
  "74HC595: 8 outputs each, one per drive line": "74HC595：每片 8 路输出，每路接一条驱动线",
  Chain: "级联方式",
  Clocks: "时钟",
  "Output enable": "输出使能",
  Multiplexer: "多路选择器",
  "16 channels to one output, COM": "16 个通道共用一个输出 COM",
  "Channels used": "用到的通道",
  [`Sense line n → channel n + ${MUX_OFFSET - 1}; channels 0–${MUX_OFFSET - 1} unused`]: `感应线 n → 通道 n + ${MUX_OFFSET - 1}；通道 0–${MUX_OFFSET - 1} 不用`,
  "Select and enable": "选择与使能",
  Output: "输出",
  "THD0515-32CL-SN · 32 pins": "THD0515-32CL-SN · 32 针",
  [`The ${COLS} drive lines, out to the Bottom FPC`]: `${COLS} 条驱动线从这里出去，接到底层 FPC`,
  "FFC05001-16SBB124W5M · 16 pins": "FFC05001-16SBB124W5M · 16 针",
  [`The ${ROWS} sense lines in, on pins ${MUX_OFFSET + 1}–${LAST + 1}`]: `${ROWS} 条感应线从这里进来，在第 ${MUX_OFFSET + 1}–${LAST + 1} 针`,
  "Switch resistance": "开关导通电阻",
  [`Small next to the ${R1 / 1000} kΩ resistor and the taxel`]: `和 ${R1 / 1000} kΩ 电阻及触觉像素相比很小`,

  // ---------------------------------------------------------------- 1.4 One frame
  [`AA 55 + ${TAXELS} readings`]: `AA 55 + ${TAXELS} 个读数`,
  Header: "帧头",
  [`One frame every ${1000 / FRAME_HZ} ms`]: `每 ${1000 / FRAME_HZ} ms 一帧`,
  "The outputs run one clock behind the shift stage": "输出比移位级晚一个时钟",
  "Start of a sense line": "每条感应线的开头",
  "Clocks per sense line": "每条感应线的时钟数",
  "2 to load and latch the 1, then one per drive line": "2 个用来装入并锁存那个 1，然后每条驱动线 1 个",
  [`Sense line n (i = n − 1) → channel i + ${MUX_OFFSET}`]: `感应线 n（i = n − 1）→ 通道 i + ${MUX_OFFSET}`,
  "E# pulse": "E# 脉冲",
  "Reading → byte": "读数 → 字节",
  "ADC prescaler": "ADC 预分频器",
  "Time per reading": "每次读取用时",
  "Data rate": "数据速率",
  "About 19% of the link with 8N1 serial (10 bits a byte)": "约占 8N1 串口链路的 19%（每字节 10 位）",
  "16-row build": "16 行版本",
  [`2 + 16 × ${COLS}; not the default`]: `2 + 16 × ${COLS}；不是默认版本`,

  // ---------------------------------------------------------------- 1.5 Bytes to touch
  "AA 55 header + one byte per taxel": "AA 55 帧头 + 每个触觉像素一个字节",
  "Frame header": "帧头",
  "Frames per second": "每秒帧数",
  "Baseline frames": "基线帧数",
  "Per-taxel median": "每个触觉像素各取中位数",
  Threshold: "阈值",
  "Counts above the baseline that are ignored": "高出基线但仍被忽略的计数",
  "Noise scale": "噪声缩放值",
  "Divisor when the peak is below the threshold": "峰值低于阈值时用的除数",
  "Smoothing alpha (EMA)": "平滑系数 alpha（EMA）",
  "Colour map": "色图",
  "Typical resting bytes": "静止时的典型字节值",
  "PyFlexiTac's docstring; the lab rests near 12": "出自 PyFlexiTac 的代码说明；实验室的传感垫静止时约为 12",

  // ---------------------------------------------------------------- 1.6 Build your own
  "Per pad, parts pre-cut; the paper says ~5 min": "每块传感垫，零件已预先裁好；论文中写的是约 5 min",
  "FPC thickness (order option)": "FPC 厚度（下单选项）",
  "Gold finger thickness (order option)": "金手指厚度（下单选项）",
  "FPC price, 100 pairs": "FPC 价格（100 对）",
  "~$2.57 per pair": "每对约 $2.57",
  "FPC pair (BOM)": "一对 FPC（BOM）",
  "Board PCBA, 5 boards": "读取板 PCBA（5 块）",
  "$40.41 total": "共 $40.41",
  "Delivery about one week": "大约一周到货",
  "Arduino Nano (BOM)": "Arduino Nano（BOM）",
  "Complete unit": "一整套",
  "Nano header holes": "Nano 排针孔",
  "Two rows of 15": "两排，每排 15 个",
  "Default firmware": "默认固件",
  "Mux channels used": "用到的 mux 通道",
  [`Offset ${MUX_OFFSET}: frame row 0 = channel ${MUX_OFFSET}`]: `偏移 ${MUX_OFFSET}：帧的第 0 行 = 通道 ${MUX_OFFSET}`,
  "Board in the IDE / arduino-cli": "IDE / arduino-cli 里选的板卡",
  "Old bootloader: Processor → ATmega328P (Old Bootloader), or cpu=atmega328old":
    "旧版引导程序：Processor → ATmega328P (Old Bootloader)，或 cpu=atmega328old",
  "Flat 0 or flat 255": "读数全是 0 或全是 255",
  "a wiring issue, not a flashing issue": "是接线问题，不是烧录问题",
  "No frames (fps 0, TimeoutError)": "收不到帧（fps 0、TimeoutError）",
  "rows, columns and baud must match what you flashed": "行数、列数和波特率必须与烧录的固件一致",

  // ---------------------------------------------------------------- 2.1 Put FlexiTac on a robot
  "Touch spots per pad": "每块传感垫的触摸点",
  "Pads and boards": "传感垫与读取板",
  "2 pads, 2 reading boards, 2 USB cables": "2 块传感垫、2 块读取板、2 根 USB 线",
  "Where the boards sit": "读取板的位置",
  "beside the gripper motor, one per finger": "在夹爪电机旁边，每根手指一块",
  "Cable length": "排线长度",
  "about 15 cm, slack for the full stroke": "约 15 cm，为整个行程留出余量",
  "Frames per board": "每块读取板的帧率",
  "Each board sends its own pad's frames": "每块读取板只发送自己那块传感垫的帧",
  "Per board, per frame": "每块读取板、每一帧",
  "Soft finger": "软指",
  "UMI fin, TPU 95A, 40 × 123.4 × 25.8 mm": "UMI 鳍形软指，TPU 95A，40 × 123.4 × 25.8 mm",
  "Gripper opening": "夹爪开口",
  "Holders and trays": "固定架与托盘",
  "drawn for this gripper": "为这款夹爪绘制",

  // ---------------------------------------------------------------- 2.2 Grasp with your mouse
  "Touch spots": "触摸点",
  "12 × 32 per pad, 2 pads": "每块 12 × 32，共 2 块",
  "Grip force": "夹持力",
  "up to 5 N per pad": "每块最多 5 N",
  "Where the closing stops: the motor's stall in this model": "夹爪合拢停下的地方：本模型里电机的堵转",
  "Spring per point": "每个点的弹簧",
  "Damper per point": "每个点的阻尼器",
  Friction: "摩擦",
  "An object lifts once the squeeze × μ holds its weight": "夹紧力 × μ 托得住物体的重量时，物体就被提起",
  Objects: "物体",
  "strawberry 20 g · cube 28 mm, 14 g": "草莓 20 g · 立方体 28 mm，14 g",
  "Noise threshold": "噪声阈值",
  "The real viewer's rule, used here too: smaller readings count as 0": "真实查看器的规则，这里也用：比它小的读数记为 0",
  "Quiet-frame scale": "安静帧缩放值",
  "A frame whose top value is under the threshold is divided by this": "最大值低于阈值的帧，就除以这个数",

  // ---------------------------------------------------------------- 3.1 Why simulate touch
  "Copies practising at once": "同时练习的副本数",
  "In VT-Refine's simulation (its config: n_envs 100)": "VT-Refine 的仿真中（其配置：n_envs 100）",
  "Real demos to start from": "起步用的真实示教",
  "30 per task": "每个任务 30 次",
  "Teleoperated by a person": "由人遥操作完成",
  "Copies drawn here": "这里画出的副本数",
  "Simulator in this course": "本课程的仿真器",
  "your browser: no GPU, nothing to install": "你的浏览器：不需要 GPU，什么都不用装",

  // ---------------------------------------------------------------- 3.2 A pad made of points
  "Points per pad": "每块传感垫的点数",
  "One per crossing of the real pad": "真实传感垫的每个交叉点一个",
  Spacing: "间距",
  "The real pad's line spacing": "真实传感垫的线间距",
  Numbering: "编号",
  [`i = sense line 0–${ROWS - 1}, j = drive line 0–${COLS - 1}: the frame's order`]: `i = 感应线 0–${ROWS - 1}，j = 驱动线 0–${COLS - 1}：与帧的顺序相同`,
  "In research simulators": "研究用的仿真器中",
  [`${ROWS} × ${COLS} lattice at 2 mm, ray-cast onto the pad`]: `${ROWS} × ${COLS} 点阵，间距 2 mm，用射线投射到传感垫上`,
  "Press depth in the card": "卡片里的按压深度",

  // ---------------------------------------------------------------- 3.3 How deep, how hard
  Model: "模型",
  "f = k<sub>n</sub> d + k<sub>d</sub> ḋ, normal force only": "f = k<sub>n</sub> d + k<sub>d</sub> ḋ，只算法向力",
  "In this course": "本课程中",
  "k<sub>n</sub> = 0.6 N/mm, k<sub>d</sub> = 0.012 N·s/mm per point": "每个点 k<sub>n</sub> = 0.6 N/mm，k<sub>d</sub> = 0.012 N·s/mm",
  "In the paper": "论文中",
  "k<sub>n</sub> = 1, k<sub>d</sub> = 0.003 (SI units)": "k<sub>n</sub> = 1，k<sub>d</sub> = 0.003（国际单位制）",
  "Different units and a different pad model: not comparable one to one": "单位不同，传感垫模型也不同：不能一一对比",
  "Released code": "公开的代码",
  "spring only (no damper), normal force kept": "只有弹簧（没有阻尼器），保留法向力",
  "The paper's damper is not in the released code": "论文里的阻尼器不在公开的代码中",
  "Isaac Lab port": "Isaac Lab 移植版",
  "spring only, clamped at a maximum force": "只有弹簧，力被限制在一个最大值以内",
  "Ball in the card": "卡片里的小球",
  "r = 8 mm, pressed 1.3 mm": "r = 8 mm，压入 1.3 mm",

  // ---------------------------------------------------------------- 3.4 Playground
  "Spring, damper (start)": "弹簧、阻尼（初始值）",
  "Force to counts": "力 → 计数",
  "125 counts per newton": "每牛顿 125 计数",
  "Engine rate": "引擎步频",
  [`${FRAME_HZ} steps a second, like a real pad's frames`]: `每秒 ${FRAME_HZ} 步，和真实传感垫的帧率一样`,

  // ---------------------------------------------------------------- set-aside lessons (04-06, 34: not in the course today)
  "Velostat thickness": "Velostat 厚度",
  "Volume resistivity": "体积电阻率",
  "Copper overlap per crossing": "每个交叉点的铜线重叠",
  "Line pitch": "线间距",
  "Force data": "力的数据",
  "R1 part": "R1 元件",
  "Mux on-resistance R_on": "mux 导通电阻 R_on",
  "A0 node": "A0 节点",
  "Unused drive lines": "未选中的驱动线",
  "ADC → byte": "ADC → 字节",
  "Typical resting byte": "静止时的典型字节值",
  "Readings below it count as 0 (the real viewer's rule)": "低于它的读数记为 0（真实查看器的规则）",
  "Used instead of the frame's top value when that is under the threshold": "帧的最大值低于阈值时，用它来代替",
  "The real viewer's resting level: the median of the first frames": "真实查看器的静止水平：最初几帧的中位数",
};
