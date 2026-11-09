// 雨音コードプレイヤーの音楽理論の部分（DOM・Web Audio に依存しない。node --test でテストする）
// - コード名を読んで構成音（ルートからの半音の数）にする
// - 鍵盤のどこを押さえるか（ボイシング）を決める
// - 8 分音符ごとに何を鳴らすかを決める

const PITCH_CLASSES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// 移調したあとの名前は、lofi でよく使うフラットのキーに合わせて ♭ で書く
const NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

// コードの種類 → ルートからの半音の数
const QUALITIES: Record<string, readonly number[]> = {
    "": [0, 4, 7],
    m: [0, 3, 7],
    "5": [0, 7],
    "7": [0, 4, 7, 10],
    maj7: [0, 4, 7, 11],
    m7: [0, 3, 7, 10],
    mmaj7: [0, 3, 7, 11],
    "9": [0, 4, 7, 10, 14],
    maj9: [0, 4, 7, 11, 14],
    m9: [0, 3, 7, 10, 14],
    "11": [0, 7, 10, 14, 17],
    m11: [0, 3, 7, 10, 14, 17],
    "13": [0, 4, 7, 10, 14, 21],
    maj13: [0, 4, 7, 11, 14, 21],
    m13: [0, 3, 7, 10, 14, 21],
    "6": [0, 4, 7, 9],
    m6: [0, 3, 7, 9],
    "69": [0, 4, 7, 9, 14],
    m69: [0, 3, 7, 9, 14],
    sus2: [0, 2, 7],
    sus4: [0, 5, 7],
    sus: [0, 5, 7],
    "7sus4": [0, 5, 7, 10],
    "7sus": [0, 5, 7, 10],
    "9sus4": [0, 5, 7, 10, 14],
    add9: [0, 4, 7, 14],
    madd9: [0, 3, 7, 14],
    dim: [0, 3, 6],
    dim7: [0, 3, 6, 9],
    m7b5: [0, 3, 6, 10],
    aug: [0, 4, 8],
    "7b9": [0, 4, 7, 10, 13],
    "7#9": [0, 4, 7, 10, 15],
    "maj7#11": [0, 4, 7, 11, 18],
    "7#5": [0, 4, 8, 10],
};

export interface Chord {
    // 入力された文字（カードとエラーに出す）
    source: string;
    // ルートとベースの音（C = 0 〜 B = 11）
    root: number;
    bass: number;
    // 入力されたルート・ベースの書き方（移調しないときは、F# と Gb の書き分けをそのまま残す）
    rootText: string;
    bassText: string;
    // 入力された種類の書き方（名前を出すときは、表記ゆれをそのまま残す）
    quality: string;
    intervals: readonly number[];
    slash: boolean;
}

// 表記ゆれ（M7・Δ・min7・-7・ø・°・+・括弧など）を QUALITIES のキーにそろえる
export function normalizeQuality(text: string): string {
    let quality = text.replace(/[()]/g, "").replace(/♭/g, "b").replace(/♯/g, "#").replace(/[Δ△]/g, "maj");
    if (quality === "ø" || quality === "ø7") {
        return "m7b5";
    }
    if (quality === "o" || quality === "°") {
        return "dim";
    }
    if (quality === "o7" || quality === "°7") {
        return "dim7";
    }
    if (quality === "+") {
        return "aug";
    }
    if (quality === "M") {
        return "";
    }
    quality = quality
        .replace(/^min/, "m")
        .replace(/^-/, "m")
        .replace(/^m(?:Maj|M)/, "mmaj")
        .replace(/^M(?=\d)/, "maj")
        .replace(/^Maj/, "maj")
        .replace("m7-5", "m7b5");
    return quality === "maj" ? "maj7" : quality;
}

function pitchClass(letter: string, accidental: string): number {
    let pitch = PITCH_CLASSES[letter.toUpperCase()]!;
    if (accidental === "#" || accidental === "♯") {
        pitch += 1;
    } else if (accidental === "b" || accidental === "♭") {
        pitch -= 1;
    }
    return (pitch + 12) % 12;
}

