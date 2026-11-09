import { test } from "node:test";
import assert from "node:assert/strict";
import { namesOf, type Picked, spell, suggest } from "./chord-suggest.ts";

const Am: Picked = { root: 9, kind: "min" };
const F: Picked = { root: 5, kind: "maj" };
const G: Picked = { root: 7, kind: "maj" };
const Em: Picked = { root: 4, kind: "min" };

function names(chords: Picked[], slot: number, length: number): string[] {
    return suggest(chords, slot, length, "seventh").map((suggestion) => suggestion.name);
}

test("Am から始めると、マイナーでよく使う流れを候補に出す", () => {
    const candidates = names([Am], 1, 4);
    for (const name of ["Fmaj7", "Dm7", "E7"]) {
        assert.ok(candidates.includes(name), `${name} が候補にある：${candidates.join(" ")}`);
    }
    // 同じコードは候補にしない
    assert.ok(!candidates.includes("Am7"));
    assert.ok(candidates.length <= 6);
});

test("小室進行（Am → F → G → C）をたどれ、最後は先頭に戻りやすい C を一番上にする", () => {
    assert.equal(names([Am, F], 2, 4)[0], "G7");
    const last = suggest([Am, F, G], 3, 4, "seventh");
    assert.equal(last[0]!.name, "Cmaj7");
    assert.equal(last[0]!.closesLoop, true);
});

test("王道進行（F → G → Em → Am）をたどれる", () => {
    assert.ok(names([F], 1, 4).includes("G7"));
    assert.ok(names([F, G], 2, 4).includes("Em7"));
    assert.equal(names([F, G, Em], 3, 4)[0], "Am7");
});

test("2 つのループでは、2 つ目に先頭へ戻れるコードを上にする", () => {
    const candidates = suggest([Am], 1, 2, "seventh");
    assert.equal(candidates[0]!.closesLoop, true);
});

test("書き方（三和音・7th・9th）を切り替えられる", () => {
    assert.deepEqual(namesOf([Am, F, G], "triad"), ["Am", "F", "G"]);
    assert.deepEqual(namesOf([Am, F, G], "seventh"), ["Am7", "Fmaj7", "G7"]);
    assert.deepEqual(namesOf([Am, F, G], "ninth"), ["Am9", "Fmaj9", "G13"]);
});

test("シャープのキーでは ♯ で書く", () => {
    assert.equal(spell(6, 9), "F#");
    assert.equal(spell(6, 1), "Gb");
    // F#m から始めると A のキーとして書く
    assert.deepEqual(namesOf([{ root: 6, kind: "min" }], "seventh"), ["F#m7"]);
    assert.ok(names([{ root: 6, kind: "min" }], 1, 4).includes("Dmaj7"));
});

test("表にない流れを選んでも、候補を出し続ける", () => {
    // Am → Eb（どのキーの流れにもない）
    const odd: Picked[] = [Am, { root: 3, kind: "maj" }];
    assert.equal(namesOf(odd, "seventh").length, 2);
    assert.ok(suggest(odd, 2, 4, "seventh").length > 0);
    assert.deepEqual(suggest([], 0, 4, "seventh"), []);
});
