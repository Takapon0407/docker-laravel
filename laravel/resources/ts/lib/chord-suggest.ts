// コード進行を 1 つずつ組み立てるときの「次のコード」の候補（DOM に依存しない。node --test でテストする）
//
// 考え方：
// - コードは、メジャーキーの主音から何半音上か（offset）と、和音の種類（kind）で表す。
//   マイナーキーは平行調のメジャーキーで扱う（A マイナーの Am は、C メジャーの vi）
// - 1 つ目のコードだけでは、どのキーの何番目のコードかが決まらない（Am は C の vi か、G の ii か、F の iii か）。
//   そのため、考えられるキー（仮説）をいくつか持っておき、選ばれたコードに合わないものを捨てていく
// - 次のコードは、仮説ごとの「よく行く先」の表（TRANSITIONS）を重みで足し合わせて、上から並べる
// - 最後のコードは、先頭のコードに戻りやすいものを上にする（ループしたときに自然に聞こえるように）

export type Kind = "maj" | "min" | "dim" | "dom";
export type Style = "triad" | "seventh" | "ninth";

export interface Picked {
    root: number;
    kind: Kind;
}

type Id = "I" | "ii" | "iii" | "IV" | "V" | "vi" | "vii" | "III7" | "II7" | "VI7" | "I7" | "iv" | "bVII" | "bVI";

interface Degree {
    offset: number;
    // この役割として受け付ける和音の種類（先頭が候補として出すときの種類）
    kinds: readonly Kind[];
    // 書き方ごとのコードの種類の表記
    names: Readonly<Record<Style, string>>;
}

const DEGREES: Readonly<Record<Id, Degree>> = {
    I: { offset: 0, kinds: ["maj"], names: { triad: "", seventh: "maj7", ninth: "maj9" } },
    ii: { offset: 2, kinds: ["min"], names: { triad: "m", seventh: "m7", ninth: "m9" } },
    iii: { offset: 4, kinds: ["min"], names: { triad: "m", seventh: "m7", ninth: "m7" } },
    IV: { offset: 5, kinds: ["maj"], names: { triad: "", seventh: "maj7", ninth: "maj9" } },
    V: { offset: 7, kinds: ["maj", "dom"], names: { triad: "", seventh: "7", ninth: "13" } },
    vi: { offset: 9, kinds: ["min"], names: { triad: "m", seventh: "m7", ninth: "m9" } },
    vii: { offset: 11, kinds: ["dim"], names: { triad: "dim", seventh: "m7b5", ninth: "m7b5" } },
    // ほかのキーから借りてくる・次のコードへ強く引っぱるコード
    III7: { offset: 4, kinds: ["dom", "maj"], names: { triad: "7", seventh: "7", ninth: "7b9" } },
    II7: { offset: 2, kinds: ["dom", "maj"], names: { triad: "7", seventh: "7", ninth: "9" } },
    VI7: { offset: 9, kinds: ["dom", "maj"], names: { triad: "7", seventh: "7", ninth: "7b9" } },
    I7: { offset: 0, kinds: ["dom"], names: { triad: "7", seventh: "7", ninth: "9" } },
    iv: { offset: 5, kinds: ["min"], names: { triad: "m", seventh: "m7", ninth: "m6" } },
    bVII: { offset: 10, kinds: ["maj", "dom"], names: { triad: "", seventh: "7", ninth: "9" } },
    bVI: { offset: 8, kinds: ["maj"], names: { triad: "", seventh: "maj7", ninth: "maj7" } },
};

type Transition = readonly [to: Id, weight: number, note: string];

