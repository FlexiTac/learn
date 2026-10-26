// Page texts, English (the source): the words of the home, lesson-list and about pages that are not UI chrome. The
// Chinese goes in ../zh/pages.ts under the same keys (missing ones fall back to this text). Values are authored HTML;
// {name} is filled by t(key, {name}) (links, numbers from the shared data).
export const PAGES_EN = {
  // ------------------------------------------------------------------ home (src/views/home.ts)
  "home.title": "Building Your Robot's First <em>Tactile Skin</em>",
  "home.tagline": "Bringing touch to every robot lab",
  "home.kw.accessible": "Accessible",
  "home.kw.accessibleTip": "Simple to build and low-cost, so touch sensing fits any robot lab",
  "home.kw.customizable": "Customizable",
  "home.kw.customizableTip": "Change the size, the resolution and the mounting to suit your gripper",
  "home.kw.flexible": "Flexible",
  "home.kw.flexibleTip": "Thin and bendable: it goes onto rigid jaws and soft fingers alike",
  "home.stack":
    "This course walks the full stack, one hands-on lesson at a time: <b>the sensor</b> and its reading board, then <b>on a robot</b>, then <b>in simulation</b>.",
  "home.figAria":
    "On a robot: a robot gripper with a FlexiTac pad on each finger picks up a strawberry, and the two pads' touch maps light up (illustrative). Open lesson {no}",
  "home.figCap": "Lesson {no} · On a robot · illustrative",

  // ------------------------------------------------------------------ lesson list (src/views/lessons.ts)
  "lessons.lede":
    "Start at 1.1: every lesson uses words the earlier ones explain. Each lesson counts as done when you pass its quiz or finish its guided steps.",

  // ------------------------------------------------------------------ about (src/views/about.ts)
  "about.title": "About this course",
  "about.lede":
    'Learn FlexiTac explains the <a href="{site}" target="_blank" rel="noopener noreferrer">FlexiTac</a> tactile sensor and its reading board for undergraduate and high-school students, with live figures you can take apart: the sensor itself (Section 1), FlexiTac on a robot\'s fingers (Section 2) and how a simulator can feel like it (Section 3).',
  "about.numbers.title": "Where the numbers come from",
  "about.numbers.p1":
    'Every number on this site is read from one shared data folder that the figures and the explainer video also use. That folder is extracted from the project\'s own files: the FPC and board Gerbers, the BOM and pick-and-place files, the schematic, the firmware, the hardware guide and the <a href="{paper}" target="_blank" rel="noopener noreferrer">paper</a>. The grey chips next to each spec name its source.',
  "about.numbers.p2":
    "No force measurements exist for the sensor, so Section 1's pressure curves are <i>illustrative</i> and never shown in newtons. Sections 2 and 3 run a small touch simulation in your browser: its forces are in newtons, but every one of them is <i>illustrative</i> too, from numbers chosen for teaching. How FlexiTac is mounted on the robot follows the FlexiTac team's own build (their photos); the parts drawn only for this example are marked <i>proposed</i>.",
  "about.credits.title": "Credits and licences",
  "about.credits.hw":
    'FlexiTac hardware: <a href="{hwRepo}" target="_blank" rel="noopener noreferrer">FlexiTac hardware repository</a> (CC BY-NC 4.0).',
  "about.credits.fw":
    'Default firmware and Python reader: <a href="{pyflexitac}" target="_blank" rel="noopener noreferrer">PyFlexiTac</a>.',
  "about.credits.velostat": "Velostat specs: Adafruit product 1361.",
  "about.credits.robot":
    'Robot: <a href="{rebot}" target="_blank" rel="noopener noreferrer">reBot-DevArm</a> by Seeed Studio (its CAD, drawn in this course\'s style). Soft fingers: the <a href="{umi}" target="_blank" rel="noopener noreferrer">UMI</a> fin-shaped finger.',
  "about.credits.sim":
    'Touch simulation method (Section 3): <a href="{vtRefine}" target="_blank" rel="noopener noreferrer">VT-Refine</a> (CoRL 2025), whose real-robot results (a coming lesson shows them); the in-browser model is this course\'s own simplified version.',
  "about.credits.layout":
    'Layout inspired by the structure of <a href="https://learn-arduino-red.vercel.app/" target="_blank" rel="noopener noreferrer">Learn Arduino</a>; no assets are reused.',
  "about.progress.title": "Your progress",
  "about.progress.p": "Progress, quiz answers and edited code values are saved only in this browser.",
} as const;
