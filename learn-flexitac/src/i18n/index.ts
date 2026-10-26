// The site's two languages (English, the default, and Simplified Chinese). docs/i18n.md is the contract; the words
// follow docs/i18n-terms-zh.md.
export { HTML_LANG, LANGS, initLang, isZh, lang, onLang, setLang, toggleLang, type Lang } from "./lang";
export { EN, ZH, fill, strings, t, tx, type StrKey, type Vars } from "./strings";
export { loc, locSection, locSpec, locTerm, lessonZh, type LessonZh, type SectionZh, type ZhList } from "./localize";