// よく行く先（重みは 1〜7。ポップス・lofi・ジャズでよく使われる流れを大きくする）
const TRANSITIONS: Readonly<Record<Id, readonly Transition[]>> = {
    I: [
        ["IV", 5, "明るく広がる"],
        ["V", 4, "前に進む"],
        ["vi", 4, "少し切なく"],
        ["ii", 3, "おだやかに進む"],
        ["iii", 2, "カノン進行の流れ"],
        ["I7", 1, "IV へ向かう"],
        ["bVII", 1, "ロックっぽく"],
    ],
    ii: [
        ["V", 6, "ii-V で解決へ向かう"],
        ["iii", 2, "ゆっくり上る"],
        ["IV", 2, "やわらかく進む"],
        ["vi", 1, "暗めに戻る"],
    ],
    iii: [
        ["vi", 6, "王道進行の流れ（切なく落ちる）"],
        ["IV", 4, "カノン進行の流れ"],
        ["ii", 2, "おだやかに下る"],
        ["VI7", 1, "ジャズっぽく"],
    ],
    IV: [
        ["V", 6, "王道進行の流れ（盛り上がる）"],
        ["I", 4, "やさしく戻る"],
        ["iii", 3, "おしゃれに下る"],
        ["iv", 3, "切なく（サブドミナントマイナー）"],
        ["III7", 2, "丸サ進行の流れ"],
        ["ii", 2, "落ち着いて進む"],
        ["vi", 2, "切なく"],
    ],
    V: [
        ["I", 6, "解決する"],
        ["vi", 5, "期待をはずして切なく（偽終止）"],
        ["IV", 2, "ロックっぽく戻る"],
        ["iii", 1, "やわらかく"],
    ],
    vi: [
        ["IV", 5, "切ない定番（小室進行の流れ）"],
        ["ii", 4, "落ち着く"],
        ["V", 3, "明るく進む"],
        ["III7", 4, "緊張して、戻りたくなる"],
        ["iii", 3, "暗めに続く"],
        ["I", 2, "明るく戻る"],
        ["bVI", 1, "ドラマチックに"],
    ],
    vii: [
        ["III7", 5, "マイナーの ii-V"],
        ["I", 3, "解決する"],
        ["iii", 2, "やわらかく"],
    ],
    III7: [
        ["vi", 7, "切なく解決する"],
        ["IV", 2, "意外に明るく"],
        ["iii", 1, "ジャズっぽく"],
    ],
    II7: [
        ["V", 6, "V へ向かう"],
        ["ii", 2, "やわらかく"],
    ],
    VI7: [
        ["ii", 6, "ii へ向かう（循環の流れ）"],
        ["II7", 2, "ジャズっぽく続ける"],
    ],
    I7: [
        ["IV", 6, "IV へ解決する"],
        ["iv", 2, "切なく"],
    ],
    iv: [
        ["I", 5, "切なく戻る"],
        ["V", 3, "盛り上がる"],
        ["bVII", 2, "ロックっぽく"],
    ],
    bVII: [
        ["I", 5, "ロックっぽく戻る"],
        ["IV", 2, "広がる"],
        ["V", 1, "盛り上がる"],
    ],
    bVI: [
        ["bVII", 4, "ドラマチックに上る"],
        ["V", 3, "盛り上がる"],
        ["I", 2, "明るく戻る"],
    ],
};

const MAX_WEIGHT = 7;

interface Hypothesis {
    // メジャーキーの主音（C = 0）
    tonic: number;
    weight: number;
    // 選んだコードそれぞれの役割（合う役割がなかったコードは null）
    ids: (Id | null)[];
}

const mod12 = (value: number): number => ((value % 12) + 12) % 12;

function weightOf(from: Id, to: Id): number {
    return TRANSITIONS[from].find(([id]) => id === to)?.[1] ?? 0;
}

function matchingIds(tonic: number, chord: Picked): Id[] {
    return (Object.keys(DEGREES) as Id[]).filter((id) => {
        const degree = DEGREES[id];
        return mod12(tonic + degree.offset) === mod12(chord.root) && degree.kinds.includes(chord.kind);
    });
}

// 1 つ目のコードから考えられるキー（Am なら C の vi・G の ii・F の iii。確からしさの順に重みを付ける）
function startHypotheses(start: Picked): Hypothesis[] {
    const candidates: [Id, number][] =
        start.kind === "min"
            ? [
                  ["vi", 1],
                  ["ii", 0.6],
                  ["iii", 0.4],
              ]
            : start.kind === "dim"
              ? [["vii", 1]]
              : start.kind === "dom"
                ? [
                      ["V", 1],
                      ["I7", 0.3],
                  ]
                : [
                      ["I", 1],
                      ["IV", 0.6],
                      ["V", 0.4],
                  ];
    return candidates.map(([id, weight]) => ({ tonic: mod12(start.root - DEGREES[id].offset), weight, ids: [id] }));
}

function lastId(hypothesis: Hypothesis): Id | null {
    for (let i = hypothesis.ids.length - 1; i >= 0; i--) {
        const id = hypothesis.ids[i];
        if (id !== null && id !== undefined) {
            return id;
        }
    }
    return null;
}

