import { test } from "node:test";
import assert from "node:assert/strict";
import {
    chordName,
    DEFAULT_SETTINGS,
    midiName,
    normalizeQuality,
    parseChord,
    parseProgression,
    parseSettings,
    planStep,
    PRESETS,
    splitProgression,
    lyricsHintText,
    plainText,
    PRESET_GROUPS,
    voice,
    voiceProgression,
} from "./chord-player.ts";

function chord(symbol: string) {
    const parsed = parseChord(symbol);
    assert.ok(parsed, `${symbol} を読めること`);
    return parsed;
}

// 構成音を C = 0 〜 B = 11 の集合にする
function pitchSet(notes: number[]): number[] {
    return [...new Set(notes.map((note) => note % 12))].sort((a, b) => a - b);
}

test("コード名から、ルート・ベース・構成音を読む", () => {
    const bbmaj7 = chord("Bbmaj7");
    assert.equal(bbmaj7.root, 10);
    assert.equal(bbmaj7.bass, 10);
    assert.deepEqual(bbmaj7.intervals, [0, 4, 7, 11]);
    assert.equal(bbmaj7.slash, false);

    const slash = chord("C/E");
    assert.equal(slash.root, 0);
    assert.equal(slash.bass, 4);
    assert.equal(slash.slash, true);

    assert.equal(chord("F#m7").root, 6);
    assert.equal(chord("E♭maj7").root, 3);
    assert.equal(chord("am7").root, 9);
});

test("表記ゆれを吸収する", () => {
    assert.equal(normalizeQuality("M7"), "maj7");
    assert.equal(normalizeQuality("Δ7"), "maj7");
    assert.equal(normalizeQuality("Δ"), "maj7");
    assert.equal(normalizeQuality("min7"), "m7");
    assert.equal(normalizeQuality("-7"), "m7");
    assert.equal(normalizeQuality("ø"), "m7b5");
    assert.equal(normalizeQuality("m7-5"), "m7b5");
    assert.equal(normalizeQuality("°7"), "dim7");
    assert.equal(normalizeQuality("+"), "aug");
    assert.equal(normalizeQuality("7(b9)"), "7b9");
    assert.equal(normalizeQuality("mM7"), "mmaj7");
    assert.equal(normalizeQuality("M"), "");
    for (const symbol of ["CM7", "CΔ7", "Cmin7", "C-7", "Cø", "C°", "C+", "C7(♭9)", "Cmaj7(#11)", "CmMaj7", "C7sus", "C69"]) {
        chord(symbol);
    }
});

test("読めないコードは null にする", () => {
    assert.equal(parseChord("H7"), null);
    assert.equal(parseChord("Cfoo"), null);
    assert.equal(parseChord("C/X"), null);
    assert.equal(parseChord(""), null);
});

test("進行は空白・カンマ・|・→ と、単独のハイフンで区切る", () => {
    assert.deepEqual(splitProgression("Bbmaj7 → Am7 → Gm7 → Fmaj7"), ["Bbmaj7", "Am7", "Gm7", "Fmaj7"]);
    assert.deepEqual(splitProgression("Dm7 - G7 | Cmaj7,Am7、 Bm7-5"), ["Dm7", "G7", "Cmaj7", "Am7", "Bm7-5"]);
    assert.deepEqual(splitProgression("  "), []);

    const parsed = parseProgression("Fmaj7 Xyz C/E");
    assert.deepEqual(
        parsed.map((token) => token.ok),
        [true, false, true],
    );
    assert.deepEqual(parsed[1], { ok: false, source: "Xyz" });
});

test("移調しないときは入力の書き方のまま、移調したら ♭ で書き、分数コードのベースも移調する", () => {
    assert.equal(chordName(chord("Bbmaj7"), 0), "Bbmaj7");
    assert.equal(chordName(chord("Bbmaj7"), 2), "Cmaj7");
    assert.equal(chordName(chord("C/E"), -1), "B/Eb");
    assert.equal(chordName(chord("F#m7"), 0), "F#m7");
    assert.equal(chordName(chord("f#m7"), 0), "F#m7");
    assert.equal(chordName(chord("E♭maj7/B♭"), 0), "Ebmaj7/Bb");
    assert.equal(chordName(chord("F#m7"), 1), "Gm7");
    assert.equal(plainText([chord("Gm9"), chord("C13")], 0), "Gm9 - C13");
    assert.equal(lyricsHintText([chord("Gm9"), chord("C13")], -6), "[Chord Progression: Dbm9 - Gb13]");
});

test("MIDI の番号を音名にする", () => {
    assert.equal(midiName(60), "C4");
    assert.equal(midiName(31), "G1");
    assert.equal(midiName(70), "Bb4");
});

