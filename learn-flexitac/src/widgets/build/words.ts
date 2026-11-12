// The words of Lesson 2.2's build engine (src/widgets/build/), English and Chinese side by side, so the engine can hand
// the interface both and stay free of the site's language state (it runs in node for its tests). Terms follow
// docs/i18n-terms-zh.md and lesson 2.1's Chinese: strip 小排, power rail 电源轨, pin 引脚, resistor 电阻, sketch 程序,
// upload 上传, Serial Monitor 串口监视器, baud 波特率, short circuit 短路, floating 悬空. Code, pin names and numbers
// stay as they are. {name} slots are filled by say() (numbers come from the engine's models, never typed here).
// Plain sentences, one idea each, no bold labels (lesson 2.1's review, 2026-11-09); a line is what the learner sees and
// why, a hint is what to do.

export type Lang = "en" | "zh";
/** One text in both languages. The interface shows `tx(t.en, t.zh)` or `t[lang()]`, on every paint. */
export interface Text {
  en: string;
  zh: string;
}
export type Vars = Record<string, string | number>;

// Shaped like the site's strings(en, zh), so scripts/i18n-check.mjs reads the tables the same way (every English key
// needs its Chinese one; TypeScript checks it too), but it keeps both languages instead of picking one.
function strings<K extends string>(en: Record<K, string>, zh: Record<K, string>): Record<Lang, Record<K, string>> {
  return { en, zh };
}

