// Page texts, Simplified Chinese: the home, lesson-list and about pages (same keys as ../en/pages.ts; a missing key shows
// the English). Follow docs/i18n-terms-zh.md. Keep every {placeholder} of the English line.
import type { PAGES_EN } from "../en/pages";

export const PAGES_ZH: Partial<Record<keyof typeof PAGES_EN, string>> = {
  // ------------------------------------------------------------------ home (src/views/home.ts)
  "home.title": "<span class=\"nw\">为机器人打造</span><span class=\"nw\">第一层</span><em class=\"nw\">触觉皮肤</em>",
  "home.tagline": "让每个机器人实验室都拥有触觉",
  "home.kw.accessible": "易获取",
  "home.kw.accessibleTip": "制作简单、成本低，每个机器人实验室都用得起",
  "home.kw.customizable": "可定制",
  "home.kw.customizableTip": "尺寸、分辨率和安装方式都能按你的夹爪来改",
  "home.kw.flexible": "柔性",
  "home.kw.flexibleTip": "又薄又能弯，硬夹爪和软手指都能贴",
  "home.stack":
    "这门课一课一课带你走完整条链路：先是<b>传感器</b>：怎样用它、怎样把它<b>装到机器人上</b>；再是<b>读取板</b>；最后<b>在仿真中</b>使用它。",
  "home.figAria":
    "在机器人上：每根手指上贴着一块 FlexiTac 传感垫的机器人夹爪拿起一颗草莓，两块传感垫的触觉图亮了起来（示意）。打开第 {no} 课",
  "home.figCap": "第 {no} 课 · 在机器人上 · 示意",

  // ------------------------------------------------------------------ lesson list (src/views/lessons.ts)
  "lessons.lede":
    "从第 1.1 课开始：每一课用到的词，前面的课都解释过。通过一课的测验，或者走完它的引导步骤，这一课就算完成。",

  // ------------------------------------------------------------------ about (src/views/about.ts)
  "about.title": "关于本课程",
  "about.lede":
    'Learn FlexiTac 面向本科生和高中生，讲解 <a href="{site}" target="_blank" rel="noopener noreferrer">FlexiTac</a> 触觉传感器和它的读取板，配有可以拆开的实时交互图形：传感器本身、怎样用它，以及装在机器人手指上的 FlexiTac（第 1 部分），读取板（第 2 部分），以及仿真器怎样做出同样的触觉（第 3 部分）。',
  "about.numbers.title": "数字从哪里来",
  "about.numbers.p1":
    '本站的每个数字都读自同一个共享数据文件夹，图形和讲解视频用的也是它。这个文件夹的内容提取自项目自己的文件：FPC 和电路板的 Gerber 文件、BOM 和贴片坐标文件、原理图、固件、硬件指南，以及<a href="{paper}" target="_blank" rel="noopener noreferrer">论文</a>。每条参数旁边的灰色标签注明了它的来源。',
  "about.numbers.p2":
    "这个传感器没有力的测量数据，所以压力曲线都是“示意”，从不以牛顿为单位显示。机器人那一课（1.5）和第 3 部分会在你的浏览器里运行一个小型触觉仿真：它的力以牛顿（N）为单位，但每一个力也都是“示意”，来自为教学选定的数值。FlexiTac 在机器人上的安装方式参照 FlexiTac 团队自己的实物（他们的照片）；只为这个例子画出的零件标为“建议做法”。",
  "about.credits.title": "致谢与许可",
  "about.credits.hw":
    'FlexiTac 硬件：<a href="{hwRepo}" target="_blank" rel="noopener noreferrer">FlexiTac 硬件仓库</a>（CC BY-NC 4.0）。',
  "about.credits.fw":
    '默认固件和 Python 读取程序：<a href="{pyflexitac}" target="_blank" rel="noopener noreferrer">PyFlexiTac</a>。',
  "about.credits.velostat": "Velostat 参数：Adafruit 产品 1361。",
  "about.credits.robot":
    '机器人：Seeed Studio 的 <a href="{rebot}" target="_blank" rel="noopener noreferrer">reBot-DevArm</a>（用它的 CAD 模型，按本课程的风格绘制）。软指：<a href="{umi}" target="_blank" rel="noopener noreferrer">UMI</a> 鳍形软指。',
  "about.credits.sim":
    '触觉仿真方法（第 3 部分）：<a href="{vtRefine}" target="_blank" rel="noopener noreferrer">VT-Refine</a>（CoRL 2025），它的真机实验结果会在之后的一课中展示；浏览器里的模型是本课程自己的简化版本。',
  "about.credits.layout":
    '版式参考了 <a href="https://learn-arduino-red.vercel.app/" target="_blank" rel="noopener noreferrer">Learn Arduino</a> 的结构；没有复用任何素材。',
  "about.progress.title": "你的进度",
  "about.progress.p": "进度、测验答案和改过的代码数值只保存在这个浏览器里。",
};
