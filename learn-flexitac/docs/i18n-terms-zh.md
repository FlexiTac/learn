# Term sheet: English → 简体中文

Every Chinese text on the site follows this sheet: lessons, glossary, pages, widgets and figures. If a word you need
is not here, choose one, use it the same way everywhere, and add it here. How the Chinese gets into the site is in
[`i18n.md`](./i18n.md).

**Readers:** high-school and first-year undergraduate students. Write plain Chinese in short sentences, and address
the reader as “你”. Say what a thing *does* before you name it, as the English does.

## 1. Rules

| Rule | Example |
|---|---|
| **Product and part names stay English.** | FlexiTac, Velostat, Arduino Nano, FPC, FFC, PCB, USB, A0, D2–D8, AA 55, 74HC595, CD74HC4067, Isaac, VT-Refine, 3D-ViTac, UMI, reBot (also PyFlexiTac, Gerber, BOM, arduino-cli, Adafruit 1361, U2–U6, FPC1/FPC2, E#, SER, SRCLK, RCLK, GND) |
| **Key concepts are bilingual at their FIRST mention in each lesson (and each glossary definition), then Chinese only.** Write 中文（English）. | first 「触觉像素（taxel）」, later 「触觉像素」 |
| In `<dfn>`, put the first-mention form inside and name the glossary entry. | `<dfn data-term="taxel">触觉像素（taxel）</dfn>` |
| **Code, formulas, units, numbers and serial bytes stay as they are.** | `raw >> 2`, `V = 5 V × R1 / (R1 + R)`, 0.1 mm, 100 Hz, 10 kΩ, 2,000,000 baud, `AA 55`, 0x41 |
| **Punctuation:** full-width in Chinese sentences, half-width for numbers, units, code and Latin words. | ，。：；？！（）“” 、 …… |
| **Spacing:** one half-width space between Chinese and a Latin word or a number. No space next to full-width punctuation. | 第 1.2 课 · 12 条感应线 · 用 Arduino Nano 读取 · 触觉像素（taxel） |
| **Parentheses** are full-width around a gloss, even an English one. | 多路选择器（multiplexer，简称 mux） |
| **Quotes** are “ ” (not 「」 and not "…"). | 按下“运行” |
| The middle dot ` · ` and the arrows (→ ← ↑ ↓) stay as separators. | 第 1.4 课 · 读取板 |
| **No italics.** Chinese has none, and the site shows `<i>` and `<em>` upright in Chinese. For stress use `<b>`. An English term in `<i>` is fine. | |
| **No upper case and no letter spacing.** The site's kicker styles drop both for Chinese. Do not write Latin in capitals to imitate them. | |
| **Keep the HTML.** Same tags, same `{placeholders}`, same `${…}` numbers from the shared data. | |
| **Length:** a guided step's text takes at most **3 lines** at 1366–1440 px. Card labels and figure labels must not overflow. Chinese is shorter than English, so do not pad it. | |

## 2. Badges and UI words

| English | 中文 | Notes |
|---|---|---|
| illustrative | 示意 | badge: shape only, no measured data |
| inferred | 推断 | badge: worked out, not stated |
| proposed | 建议做法 | badge: drawn for this example |
| external | 外部 | badge: outside the FlexiTac materials |
| draft | 草稿 | |
| done | 已完成 | |
| Lesson 1.2 | 第 1.2 课 | numbering keeps the dot |
| Lessons 1.1–1.2 | 第 1.1–1.2 课 | |
| Section 1 | 第 1 部分 | |
| chapter | 章节 | |
| Step 2 of 4 | 第 2 步，共 4 步 | |
| Fig 1 | 图 1 | |
| Overview / Parts / Wiring / Code / Specs | 概览 / 零件 / 接线 / 代码 / 参数 | lesson tabs |
| Show me / Next step / Done | 演示一下 / 下一步 / 完成 | steps bar |
| Check yourself | 自我检测 | quiz |
| Try it yourself | 动手试试 | code card |
| Run | 运行 | |
| Details › | 详情 › | figure labels |
| Glossary | 术语表 | |
| Coming soon / To be continued | 即将推出 / 未完待续 | |
| Click / Tap / Drag / Press and hold | 点击 / 轻点 / 拖动 / 按住 | figure hints |
| Zoom / Pan / Reset view | 缩放 / 平移 / 重置视图 | |
| Take apart / Put together (explode / collapse) | 拆开 / 合上 | Fig 1 |

## 3. Concepts

The first column of 中文 is the form to use after the first mention. **First mention** is the form for the first time
the term appears in a lesson. **Glossary id** is the value for `<dfn data-term="…">` (blank: no glossary entry).

### The sensor

| English | 中文 | First mention | Glossary id | Notes |
|---|---|---|---|---|
| taxel | 触觉像素 | 触觉像素（taxel） | `taxel` | “tactile pixel”. In plain text the English often says *touch spot*: use 触摸点 there |
| touch spot | 触摸点 | 触摸点 | | the plain word for a taxel |
| pad (the FlexiTac pad) | 传感垫 | 传感垫 | | the sensor itself, as a part |
| sensor | 传感器 | 传感器 | | |
| tactile sensor | 触觉传感器 | 触觉传感器 | | |
| sense line | 感应线 | 感应线（sense line） | `sense-line` | 12 of them, on the Top FPC |
| drive line | 驱动线 | 驱动线（drive line） | `drive-line` | 32 of them, on the Bottom FPC |
| crossing | 交叉点 | 交叉点（crossing） | | one sense line over one drive line = one taxel |
| electrode | 电极 | 电极（electrode） | `electrode` | |
| pitch (line spacing) | 间距 | 间距（pitch） | `pitch` | centre to centre |
| sandwich (the layer stack) | 三明治结构 | 三明治（夹层）结构 | | lesson 1.2's title: 三明治结构 |
| layer | 层 | 层 | | five layers: 五层 |
| laminating sheet | 覆膜 | 覆膜（laminating sheet） | `laminating-sheet` | Top/Bottom laminating sheet: 顶层覆膜 / 底层覆膜 |
| polyimide | 聚酰亚胺 | 聚酰亚胺（polyimide） | `polyimide` | |
| polyimide tape | 聚酰亚胺胶带 | 聚酰亚胺胶带（polyimide tape） | | Kapton tape |
| Top FPC / Bottom FPC | 顶层 FPC / 底层 FPC | 顶层 FPC（Top FPC） | `fpc` | FPC stays English. Flexible printed circuit: 柔性电路板 in a gloss |
| FFC (cable) | FFC 排线 | FFC 排线（flat flexible cable） | `ffc` | |
| tail (of an FPC) | 尾线 | 尾线 | | the FPC's tail that plugs in |
| gold fingers | 金手指 | 金手指（gold fingers） | `gold-fingers` | |
| slot | 槽 | 槽（slot） | `slot` | |
| supporting beam | 支撑梁 | 支撑梁（supporting beam） | `supporting-beam` | |
| stiffener | 补强板 | 补强板（stiffener） | `stiffener` | |
| compliance | 柔顺性 | 柔顺性（compliance） | `compliance` | |
| copper (line, strip) | 铜线 / 铜条 | 铜线 | | copper side 铜面, copper-up 铜面朝上, copper-down 铜面朝下 |
| piezoresistive | 压阻 | 压阻（piezoresistive） | `piezoresistive` | piezoresistive material: 压阻材料 |
| resistance | 电阻 | 电阻 | `resistance` | the quantity |
| resistor (R1) | 电阻（R1） | 电阻 R1 | | the part: 10 kΩ 电阻 |
| resistivity | 电阻率 | 电阻率 | `resistivity` | volume / surface: 体积电阻率 / 表面电阻率 |
| voltage | 电压 | 电压 | `voltage` | |
| current | 电流 | 电流 | `current` | |
| Ohm's law | 欧姆定律 | 欧姆定律 | `ohms-law` | |
| voltage divider | 分压电路 | 分压电路（voltage divider） | `voltage-divider` | |
| in series | 串联 | 串联 | `series` | |
| ground (GND) | 地（GND） | 地（GND） | | |
| press / pressure / force | 按压 / 压力 / 力 | | | “no force data”: 没有力的测量数据. Newtons: 牛顿（N） |
| ghosting | 鬼影 | 鬼影（ghosting） | `ghosting` | |
| time multiplexing | 分时复用 | 分时复用（time multiplexing） | `time-multiplexing` | |

### The reading board and the data

| English | 中文 | First mention | Glossary id | Notes |
|---|---|---|---|---|
| reading board | 读取板 | 读取板（reading board） | | |
| Arduino Nano | Arduino Nano | Arduino Nano | `arduino-nano` | stays English; the Nano |
| microcontroller | 微控制器 | 微控制器（microcontroller） | | |
| firmware | 固件 | 固件（firmware） | `firmware` | |
| flash (verb) | 烧录 | 烧录（flash） | `flash` | |
| bootloader | 引导程序 | 引导程序（bootloader） | `bootloader` | |
| FQBN | FQBN | FQBN（板卡全名） | `fqbn` | |
| header sockets | 排母 | 排母（header sockets） | | the Nano plugs into them |
| connector | 连接器 | 连接器 | | 16-pin connector: 16 针连接器 |
| pin | 引脚 | 引脚 | | data pin 数据引脚, select pins 选择引脚 |
| select pins | 选择引脚 | 选择引脚（select pins） | `select-pins` | S0–S3 |
| multiplexer, mux | 多路选择器 | 多路选择器（multiplexer，简称 mux） | `multiplexer` | then 多路选择器 or mux |
| channel | 通道 | 通道（channel） | `channel` | mux channel 4–15 |
| shift register | 移位寄存器 | 移位寄存器（shift register） | `shift-register` | |
| chain (595s in a chain, daisy-chained) | 级联 | 级联 | | the four 74HC595s: 四片级联的 74HC595. Not 串联 (that is “in series”) |
| on-resistance R_on / switch resistance | 导通电阻 / 开关导通电阻 | | | the mux switch, 70 Ω |
| header holes (for the Nano) | 排针孔 | | | two rows of 15: 两排，每排 15 个 |
| output latch | 输出锁存器 | 输出锁存器（output latch） | `output-latch` | latch (verb): 锁存 |
| clock / clock tick | 时钟 / 时钟脉冲 | 时钟 | | rising edge 上升沿 (`rising-edge`) |
| rising edge | 上升沿 | 上升沿（rising edge） | `rising-edge` | |
| Active LOW | 低电平有效 | 低电平有效（active LOW） | `active-low` | HIGH / LOW stay English |
| enable pin (E#) | 使能引脚（E#） | 使能引脚（E#） | | |
| ADC | ADC | ADC（模数转换器） | `adc` | |
| prescaler | 预分频器 | 预分频器（prescaler） | `prescaler` | |
| bit | 位 | 位（bit） | `bit` | |
| byte | 字节 | 字节（byte） | `byte` | 386 bytes: 386 字节 |
| frame | 帧 | 帧（frame） | `frame` | a frame of data: 一帧数据; frame rate 帧率; 100 frames/s: 100 帧/秒 |
| header (of a frame) | 帧头 | 帧头（header） | `header` | AA 55 |
| reading (one value) | 读数 | 读数 | | 384 readings: 384 个读数 |
| scan (verb / noun) | 扫描 | 扫描 | | row by row: 逐行 |
| serial / serial port | 串口 | 串口 | | |
| baud (rate) | 波特率 | 波特率（baud rate） | `baud` | the number keeps its unit: 2,000,000 baud |
| USB cable | USB 线 | USB 线 | | |
| BOM | BOM | BOM（物料清单） | `bom` | |
| PCBA | PCBA | PCBA（贴片成品板） | `pcba` | |
| Gerber | Gerber 文件 | Gerber 文件 | `gerber` | |
| schematic | 原理图 | 原理图 | | |

### On the computer: from bytes to a picture

| English | 中文 | First mention | Glossary id | Notes |
|---|---|---|---|---|
| baseline | 基线 | 基线（baseline） | `baseline` | |
| median | 中位数 | 中位数（median） | `median` | |
| threshold | 阈值 | 阈值（threshold） | `threshold` | |
| normalise | 归一化 | 归一化（normalise） | `normalise` | |
| EMA (smoothing) | 指数移动平均 | 指数移动平均（EMA） | `ema` | smoothing 平滑 |
| noise | 噪声 | 噪声 | | |
| viridis (colour map) | viridis 色图 | viridis 色图（colour map） | `viridis` | |
| heatmap | 热力图 | 热力图（heatmap） | `heatmap` | |
| touch map | 触觉图 | 触觉图 | | the 12 × 32 picture beside the figures |
| calibrate / recalibrate | 校准 / 重新校准 | | | the viewer's baseline. For a simulation model use 标定 (below) |
| viewer | 查看器 | 查看器 | | the PyFlexiTac viewer |

### On a robot

| English | 中文 | First mention | Glossary id | Notes |
|---|---|---|---|---|
| robot gripper | 机器人夹爪 | 机器人夹爪 | | gripper: 夹爪 |
| robot arm | 机械臂 | 机械臂 | | |
| finger / soft finger | 手指 / 软指 | 软指 | | |
| fin-shaped finger | 鳍形软指 | 鳍形软指（fin-shaped finger） | | the UMI finger: UMI 鳍形软指 |
| mount (verb) | 安装 | 安装 | | |
| tape (verb) | 贴 / 粘贴 | | | |
| extender (FFC extender board) | 转接板 | 转接板（extender） | | |
| teleoperation | 遥操作 | 遥操作（teleoperation） | `teleoperation` | |
| grasp / pick up | 抓取 / 拿起 | | | |
| policy | 策略 | 策略（policy） | `policy` | |
| demonstration (robot learning) | 示教 | 示教（demonstration） | | a few real demos: 少量真实示教 |
| cutting mat | 切割垫 | 切割垫 | | the mat under the objects in Fig 5's teleop mode |
| finger holder / board tray | 手指支架 / 板托 | | | the printed parts drawn for this gripper (proposed) |
| slack (a loop of slack) | 余量（那圈余量） | | | in the flat cables |
| squeeze / grip force | 夹紧力 | | | the total squeeze bar in 2.2 |
| stall (motor) | 堵转 | | | |
| strawberry / cube / ball / tube / bar | 草莓 / 立方体 / 球 / 圆管 / 横条 | | | the objects; glass ball 玻璃球, the cube's edge 立方体的棱; the 3.2 / 3.4 cards' buttons Ball / Tube / Edge / Strawberry: 球 / 圆管 / 横条的棱 / 草莓 (not 试管, not 方块) |
| left / right finger | 左手指 / 右手指 | | | |

### In simulation

| English | 中文 | First mention | Glossary id | Notes |
|---|---|---|---|---|
| simulation / simulator | 仿真 / 仿真器 | 仿真（simulation） | | |
| sim-to-real | 从仿真到真实 | 从仿真到真实（sim-to-real） | `sim-to-real` | real → sim → real: 真实 → 仿真 → 真实 |
| reinforcement learning | 强化学习 | 强化学习（reinforcement learning） | `reinforcement-learning` | |
| taxel point | 触觉像素点 | 触觉像素点（taxel point） | `taxel-point` | “a pad made of points”: 由点组成的传感垫 |
| penetration depth | 穿透深度 | 穿透深度（penetration depth） | `penetration-depth` | d |
| Kelvin–Voigt | 弹簧-阻尼模型 | 弹簧-阻尼模型（Kelvin–Voigt） | `kelvin-voigt` | spring 弹簧, damper 阻尼器 |
| stiffness k<sub>n</sub> / damping k<sub>d</sub> | 刚度 k<sub>n</sub> / 阻尼 k<sub>d</sub> | | | |
| calibration (of a model) | 标定 | 标定（calibration） | `calibration` | |
| playground | 实验场 | 实验场 | | lesson 3.4 |
| copy (of the robot, in sim) | 副本 | 副本 | | 100 copies: 100 个副本 |
| digital twin | 数字孪生 | 数字孪生（digital twin） | | |
| spring / damper | 弹簧 / 阻尼器 | | | spring + damper: 弹簧 + 阻尼器 |
| normal force | 法向力 | | | “normal force only”: 只有法向力 |
| shear | 剪切力 | 剪切力（shear） | | sideways rubbing: 侧向摩擦 |
| depth map / force map | 深度图 / 力图 | | | |
| ray-cast | 射线投射 | 射线投射（ray-cast） | | |
| Simulated (map) / Real-style (map) | “仿真”图 / “类真实”图 | | | the two maps of lesson 3.4's card; Sim vs real-style: 仿真 vs 类真实 |
| resting level | 静息水平 | | | a point's reading with nothing pressing |
| counts (byte units) | 计数 | | | 15 counts: 15 计数; 125 counts per newton: 每牛顿 125 计数 |
| noise scale / quiet-frame scale | 噪声缩放值 / 安静帧缩放值 | | | the fixed divisor (60) when a frame's top value is under the threshold |
| Reset (the sliders) | 重置 | | | |

### In the figures (Fig 1, Fig 3, Fig 5)

| English | 中文 | First mention | Glossary id | Notes |
|---|---|---|---|---|
| plan view / top view | 俯视图 | 俯视图 | | Fig 1's G key; "Top view (G)": 俯视图（G） |
| via | 过孔 | 过孔（via） | | Fig 3 |
| rail / carriage | 导轨 / 滑块 | | | Fig 5's gripper |
| gripper motor | 夹爪电机 | | | |
| SIMULATED (a map's kicker) | 仿真 | | | "WHAT THE SENSOR FEELS · SIMULATED": 传感器的感受 · 仿真 |
| light / firm (a map's legend) | 轻 / 重 | | | Fig 3's low / high: 低 / 高 |
| real time (scan speed) | 实时 | | | 1/10,000× stays as it is |
| Mux ch (Fig 3's button: next channel) | 换通道 | | | the readout: mux 通道 04 |
| clock (verb: give D3 one tick) | 打时钟 | | | "Clock D3": D3 时钟 |
| lift / lower the Nano | 抬起 / 放下 Nano | | | |

## 3a. Course structure

The section and chapter names (`src/lessons/zh/_sections.ts`). A chapter's name is also the kicker of its lessons.

| English | 中文 |
|---|---|
| Section 1 · The sensor | 第 1 部分 · 传感器 |
| The pad / The board / Use it | 传感垫 / 读取板 / 用起来 |
| Section 2 · On a robot | 第 2 部分 · 在机器人上 |
| Mount it / Grasp with touch / Coming next | 安装 / 用触觉抓取 / 接下来 |
| Section 3 · In simulation | 第 3 部分 · 在仿真中 |
| Touch as points / Contact to signal / Train with it | 用点表示触觉 / 从接触到信号 / 用它训练 |
| 2.1 Put FlexiTac on a robot · 2.2 Grasp with your mouse | 把 FlexiTac 装到机器人上 · 用鼠标抓取 |
| 3.1 Why simulate touch · 3.2 A pad made of points | 为什么要仿真触觉 · 由点组成的传感垫 |
| 3.3 How deep, how hard · 3.4 Playground | 压多深，力多大 · 实验场 |

## 4. Fixed phrases

| English | 中文 |
|---|---|
| Learn FlexiTac | Learn FlexiTac (the brand, never translated) |
| Touch · Scan · Sense | 触摸 · 扫描 · 感知 |
| shape only, no data | 只示意形状，没有实测数据 |
| not given in the materials | 资料中未给出 |
| (illustrative) after a caption | （示意） |
| Watch …, then … | 先看……，再…… |