export const WORDS = strings(
  {
    // ---- what is connected to what (connections())
    itemFsr: "FSR pin {n}",
    itemFsrBoth: "FSR (both pins)",
    itemRes: "resistor",
    itemResBoth: "resistor (both legs)",

    // ---- why a part or a wire can't go there (check*())
    offBoard: "That would put a pin off the board.",
    rail: "Parts go in the middle of the board. The rails along the edges are for wires.",
    groove: "A leg would land in the middle groove, where there are no holes.",
    nanoGroove: "The Nano's two rows of pins are too far apart for one strip, so it fits only across the middle groove, one row on each side.",
    nanoPairs: "There every pin gets a strip of its own, with free holes beside it for wires.",
    taken: "Hole {hole} is already in use.",
    underNano: "Hole {hole} is under the Nano.",
    covers: "The Nano would cover hole {hole}, which is in use.",
    sameHole: "A wire needs two different holes.",
    noWire: "That wire is no longer on the board.",

    // ---- the compiler's own lines (the Arduino IDE prints them in English in both languages)
    ideUndeclared: "error: '{name}' was not declared in this scope",
    ideRedeclared: "error: redeclaration of 'int value'",
    ideExpected: "error: expected primary-expression before ')' token",
    ideExpectedComma: "error: expected primary-expression before ',' token",
    ideNoBegin: "error: no matching function for call to 'HardwareSerial::begin()'",
    ideTooFew: "error: too few arguments to function '{sig}'",

    // ---- compile errors, in plain words
    cUndeclared: "It doesn't compile. {fn} prints value before reading it.",
    cUndeclaredHint: "Put the read line above the print line, in the same function.",
    cElsewhere: "It doesn't compile. value is read in {from} but printed in {fn}, and each function only sees its own variables.",
    cElsewhereHint: "Move the read line into {fn}, above the print line.",
    cRedeclared: "It doesn't compile. Two lines in {fn} both make a variable called value.",
    cRedeclaredHint: "Keep only one read line in {fn}.",
    cPin: "It doesn't compile. The Nano has no pin called {pin}.",
    cPinHintAnalog: "Analog pins are written A0 to A7, with a capital A.",
    cPinHintDigital: "Write a pin as A0 to A7, or as a number from 0 to 13.",
    cEmpty: "It doesn't compile. {code} has an empty box.",
    cEmptyHint: "Fill in the box, for example {example}.",
    cNumber: "It doesn't compile. {code} needs a whole number.",
    cNumberHint: "Type a number such as {example}.",

    // ---- what happens, and what to do (verdict symptoms)
    works: "It works. Press harder and the number climbs, up to about {top}.",
    worksHint: "Watch the plotter: press and let go to draw a hill.",
    noNano: "There is no Arduino on the board yet.",
    noNanoHint: "Drag the Nano onto the board, across the middle groove.",
    noUsb: "The upload fails: no board found. The USB cable is not plugged in.",
    noUsbHint: "Plug the USB cable into the Nano, then upload again.",
    short: "{a} is joined straight to {b}. That is a short circuit, so the power cuts out and the board shuts off.",
    shortHint: "Unplug USB, then find what joins {a} to {b}.",
    resetHeld: "RST is joined to GND, so the Nano stays in reset and never starts. The upload fails.",
    resetHeldHint: "Take the wire off RST.",
    noBegin: "The Serial Monitor stays empty. The sketch never opens the USB link with Serial.begin.",
    noBeginHint: "Put Serial.begin(9600) in setup().",
    noPrint: "The Serial Monitor stays empty. Nothing in the sketch sends a number.",
    noPrintHint: "In loop(), read the sensor, then send the value with Serial.println(value).",
    runsOnce: "One number, then nothing. The read and the print are in setup(), which runs only once.",
    runsOnceHint: "Move the read and print lines into loop().",
    wrongBaud: "The monitor shows gibberish. The sketch talks at {sketch} baud, but the monitor listens at {monitor}.",
    wrongBaudHint: "Set the monitor to {sketch} baud, or change Serial.begin to {monitor}.",
    noNewline: "The numbers run together on one line. Serial.print sends no line break.",
    noNewlineHint: "Use Serial.println(value), which starts a new line each time.",
    doubled: "Each line shows the reading twice, run together. Serial.print and Serial.println both send it.",
    doubledHint: "Take out Serial.print(value). Serial.println(value) alone sends the number and ends the line.",
    digitalRead: "Only 0 or 1 comes back. digitalRead only asks whether {pin} is high or low.",
    digitalReadHint: "Use analogRead, which gives a number from 0 to {max}.",
    pinOutput: "pinMode({pin}, OUTPUT) makes {pin} drive itself to 0 V. It fights the sensor, so the reading hardly moves.",
    pinOutputHint: "Remove pinMode. Analog pins are inputs from the start.",
    pinOutputShort: "pinMode({pin}, OUTPUT) drives {pin} to 0 V while it is wired to {src}. A large current flows that can damage the pin.",
    pinOutputShortHint: "Remove pinMode, and the wire from {pin} to {src}.",
    wrongPin: "The sensor is on {on}, but the sketch reads {pin}. Pressing changes {on}, not {pin}.",
    wrongPinHint: "Change the pin in {fn} to {on}, or move the wire to {pin}.",
    wrongPinDigital: "The sensor is on {on}, a digital pin, but the sketch reads {pin}. Only A0 to A7 can measure a voltage.",
    wrongPinDigitalHint: "Move the wire from {on} to {pin}.",
    noFsr: "There is no sensor on the board yet.",
    noFsrHint: "Push the sensor's two legs into two different strips.",
    fsrBypassed: "Both legs of the sensor sit in one strip, which joins them. The sensor is bypassed, so pressing it changes nothing.",
    fsrBypassedCode: "Both legs of the sensor sit in one strip, which joins them. The sensor is bypassed, so {pin} reads {code} all the time.",
    fsrBypassedHint: "Turn the sensor so its legs go into two different strips.",
    fsrJoined: "The sensor's two legs are joined by a wire, so it is bypassed and pressing it changes nothing.",
    fsrJoinedHint: "Take off the wire that joins the sensor's two strips.",
    fsrUnconnected: "The sensor's legs share their strips with nothing else, so it isn't part of the circuit.",
    fsrUnconnectedHint: "Wire one leg's strip to 5V and the other leg's strip to {pin}.",
    fsrOneLeg: "One leg of the sensor connects to nothing, so no current can flow through it.",
    fsrOneLegHint5v: "Wire that leg's strip to 5V.",
    fsrOneLegHintPin: "Wire that leg's strip to {pin}.",
    fsrAcross: "The sensor sits straight between {a} and {b}, and no pin listens in the middle.",
    fsrAcrossHint: "Move the leg on {b} to a strip of its own, wired to {pin} and the resistor.",
    fsrNoSupply: "The sensor doesn't reach 5V, so no current flows through it when you press.",
    fsrNoSupplyHint: "Wire the sensor's other leg to 5V.",
    stuck: "{pin} is joined straight to {src}, so it reads {code} all the time.",
    stuckHintHigh: "{pin} should reach {src} only through the sensor.",
    stuckHintLow: "{pin} should reach GND only through the {r} resistor.",
    noResistor: "With no resistor, {pin} is joined to nothing until you press, so the numbers wander at random.",
    noResistorHint: "Add the {r} resistor from {pin}'s strip to GND.",
    floating: "Until you press, {pin} is joined to nothing, so it floats and the numbers wander. The resistor doesn't link {pin} to GND.",
    floatingHint: "Put one leg of the resistor in {pin}'s strip, and wire the other leg's strip to GND.",
    resistorBypassed: "Both legs of the resistor sit in one strip, so it does nothing. {pin} floats and the numbers wander.",
    resistorBypassedHint: "Put the resistor's legs in two strips: one with {pin}, one wired to GND.",
    pinUnwired: "Nothing is wired to {pin}, so it floats and the numbers wander at random.",
    pinUnwiredHint: "Wire {pin} to the strip where the sensor and the resistor meet.",
    bothGnd: "The sensor and the resistor both lead to GND, so {pin} stays at {code}. The sensor's other leg must go to 5V.",
    bothGndHint: "Move the sensor's wire from GND to 5V.",
    both5v: "The sensor and the resistor both lead to {src}, so {pin} stays at {code}. The resistor must go to GND.",
    both5vHint: "Move the resistor's wire from {src} to GND.",
    noChange: "{pin} reads {code} whether or not you press.",
    noChangeHint: "Check the wiring: 5V to the sensor, {pin} to the sensor and the resistor, and the resistor to GND.",

    // ---- it works, with a remark
    pullUp: "It works, but backwards. The number falls when you press, because the sensor and the resistor swapped places.",
    pullUpHint: "That's fine. To make it climb, put the sensor on 5V and the resistor on GND.",
    on3v3: "It works, but the sensor gets 3.3 V from 3V3, so the number can't pass {top}.",
    on3v3Hint: "Move the sensor's wire from 3V3 to 5V to use the whole range up to {max}.",
    restHigh: "It works, but it rests at {code} instead of 0.",
    restHighHint: "Wire the resistor's other leg to GND.",
    fast: "It works, but with no pause the numbers rush past too fast to read.",
    fastHint: "Add delay(100) at the end of loop().",
    slow: "It waits {s} s between readings, so it is slow to answer a press.",
    slowHint: "Try delay(100): about 10 readings a second.",
    beginInLoop: "It works, but Serial.begin is in loop(), so it opens the link again on every pass.",
    beginInLoopHint: "Move Serial.begin into setup(). It only needs to run once.",
  },
  {
    itemFsr: "FSR 引脚 {n}",
    itemFsrBoth: "FSR（两个引脚）",
    itemRes: "电阻",
    itemResBoth: "电阻（两条腿）",

    offBoard: "这样会有引脚落到面包板外面。",
    rail: "零件插在面包板中间。边上的电源轨留给跳线。",
    groove: "有一条腿会落进中间的槽里，那里没有孔。",
    nanoGroove: "Nano 的两排引脚离得太远，进不了同一小排，只能跨在中间的槽上，一边一排。",
    nanoPairs: "这样每个引脚都有自己的一小排，旁边还有空孔可以插跳线。",
    taken: "{hole} 这个孔已经插了东西。",
    underNano: "{hole} 这个孔被 Nano 挡住了。",
    covers: "Nano 会盖住 {hole}，那个孔已经插了东西。",
    sameHole: "跳线的两头要插进两个不同的孔。",
    noWire: "这根跳线已经不在面包板上了。",

    ideUndeclared: "error: '{name}' was not declared in this scope",
    ideRedeclared: "error: redeclaration of 'int value'",
    ideExpected: "error: expected primary-expression before ')' token",
    ideExpectedComma: "error: expected primary-expression before ',' token",
    ideNoBegin: "error: no matching function for call to 'HardwareSerial::begin()'",
    ideTooFew: "error: too few arguments to function '{sig}'",

    cUndeclared: "编译失败。{fn} 还没读取 value，就要打印它。",
    cUndeclaredHint: "把读取那一行放到打印那一行上面，而且要在同一个函数里。",
    cElsewhere: "编译失败。value 在 {from} 里读取，却在 {fn} 里打印，而每个函数只认得自己的变量。",
    cElsewhereHint: "把读取那一行移到 {fn} 里，放在打印那一行上面。",
    cRedeclared: "编译失败。{fn} 里有两行都在新建叫 value 的变量。",
    cRedeclaredHint: "{fn} 里只留一行读取。",
    cPin: "编译失败。Nano 上没有叫 {pin} 的引脚。",
    cPinHintAnalog: "模拟引脚写作 A0 到 A7，A 要大写。",
    cPinHintDigital: "引脚写成 A0 到 A7，或者 0 到 13 的数字。",
    cEmpty: "编译失败。{code} 里有一个空没填。",
    cEmptyHint: "把空填上，比如 {example}。",
    cNumber: "编译失败。{code} 里要填一个整数。",
    cNumberHint: "填一个数，比如 {example}。",

    works: "成功了。按得越重，数字越大，最高到 {top} 左右。",
    worksHint: "看串口绘图器：按一下再松开，就画出一座小山。",
    noNano: "面包板上还没有 Arduino。",
    noNanoHint: "把 Nano 拖到面包板上，跨在中间的槽上。",
    noUsb: "上传失败：找不到开发板，因为 USB 线没插上。",
    noUsbHint: "把 USB 线插到 Nano 上，再上传一次。",
    short: "{a} 直接连到了 {b}，这就是短路。电源被切断，板子也就断电了。",
    shortHint: "先拔掉 USB，再找出是什么把 {a} 和 {b} 连在了一起。",
    resetHeld: "RST 接到了 GND，Nano 一直处在复位状态，程序跑不起来，上传也会失败。",
    resetHeldHint: "把接在 RST 上的线拿掉。",
    noBegin: "串口监视器一片空白。程序没有用 Serial.begin 打开 USB 连接。",
    noBeginHint: "在 setup() 里放上 Serial.begin(9600)。",
    noPrint: "串口监视器一片空白。程序里没有哪一行把数字发出来。",
    noPrintHint: "在 loop() 里先读传感器，再用 Serial.println(value) 把数发出来。",
    runsOnce: "只出来一个数，之后就没了。读取和打印都在 setup() 里，而它只运行一次。",
    runsOnceHint: "把读取和打印两行移到 loop() 里。",
    wrongBaud: "串口监视器里全是乱码。程序用 {sketch} 波特率发送，监视器却用 {monitor} 接收。",
    wrongBaudHint: "把监视器调到 {sketch}，或者把 Serial.begin 里的数改成 {monitor}。",
    noNewline: "数字挤成了一长串。Serial.print 发完不换行。",
    noNewlineHint: "改用 Serial.println(value)，它每次都另起一行。",
    doubled: "每一行都把读数连着写了两遍。Serial.print 和 Serial.println 都把它发了出去。",
    doubledHint: "拿掉 Serial.print(value)。只留 Serial.println(value)，它发完数字就换行。",
    digitalRead: "只会读到 0 或 1。digitalRead 只看 {pin} 是高还是低。",
    digitalReadHint: "改用 analogRead，它给出 0 到 {max} 之间的数。",
    pinOutput: "pinMode({pin}, OUTPUT) 让 {pin} 自己输出 0 V。它和传感器对着干，读数几乎不动。",
    pinOutputHint: "删掉 pinMode。模拟引脚一开始就是输入。",
    pinOutputShort: "pinMode({pin}, OUTPUT) 让 {pin} 输出 0 V，可它又被线连到了 {src}。这会流过很大的电流，可能烧坏这个引脚。",
    pinOutputShortHint: "删掉 pinMode，再拿掉 {pin} 到 {src} 的那根线。",
    wrongPin: "传感器接在 {on} 上，程序读的却是 {pin}。按下去，变的是 {on}，不是 {pin}。",
    wrongPinHint: "把 {fn} 里的引脚改成 {on}，或者把线改接到 {pin}。",
    wrongPinDigital: "传感器接在数字引脚 {on} 上，程序读的却是 {pin}。只有 A0 到 A7 能测电压。",
    wrongPinDigitalHint: "把线从 {on} 改接到 {pin}。",
    noFsr: "面包板上还没有传感器。",
    noFsrHint: "把传感器的两只脚插进两个不同的小排。",
    fsrBypassed: "传感器的两只脚插在同一小排里，被这一排直接连通了。传感器被短接，怎么按都没用。",
    fsrBypassedCode: "传感器的两只脚插在同一小排里，被这一排直接连通了。传感器被短接，{pin} 一直读到 {code}。",
    fsrBypassedHint: "把传感器转个方向，让两只脚插进两个不同的小排。",
    fsrJoined: "传感器的两只脚被线连在了一起，传感器被短接，怎么按都没用。",
    fsrJoinedHint: "拿掉把传感器两排连在一起的那根线。",
    fsrUnconnected: "传感器两只脚所在的小排里没有别的东西，它没接进电路。",
    fsrUnconnectedHint: "把一只脚那排接到 5V，另一只脚那排接到 {pin}。",
    fsrOneLeg: "传感器有一只脚什么也没连，电流没法从它里面流过。",
    fsrOneLegHint5v: "用线把那只脚所在的小排接到 5V。",
    fsrOneLegHintPin: "用线把那只脚所在的小排接到 {pin}。",
    fsrAcross: "传感器直接接在 {a} 和 {b} 之间，中间没有引脚在听。",
    fsrAcrossHint: "把接 {b} 的那只脚挪到单独一小排，再把这一排接到 {pin} 和电阻。",
    fsrNoSupply: "传感器没有连到 5V，按下去也没有电流流过。",
    fsrNoSupplyHint: "用线把传感器的另一只脚接到 5V。",
    stuck: "{pin} 直接连到了 {src}，所以一直读到 {code}。",
    stuckHintHigh: "{pin} 只能经过传感器连到 {src}。",
    stuckHintLow: "{pin} 只能经过 {r} 电阻连到 GND。",
    noResistor: "没有电阻，不按的时候 {pin} 什么也没接，读数会乱跳。",
    noResistorHint: "加上 {r} 电阻，从 {pin} 那一小排接到 GND。",
    floating: "不按的时候，{pin} 什么也没接，处于悬空状态，读数乱跳。电阻没有把 {pin} 连到 GND。",
    floatingHint: "电阻一条腿插在 {pin} 那一小排，另一条腿那排用线接到 GND。",
    resistorBypassed: "电阻的两条腿插在同一小排里，等于没接。{pin} 悬空，读数乱跳。",
    resistorBypassedHint: "让电阻的两条腿插进两个小排：一排连着 {pin}，另一排接到 GND。",
    pinUnwired: "{pin} 上什么也没接，处于悬空状态，读数乱跳。",
    pinUnwiredHint: "用线把 {pin} 接到传感器和电阻相接的那一小排。",
    bothGnd: "传感器和电阻都接到了 GND，{pin} 一直是 {code}。传感器的另一只脚要接 5V。",
    bothGndHint: "把传感器那根线从 GND 改接到 5V。",
    both5v: "传感器和电阻都接到了 {src}，{pin} 一直是 {code}。电阻要接到 GND。",
    both5vHint: "把电阻那根线从 {src} 改接到 GND。",
    noChange: "不管按不按，{pin} 都读到 {code}。",
    noChangeHint: "对照接线：5V 接传感器，{pin} 接传感器和电阻，电阻接 GND。",

    pullUp: "能用，只是反过来了。按下去数字变小，因为传感器和电阻换了位置。",
    pullUpHint: "这样也可以。想让数字变大，就让传感器接 5V，电阻接 GND。",
    on3v3: "能用，但传感器接的是 3V3，只有 3.3 V，读数超不过 {top}。",
    on3v3Hint: "把传感器的线从 3V3 改接到 5V，就能用满到 {max}。",
    restHigh: "能用，但不按的时候是 {code}，不是 0。",
    restHighHint: "把电阻的另一条腿接到 GND。",
    fast: "能用，只是没有停顿，数字刷得太快，看不清。",
    fastHint: "在 loop() 的最后加上 delay(100)。",
    slow: "两次读取之间要等 {s} 秒，按下去要等很久才有反应。",
    slowHint: "试试 delay(100)：每秒大约读 10 次。",
    beginInLoop: "能用，但 Serial.begin 放在了 loop() 里，每转一圈都要重新打开一次连接。",
    beginInLoopHint: "把 Serial.begin 移到 setup() 里，它只需要运行一次。",
  },
);

export type WordKey = keyof (typeof WORDS)["en"];

/** {name} -> vars.name (numbers and strings, inserted as they are). */
export function fill(s: string, vars?: Vars): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** One of the words above, in both languages, with its {slots} filled. */
export function say(key: WordKey, vars?: Vars): Text {
  return { en: fill(WORDS.en[key], vars), zh: fill(WORDS.zh[key], vars) };
}

/** Texts joined, per language (`sep` between them; Chinese gets no space after its full stop). */
export function join(parts: readonly Text[], sep: Text = { en: " ", zh: "" }): Text {
  return { en: parts.map((p) => p.en).join(sep.en), zh: parts.map((p) => p.zh).join(sep.zh) };
}

/** The same text in both languages (pin names, numbers, code). */
export const same = (s: string): Text => ({ en: s, zh: s });