// 1 つのコード（Bbmaj7・C/E など）を読む。読めないときは null
export function parseChord(symbol: string): Chord | null {
    const match = /^([A-Ga-g])([#♯b♭]?)([^/]*)(?:\/([A-Ga-g])([#♯b♭]?))?$/u.exec(symbol);
    if (match === null) {
        return null;
    }
    const [, rootLetter = "", rootAccidental = "", quality = "", bassLetter, bassAccidental = ""] = match;
    const intervals = QUALITIES[normalizeQuality(quality)];
    if (intervals === undefined) {
        return null;
    }
    const root = pitchClass(rootLetter, rootAccidental);
    const text = (letter: string, accidental: string): string => letter.toUpperCase() + accidental.replace("♭", "b").replace("♯", "#");
    return {
        source: symbol,
        root,
        bass: bassLetter === undefined ? root : pitchClass(bassLetter, bassAccidental),
        rootText: text(rootLetter, rootAccidental),
        bassText: bassLetter === undefined ? "" : text(bassLetter, bassAccidental),
        quality,
        intervals,
        slash: bassLetter !== undefined,
    };
}

// 区切りは空白・カンマ・読点・|・→。ハイフンや矢印は単独のときだけ区切りとみなす（m7-5 などを壊さない）
const SEPARATOR_TOKENS = new Set(["-", "–", "—", "->", "=>", ">"]);

export function splitProgression(text: string): string[] {
    return text.split(/[\s,|→、]+/u).filter((token) => token !== "" && !SEPARATOR_TOKENS.has(token));
}

export type ParsedToken = { ok: true; chord: Chord } | { ok: false; source: string };

export function parseProgression(text: string): ParsedToken[] {
    return splitProgression(text).map((token) => {
        const chord = parseChord(token);
        return chord === null ? { ok: false, source: token } : { ok: true, chord };
    });
}

function transposePitch(pitch: number, semitones: number): number {
    return (((pitch + semitones) % 12) + 12) % 12;
}

// 移調したあとのコード名（移調しないときは入力の書き方のまま。移調したら ♭ で書く）
export function chordName(chord: Chord, semitones: number): string {
    if (semitones === 0) {
        return chord.rootText + chord.quality + (chord.slash ? `/${chord.bassText}` : "");
    }
    const root = NOTE_NAMES[transposePitch(chord.root, semitones)]!;
    return root + chord.quality + (chord.slash ? `/${NOTE_NAMES[transposePitch(chord.bass, semitones)]!}` : "");
}

// MIDI の番号 → C4 のような名前（60 = C4）
export function midiName(midi: number): string {
    return `${NOTE_NAMES[midi % 12]!}${Math.floor(midi / 12) - 1}`;
}

export interface Voicing {
    // 上の声部（エレピの右手）。低い順
    upper: number[];
    bass: number;
}

// 上の声部を置く範囲（いちばん低い音の候補）と、ベースの範囲
const UPPER_LOWEST_MIN = 52;
const UPPER_LOWEST_MAX = 64;
const BASS_MIN = 31;
const BASS_MAX = 42;

// 鍵盤のどこを押さえるかを決める
// ルートはベースに任せて上からは抜き、音が 5 つ以上なら 5 度も抜く。
// 置き方は、前のコードから指を動かす量（ボイスリーディング）と、手の広がりが小さくなるものを選ぶ
export function voice(chord: Chord, semitones: number, previous: readonly number[] | null): Voicing {
    const root = transposePitch(chord.root, semitones);
    let intervals = [...chord.intervals];
    if (intervals.length >= 4) {
        intervals = intervals.filter((interval) => interval !== 0);
    }
    if (intervals.length >= 5) {
        intervals = intervals.filter((interval) => interval !== 7);
    }
    const pitches = [...new Set(intervals.map((interval) => (root + interval) % 12))];

    let best: number[] = [];
    let bestScore = Infinity;
    for (let start = UPPER_LOWEST_MIN; start <= UPPER_LOWEST_MAX; start++) {
        const notes = pitches.map((pitch) => start + ((pitch - (start % 12) + 12) % 12)).sort((a, b) => a - b);
        let score = (notes[notes.length - 1]! - notes[0]!) * 0.4;
        if (previous !== null && previous.length > 0) {
            score += notes.reduce((sum, note) => sum + Math.min(...previous.map((p) => Math.abs(p - note))), 0);
        } else {
            // 最初のコードは、真ん中あたり（D4 付近）に置く
            score += Math.abs(notes.reduce((sum, note) => sum + note, 0) / notes.length - 62) * 2;
        }
        if (score < bestScore) {
            bestScore = score;
            best = notes;
        }
    }

    let bass = 36 + transposePitch(chord.bass, semitones);
    if (bass > BASS_MAX) {
        bass -= 12;
    }
    return { upper: best, bass: Math.max(BASS_MIN, bass) };
}

// 進行全体のボイシング（前のコードに続けてつなぐ）
export function voiceProgression(chords: readonly Chord[], semitones: number): Voicing[] {
    const voicings: Voicing[] = [];
    let previous: number[] | null = null;
    for (const chord of chords) {
        const voicing = voice(chord, semitones, previous);
        voicings.push(voicing);
        previous = voicing.upper;
    }
    return voicings;
}

// コピーする形：そのままの進行と、AI 作曲サービスの歌詞欄にヒントとして書く形
export function plainText(chords: readonly Chord[], semitones: number): string {
    return chords.map((chord) => chordName(chord, semitones)).join(" - ");
}

export function lyricsHintText(chords: readonly Chord[], semitones: number): string {
    return `[Chord Progression: ${plainText(chords, semitones)}]`;
}

export type Pattern = "hold" | "comp";

export interface StepPlan {
    // 何番目のコードか（進行の中で）
    chordIndex: number;
    // このコードの始まり（カードを光らせる）
    chordStart: boolean;
    // 鳴らすコード（長さは拍の数）
    chords: { velocity: number; beats: number }[];
    // ベースを鳴らすときは長さ（拍の数）
    bassBeats: number | null;
    kick: boolean;
    brush: boolean;
    // ハットは表拍を強く
    hatStrong: boolean;
    // 裏拍（奇数の 8 分）は 8 分の 1/3 だけ遅らせて、軽くスウィングさせる
    swing: number;
}

// step 番目（0 から数える 8 分音符）に何を鳴らすか。1 小節は 8 分 × 8
export function planStep(step: number, chordCount: number, barsPerChord: number, pattern: Pattern): StepPlan {
    const perChord = 8 * barsPerChord;
    const inChord = step % perChord;
    const inBar = step % 8;
    const plan: StepPlan = {
        chordIndex: chordCount > 0 ? Math.floor(step / perChord) % chordCount : 0,
        chordStart: inChord === 0,
        chords: [],
        bassBeats: null,
        kick: inBar === 0 || inBar === 5,
        brush: inBar === 2 || inBar === 6,
        hatStrong: step % 2 === 0,
        swing: step % 2 === 1 ? 1 / 3 : 0,
    };
    if (pattern === "hold") {
        if (inChord === 0) {
            plan.chords.push({ velocity: 0.9, beats: barsPerChord * 4 * 0.97 });
            plan.bassBeats = barsPerChord * 4 * 0.9;
        }
    } else {
        // 1 拍目でコードとベース、2 拍目の裏でコードを軽く、4 拍目でベースだけ
        if (inBar === 0) {
            plan.chords.push({ velocity: 0.95, beats: 1.6 });
            plan.bassBeats = 1.7;
        } else if (inBar === 3) {
            plan.chords.push({ velocity: 0.7, beats: 1.1 });
        } else if (inBar === 6) {
            plan.bassBeats = 0.9;
        }
    }
    return plan;
}

export interface Preset {
    label: string;
    progression: string;
    bars: 1 | 2;
    bpm: number;
}

export interface PresetGroup {
    label: string;
    presets: readonly Preset[];
}

// よく使われる進行（C や近いキーで書く。キーは移調で変えられる）
export const PRESET_GROUPS: readonly PresetGroup[] = [
    {
        label: "J-POP の定番",
        presets: [
            { label: "王道進行", progression: "Fmaj7 → G7 → Em7 → Am7", bars: 1, bpm: 92 },
            { label: "小室進行", progression: "Am → F → G → C", bars: 1, bpm: 120 },
            { label: "カノン進行", progression: "C → G → Am → Em → F → C → F → G", bars: 1, bpm: 96 },
            { label: "4 つのコードの定番", progression: "C → G → Am → F", bars: 1, bpm: 108 },
        ],
    },
    {
        label: "lofi・チル",
        presets: [
            { label: "ゆっくり下る", progression: "Bbmaj7 → Am7 → Gm7 → Fmaj7", bars: 2, bpm: 72 },
            { label: "おだやかな下降", progression: "Fmaj7 → Em7 → Dm7 → Cmaj7", bars: 1, bpm: 76 },
            { label: "夕暮れ", progression: "Dm9 → Bbmaj7 → Fmaj7 → C/E", bars: 1, bpm: 70 },
        ],
    },
    {
        label: "ジャズ",
        presets: [
            { label: "ii-V-I", progression: "Dm9 → G13 → Cmaj9 → Cmaj9", bars: 1, bpm: 84 },
            { label: "循環進行", progression: "Cmaj7 → A7 → Dm7 → G7", bars: 1, bpm: 96 },
        ],
    },
    {
        label: "切ない",
        presets: [
            { label: "マイナーの定番", progression: "Am → Dm → E7 → Am", bars: 1, bpm: 80 },
            { label: "サブドミナントマイナー", progression: "Cmaj7 → Fmaj7 → Fm6 → Cmaj7", bars: 1, bpm: 72 },
            { label: "下っていくマイナー", progression: "Am → G → F → E7", bars: 1, bpm: 84 },
        ],
    },
];

export const PRESETS: readonly Preset[] = PRESET_GROUPS.flatMap((group) => group.presets);

export const BPM_MIN = 50;
export const BPM_MAX = 140;
export const TRANSPOSE_RANGE = 6;
// 入力欄の長さの上限（保存する値もこれまで）
export const PROGRESSION_MAX_LENGTH = 300;

export interface Settings {
    progression: string;
    bpm: number;
    bars: 1 | 2;
    pattern: Pattern;
    transpose: number;
    rain: boolean;
    crackle: boolean;
    beat: boolean;
    bass: boolean;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
    progression: "Bbmaj7 → Am7 → Gm7 → Fmaj7",
    bpm: 72,
    bars: 2,
    pattern: "comp",
    transpose: 0,
    rain: true,
    crackle: true,
    beat: false,
    bass: true,
};

function isIntegerIn(value: unknown, min: number, max: number): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

// localStorage に残した設定を読む。読めない項目は既定の値にする
export function parseSettings(json: string | null): Settings {
    const settings = { ...DEFAULT_SETTINGS };
    if (json === null) {
        return settings;
    }
    let value: unknown;
    try {
        value = JSON.parse(json);
    } catch {
        return settings;
    }
    if (typeof value !== "object" || value === null) {
        return settings;
    }
    const saved = value as Record<string, unknown>;
    if (typeof saved.progression === "string" && saved.progression.length <= PROGRESSION_MAX_LENGTH) {
        settings.progression = saved.progression;
    }
    if (isIntegerIn(saved.bpm, BPM_MIN, BPM_MAX)) {
        settings.bpm = saved.bpm;
    }
    if (saved.bars === 1 || saved.bars === 2) {
        settings.bars = saved.bars;
    }
    if (saved.pattern === "hold" || saved.pattern === "comp") {
        settings.pattern = saved.pattern;
    }
    if (isIntegerIn(saved.transpose, -TRANSPOSE_RANGE, TRANSPOSE_RANGE)) {
        settings.transpose = saved.transpose;
    }
    for (const key of ["rain", "crackle", "beat", "bass"] as const) {
        const flag = saved[key];
        if (typeof flag === "boolean") {
            settings[key] = flag;
        }
    }
    return settings;
}