test("ボイシング：ルートはベースに任せ、上の声部は決めた範囲に置く", () => {
    const voicing = voice(chord("Bbmaj7"), 0, null);
    // 4 音のコードはルート（Bb）を抜いて D・F・A
    assert.deepEqual(pitchSet(voicing.upper), [2, 5, 9]);
    assert.equal(voicing.bass % 12, 10);
    assert.ok(voicing.bass >= 31 && voicing.bass <= 42);
    assert.ok(voicing.upper[0]! >= 52 && voicing.upper[0]! <= 64 + 11);

    // 音が 5 つ以上なら 5 度も抜く（C13：E・Bb・D・A）
    assert.deepEqual(pitchSet(voice(chord("C13"), 0, null).upper), [2, 4, 9, 10]);
    // 3 音のコードはルートを残す
    assert.deepEqual(pitchSet(voice(chord("C"), 0, null).upper), [0, 4, 7]);
    // 分数コードはベースを指定の音にする
    assert.equal(voice(chord("C/E"), 0, null).bass % 12, 4);
    // 移調するとベースも動き、範囲からはみ出さない
    for (let semitones = -6; semitones <= 6; semitones++) {
        const bass = voice(chord("B7"), semitones, null).bass;
        assert.ok(bass >= 31 && bass <= 42, `${semitones} 半音：${bass}`);
    }
});

test("ボイシング：前のコードから指を大きく動かさない", () => {
    const [first, second] = voiceProgression([chord("Dm7"), chord("G7")], 0);
    const moved = second!.upper.reduce((sum, note) => sum + Math.min(...first!.upper.map((p) => Math.abs(p - note))), 0);
    // Dm7（F・A・C）→ G7（F・B・D）は、2 音が半音〜全音動くだけで済む
    assert.ok(moved <= 3, `動いた量：${moved}`);
});

test("のばす弾き方：コードの頭でだけ、コードとベースを鳴らす", () => {
    const start = planStep(0, 4, 2, "hold");
    assert.equal(start.chordStart, true);
    assert.equal(start.chordIndex, 0);
    assert.equal(start.chords.length, 1);
    assert.ok(start.bassBeats !== null && start.bassBeats < 8);

    const middle = planStep(8, 4, 2, "hold");
    assert.equal(middle.chordStart, false);
    assert.deepEqual(middle.chords, []);
    assert.equal(middle.bassBeats, null);

    // 2 小節 × 4 コードで一周する
    assert.equal(planStep(16, 4, 2, "hold").chordIndex, 1);
    assert.equal(planStep(64, 4, 2, "hold").chordIndex, 0);
});

test("刻む弾き方：1 拍目と 2 拍目の裏でコード、1 拍目と 4 拍目でベース", () => {
    const steps = Array.from({ length: 8 }, (_, step) => planStep(step, 4, 1, "comp"));
    assert.deepEqual(
        steps.map((plan) => plan.chords.length),
        [1, 0, 0, 1, 0, 0, 0, 0],
    );
    assert.deepEqual(
        steps.map((plan) => plan.bassBeats !== null),
        [true, false, false, false, false, false, true, false],
    );
    assert.deepEqual(
        steps.map((plan) => plan.kick),
        [true, false, false, false, false, true, false, false],
    );
    assert.deepEqual(
        steps.map((plan) => plan.brush),
        [false, false, true, false, false, false, true, false],
    );
    // 裏拍だけ遅らせる
    assert.deepEqual(
        steps.map((plan) => plan.swing > 0),
        [false, true, false, true, false, true, false, true],
    );
    assert.equal(planStep(8, 4, 1, "comp").chordIndex, 1);
});

test("コードが 1 つもないときも、番号は 0 にする", () => {
    assert.equal(planStep(5, 0, 1, "comp").chordIndex, 0);
});

test("プリセットはジャンルに分け、進行はすべて読める", () => {
    assert.ok(PRESET_GROUPS.length >= 3);
    assert.equal(PRESETS.length, PRESET_GROUPS.flatMap((group) => group.presets).length);
    for (const preset of PRESETS) {
        assert.ok(
            parseProgression(preset.progression).every((token) => token.ok),
            preset.label,
        );
    }
});

test("保存した設定を読み、おかしな項目は既定の値にする", () => {
    assert.deepEqual(parseSettings(null), DEFAULT_SETTINGS);
    assert.deepEqual(parseSettings("{"), DEFAULT_SETTINGS);
    assert.deepEqual(parseSettings("[]"), DEFAULT_SETTINGS);
    assert.deepEqual(parseSettings("null"), DEFAULT_SETTINGS);

    const saved = { progression: "Dm7 G7", bpm: 90, bars: 1, pattern: "hold", transpose: -3, rain: false, crackle: false, beat: true, bass: false };
    assert.deepEqual(parseSettings(JSON.stringify(saved)), saved);

    const broken = parseSettings(JSON.stringify({ progression: 1, bpm: 200, bars: 3, pattern: "x", transpose: 1.5, rain: "yes" }));
    assert.deepEqual(broken, DEFAULT_SETTINGS);
    assert.equal(parseSettings(JSON.stringify({ progression: "C".repeat(301) })).progression, DEFAULT_SETTINGS.progression);
});
