// Lesson 1.6 "Build your own": the Chinese of its build steps (BUILD in ../12-build-your-own.ts), which the
// build-checklist widget shows (src/widgets/build-checklist.ts reads them through locBuild below). Keyed by the step id;
// photos and checks go by place / by check id. Only words: ids, photos, clips and the terminal lines stay the English
// file's own (the terminal is code and stays as it is). Terms follow docs/i18n-terms-zh.md.
import { BAUD, COLS, FRAME_HZ, MUX_OFFSET, ROWS } from "@shared/data/constants.mjs";
import { lang } from "../../i18n/lang";
import type { BuildStep } from "../12-build-your-own";

const BAUD_TXT = BAUD.toLocaleString("en-US");

interface BuildStepZh {
  tab?: string;
  title?: string;
  /** HTML. */
  text?: string;
  /** By place. */
  photos?: (string | undefined)[];
  clip?: string;
  term?: string;
  /** By check id. */
  checks?: Record<string, string>;
}

export const BUILD_ZH: Record<string, BuildStepZh> = {
  parts: {
    tab: "零件",
    title: "摆好零件",
    text: "做一块传感垫要用的东西，一张切割垫就放得下：两块 FPC、两张预先裁好的覆膜（laminating sheet）、一方块 Velostat，以及聚酰亚胺胶带（polyimide tape）。手边再备一把美工刀或剪刀。",
    photos: ["切割垫上摆着标好名称的零件：FPC、覆膜、Velostat 和一卷聚酰亚胺胶带"],
    checks: {
      fpcs: `顶层 FPC（${ROWS} 条感应线）和底层 FPC（${COLS} 条驱动线）`,
      lam: "两张预先裁好的背胶覆膜",
      velo: "一方块 Velostat，大小足以盖住电极区",
      tape: "聚酰亚胺胶带，以及美工刀或剪刀",
    },
  },
  step1: {
    title: "1 · 把每块 FPC 贴到一张覆膜上",
    text: "撕开一张预裁好的覆膜，把顶层 FPC 的电极区压在它的粘面上。底层 FPC 也照样做。像照片里那样对齐四角，这样之后两组网格才能正好叠在一起。",
    photos: ["撕下覆膜的背纸", "把顶层 FPC 压到覆膜上", "贴好覆膜的顶层 FPC，举到镜头前", "贴好覆膜的底层 FPC，四角已对齐"],
    clip: "把顶层 FPC 贴上覆膜 · 实时速度",
    checks: {
      top: "顶层 FPC 平整地压在覆膜上，没有气泡",
      bot: "底层 FPC 平整地压在覆膜上",
      corner: "四角对齐，和指南里的照片一样",
    },
  },
  step2: {
    title: "2 · 把 Velostat 夹在中间",
    text: "把 Velostat 放在一个电极区的正中，再把另一块 FPC 翻过来盖上，让两组线互相垂直交叉。放正之后，这个三明治结构就已经是一个能用的传感器了。",
    photos: ["把黑色的 Velostat 方片放到贴好覆膜的电极上", "合上的三明治：Velostat 夹在两块 FPC 之间"],
    clip: "放入 Velostat，合上三明治 · 实时速度",
    checks: {
      cover: "Velostat 盖住整个电极区",
      cross: "上下两组线互相垂直交叉",
      nofold: "Velostat 没有褶皱或折痕",
    },
  },
  step3: {
    title: "3 · 用聚酰亚胺胶带封边",
    text: "把一条聚酰亚胺胶带粘面朝上放好、剪齐，把三明治放在上面，再包住四边。封边能防止各层滑动，让传感垫经得起真实的实验。",
    photos: ["一条聚酰亚胺胶带，粘面朝上放好并剪齐", "把传感器放到胶带上", "把胶带包过一条边", "包住对面的边", "把封边压紧", "封好的传感垫放在切割垫上"],
    clip: "包边 · 4 倍速",
    checks: {
      strip: "胶带剪到合适的长度",
      wrap: "四边都已包好并压紧",
      tails: "两条尾线上的金手指保持裸露",
    },
  },
  step4: {
    title: "4 · 连接到读取板",
    text: "把每条尾线的金手指插进它的连接器（转接板），再用排线连到读取板：顶层 FPC 的窄排线接 FPC1，底层 FPC 的宽排线接 FPC2。",
    photos: ["封好的传感垫、读取板、两条 FFC 排线和连接器摆在一起", "把金手指插进连接器", "装上排线", "整条链路：传感垫、排线和插着 Nano 的读取板"],
    clip: "把连接器装到金手指上 · 3 倍速",
    checks: {
      fingers: "两条尾线都完全插入，触点对着连接器的触点",
      fpc1: `顶层 FPC（${ROWS} 条线）→ 16 针排线 → FPC1`,
      fpc2: `底层 FPC（${COLS} 条线）→ 32 针排线 → FPC2`,
      latch: "两端连接器的卡扣都已扣紧",
    },
  },
  light: {
    tab: "测试",
    title: "第一次点亮",
    text: "用 USB 线把 Nano 接到电脑上，再打开热力图。按一按传感垫：应该有一个亮点跟着你的手指走。新的 Nano 出厂时是空的：先把扫描固件烧录进去（下一张卡片 <b>烧录</b>）。画面是黑的或不对？请看 <b>排错</b>。",
    photos: ["一整套组装好的系统的标注照片，以及传感区为 24 × 64 mm 的传感垫"],
    clip: "实时热力图跟着按压走 · 实时速度",
    checks: {
      usb: "Nano 已用 USB 接好，固件已烧录（烧录）",
      heat: "flexitac-heatmap：亮点跟着你的手指走",
    },
  },
  flash: {
    tab: "烧录",
    title: "烧录固件",
    text: `把扫描程序复制到 Nano 上，只需一次，拔掉以后它也不会丢。<code>flexitac-flash</code> 会填好四项设置（${ROWS} 行、${COLS} 列、mux 偏移 ${MUX_OFFSET}、${BAUD_TXT} baud），再编译、上传。也可以用 Arduino IDE：打开 <code>template.ino</code>，选 <b>Tools → Board → Arduino Nano</b>，再点 <b>Upload</b>；如果无法同步，选 <b>Processor → ATmega328P (Old Bootloader)</b>。`,
    term: "终端 · PyFlexiTac 和 arduino-cli",
    checks: {
      tools: "PyFlexiTac 和 arduino-cli 已安装（只需一次）",
      upload: "flexitac-flash（或 IDE 的 Upload）运行完毕，没有报错",
      stream: `flexitac-stream：fps 接近 ${FRAME_HZ}，按压时 raw_max 跳高`,
    },
  },
  fix: {
    tab: "排错",
    title: "画面不对时",
    text: "选出你看到的症状。每个症状都会显示终端或查看器里会出现什么、原因是什么，以及怎么修。这些画面是算出来的：让固件去读一块按该症状接线的传感垫，再交给真正的查看器代码处理。",
  },
};

const pick = (zh: string | undefined, en: string): string => (zh && zh.trim() ? zh : en);

/** A build step in the current language (the English step itself in English). */
export function locBuild(s: BuildStep): BuildStep {
  const z = lang() === "zh" ? BUILD_ZH[s.id] : undefined;
  if (!z) return s;
  return {
    ...s,
    tab: pick(z.tab, s.tab),
    title: pick(z.title, s.title),
    text: pick(z.text, s.text),
    photos: s.photos.map((p, i) => ({ ...p, alt: pick(z.photos?.[i], p.alt) })),
    clip: s.clip && { ...s.clip, caption: pick(z.clip, s.clip.caption) },
    term: s.term && { ...s.term, caption: pick(z.term, s.term.caption) },
    checks: s.checks.map((c) => ({ ...c, text: pick(z.checks?.[c.id], c.text) })),
  };
}
