// features.json の検査（node harness/features.mjs check|summary）
// - 形：id が重ならない・steps が 1 つ以上・priority は must / nice・passes は true / false
// - 実装ループ中（harness/.loop/active がある）は、開始時（.loop/baseline.json）から passes 以外が変わっていないこと
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const HARNESS = dirname(fileURLToPath(import.meta.url));
export const FEATURES = join(HARNESS, "features.json");
const LOOP = join(HARNESS, ".loop");
const KEYS = ["id", "description", "steps", "priority", "passes"];

export const loopActive = () => existsSync(join(LOOP, "active"));

// 問題を文の配列で返す（なければ空）
export function problems(text) {
    let data;
    try {
        data = JSON.parse(text);
    } catch (error) {
        return [`JSON として読めません：${error.message}`];
    }
    const found = [];
    if (!Array.isArray(data?.features)) {
        return ["{ \"features\": [...] } の形にしてください"];
    }
    const ids = new Set();
    data.features.forEach((feature, index) => {
        const label = `features[${index}]（${feature?.id ?? "id なし"}）`;
        const extra = Object.keys(feature ?? {}).filter((key) => !KEYS.includes(key));
        if (extra.length > 0) found.push(`${label}：知らない項目 ${extra.join(", ")}`);
        if (typeof feature?.id !== "string" || feature.id === "") found.push(`${label}：id がありません`);
        else if (ids.has(feature.id)) found.push(`${label}：id が重なっています`);
        else ids.add(feature.id);
        if (typeof feature?.description !== "string" || feature.description === "") found.push(`${label}：description がありません`);
        if (!Array.isArray(feature?.steps) || feature.steps.length === 0 || !feature.steps.every((s) => typeof s === "string" && s !== "")) {
            found.push(`${label}：steps（機械で確かめる手順）が 1 つ以上必要です`);
        }
        if (!["must", "nice"].includes(feature?.priority)) found.push(`${label}：priority は must か nice です`);
        if (typeof feature?.passes !== "boolean") found.push(`${label}：passes は true か false です`);
    });
    if (found.length === 0 && loopActive()) {
        found.push(...changedFromBaseline(data));
    }
    return found;
}

// 実装ループ中に変えてよいのは passes だけ（項目の追加・削除・並べ替え・書き換えは要件定義に差し戻す）
function changedFromBaseline(data) {
    const baseline = JSON.parse(readFileSync(join(LOOP, "baseline.json"), "utf8"));
    const strip = (features) => JSON.stringify(features.map(({ passes, ...rest }) => rest));
    if (strip(baseline.features) !== strip(data.features)) {
        return ["実装ループ中は features.json の passes 以外を変えられません。仕様を変えるなら、止めてユーザーに確認してください（要件定義に差し戻す）"];
    }
    return [];
}

function summary(data) {
    const must = data.features.filter((f) => f.priority === "must");
    const rest = must.filter((f) => !f.passes);
    console.log(`must：${must.length - rest.length}/${must.length} 達成、nice：${data.features.filter((f) => f.priority === "nice" && f.passes).length}/${data.features.length - must.length} 達成`);
    for (const f of rest) console.log(`  未達成 ${f.id}：${f.description}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const text = readFileSync(FEATURES, "utf8");
    const found = problems(text);
    if (found.length > 0) {
        for (const p of found) console.error(p);
        process.exit(1);
    }
    if (process.argv[2] === "summary") summary(JSON.parse(text));
}
