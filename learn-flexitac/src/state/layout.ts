// The lesson page's two layouts, in one place for the scripts (views/lesson.ts, ui/demo.ts). The stylesheets spell the
// same queries out (lesson.css, explore.css: keep them in step).
//
// Desktop ("wide"): the stage and the panel side by side, the lesson fits the window, the figure fills a fixed stage
// ("stage" mode). From 1024 x 640 up, except a tall portrait window up to 1180 px wide (an iPad Pro 12.9 / 13 in
// portrait, 1024 x 1366: side by side its stage was 547 px wide and 1146 tall, the figures small in empty bands), which
// stacks like a smaller tablet: width / height under 0.799 (about 4 : 5). The stacked CSS queries end at the same
// 799/1000 (max-aspect-ratio), so no window falls between the two: with 4/5 here, a 1024 x 1281 window matched neither
// and its figure slot was 0 px tall. (Exactly 0.799 needs a width that is a multiple of 799: none in 1024-1180.)
// Stacked: one column, the window scrolls, the figure takes the stage's width and its own height ("fill").
// The stacked side's queries end at .98 px (1023.98, 1180.98, 639.98): at a browser zoom the window can be a fractional
// width such as 1023.5 px, which fell between 1023 and 1024 and matched neither layout.
export const WIDE_QUERY = "(min-width: 1181px) and (min-height: 640px), (min-width: 1024px) and (min-height: 640px) and (min-aspect-ratio: 799/1000)";

// A short, wide window: a phone on its side (844 x 390, 932 x 430; Safari's bars leave ~340 px), a laptop at 150-200 %
// zoom (1280 x 610, 720 x 450). The layout stacks (under 640 px tall), but a figure as wide as the stage would be
// 570-940 px tall, so the figure and the steps bar under it were never on the screen together. Here the figure fills a
// slot as tall as the window instead ("stage" mode, as on a desktop: the drawing widens its view to the room), so it is
// seen whole, with the steps bar right under it.
export const FLAT_QUERY = "(min-width: 601px) and (max-height: 639.98px)";