// 選んだコードを順にたどり、合わないキーを捨てていく
export function analyze(chords: readonly Picked[]): Hypothesis[] {
    const [start, ...rest] = chords;
    if (start === undefined) {
        return [];
    }
    let hypotheses = startHypotheses(start);
    for (const chord of rest) {
        const next: Hypothesis[] = [];
        for (const hypothesis of hypotheses) {
            const from = lastId(hypothesis);
            let best: Id | null = null;
            let bestWeight = 0;
            for (const id of matchingIds(hypothesis.tonic, chord)) {
                const weight = from === null ? 0 : weightOf(from, id);
                if (weight > bestWeight) {
                    best = id;
                    bestWeight = weight;
                }
            }
            if (best !== null) {
                next.push({ tonic: hypothesis.tonic, weight: hypothesis.weight * (bestWeight / MAX_WEIGHT), ids: [...hypothesis.ids, best] });
            }
        }
        if (next.length > 0) {
            hypotheses = next;
            continue;
        }
        // 表にない流れ（選び直しで前後が変わったときなど）は、役割が合うキーを残し、それもなければ役割なしで続ける
        hypotheses = hypotheses.map((hypothesis) => {
            const id = matchingIds(hypothesis.tonic, chord)[0] ?? null;
            return { tonic: hypothesis.tonic, weight: hypothesis.weight * (id === null ? 0.05 : 0.2), ids: [...hypothesis.ids, id] };
        });
    }
    const total = hypotheses.reduce((sum, hypothesis) => sum + hypothesis.weight, 0);
    return hypotheses.map((hypothesis) => ({ ...hypothesis, weight: total > 0 ? hypothesis.weight / total : 1 / hypotheses.length }));
}

// 主音がシャープのキー（G・D・A・E・B）では ♯ で、それ以外は ♭ で書く
const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const SHARP_TONICS = new Set([7, 2, 9, 4, 11]);

export function spell(root: number, tonic: number): string {
    return (SHARP_TONICS.has(mod12(tonic)) ? SHARP_NAMES : FLAT_NAMES)[mod12(root)]!;
}

// 役割がわからないコードの書き方
const PLAIN_SUFFIX: Readonly<Record<Kind, string>> = { maj: "", min: "m", dim: "dim", dom: "7" };

function nameOf(chord: Picked, tonic: number, id: Id | null, style: Style): string {
    return spell(chord.root, tonic) + (id === null ? PLAIN_SUFFIX[chord.kind] : DEGREES[id].names[style]);
}

function bestOf(hypotheses: readonly Hypothesis[]): Hypothesis | undefined {
    return hypotheses.reduce<Hypothesis | undefined>((best, hypothesis) => (best === undefined || hypothesis.weight > best.weight ? hypothesis : best), undefined);
}

// 選んだコードの名前（いちばん確からしいキーで書く）
export function namesOf(chords: readonly Picked[], style: Style): string[] {
    const best = bestOf(analyze(chords));
    if (best === undefined) {
        return [];
    }
    return chords.map((chord, i) => nameOf(chord, best.tonic, best.ids[i] ?? null, style));
}

export interface Suggestion {
    chord: Picked;
    name: string;
    note: string;
    // ループしたとき、先頭のコードに戻りやすい
    closesLoop: boolean;
    score: number;
}

const MAX_SUGGESTIONS = 6;

// slot 番目（1 から）に入れるコードの候補。前のコードまでで考え、slot が最後なら先頭に戻りやすいものを上にする
export function suggest(chords: readonly Picked[], slot: number, length: number, style: Style): Suggestion[] {
    const hypotheses = analyze(chords.slice(0, slot));
    const isLast = slot === length - 1;
    const merged = new Map<string, Suggestion & { best: number }>();

    for (const hypothesis of hypotheses) {
        const from = lastId(hypothesis) ?? hypothesis.ids[0] ?? null;
        const startId = hypothesis.ids[0] ?? null;
        if (from === null) {
            continue;
        }
        for (const [to, weight, note] of TRANSITIONS[from]) {
            const degree = DEGREES[to];
            const chord: Picked = { root: mod12(hypothesis.tonic + degree.offset), kind: degree.kinds[0]! };
            const back = isLast && startId !== null ? weightOf(to, startId) : 0;
            // 最後のコードは、先頭へ戻る流れの重みを掛ける（戻れないものは半分にする）
            const contribution = hypothesis.weight * weight * (isLast ? 0.5 + back / MAX_WEIGHT : 1);
            const key = `${chord.root}:${chord.kind}`;
            const existing = merged.get(key);
            if (existing === undefined) {
                merged.set(key, {
                    chord,
                    name: nameOf(chord, hypothesis.tonic, to, style),
                    note,
                    closesLoop: back >= 4,
                    score: contribution,
                    best: contribution,
                });
            } else {
                existing.score += contribution;
                existing.closesLoop ||= back >= 4;
                // 名前と説明は、いちばん効いているキーのものにする
                if (contribution > existing.best) {
                    existing.best = contribution;
                    existing.name = nameOf(chord, hypothesis.tonic, to, style);
                    existing.note = note;
                }
            }
        }
    }

    // 前と同じコードは候補にしない
    const previous = chords[slot - 1];
    return [...merged.values()]
        .filter((suggestion) => previous === undefined || suggestion.chord.root !== previous.root || suggestion.chord.kind !== previous.kind)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_SUGGESTIONS)
        .map(({ best: _best, ...suggestion }) => suggestion);
}
