// PreToolUse hook：実装ループ中（harness/.loop/active がある）だけ、検証の土台を書き換えさせない
// - features.json：passes 以外の変更を止める（features.mjs の problems と同じ判定）
// - 検証のしくみ（harness の hooks・check.sh・features.mjs・.loop、.claude/settings.json、playwright.config.ts）：変更を止める
// - 既存のテスト（laravel/tests・laravel/e2e・*.test.ts）：書き換え・削除を止める（新しいテストのファイルは作れる）
// これは「お願い」を機械の柵にしたもの。抜け道はあり得るので、最後は人がレビューする
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { FEATURES, HARNESS, loopActive, problems } from "../features.mjs";

const ROOT = resolve(HARNESS, "..");
const FEATURES_REL = relative(ROOT, FEATURES);

const INFRA = [/^harness\/hooks\//, /^harness\/check\.sh$/, /^harness\/features\.mjs$/, /^harness\/loop\.sh$/, /^harness\/\.loop(\/|$)/, /^\.claude\/settings\.json$/, /^laravel\/playwright\.config\.ts$/];
// e2e/pages.ts はページを増やすときに足すので、柵の外
const TESTS = [/^laravel\/tests\//, /^laravel\/e2e\/(?!pages\.ts$)/, /\.test\.ts$/];

function deny(reason) {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: `[実装ループの柵] ${reason}` } }));
    process.exit(0);
}

// ツールで書いたあとの features.json の中身
function nextContent(tool, input) {
    if (tool === "Write") return input.content ?? "";
    let text = readFileSync(FEATURES, "utf8");
    const edits = tool === "MultiEdit" ? (input.edits ?? []) : [input];
    for (const edit of edits) {
        text = edit.replace_all ? text.split(edit.old_string).join(edit.new_string) : text.replace(edit.old_string, edit.new_string);
    }
    return text;
}

const input = JSON.parse(readFileSync(0, "utf8"));
if (!loopActive()) process.exit(0);

const tool = input.tool_name;
const args = input.tool_input ?? {};

if (tool === "Bash") {
    const command = args.command ?? "";
    // loop.sh の stop・status・escalate は使ってよい
    if (/^\s*bash\s+(\S*\/)?harness\/loop\.sh\s+(stop|status|escalate)\b/.test(command)) process.exit(0);
    const touchesGuarded = /features\.json|harness\/(hooks|\.loop|check\.sh|features\.mjs|loop\.sh)|\.claude\/settings\.json|playwright\.config|laravel\/tests\/|tests\/Feature|e2e\/|\.test\.ts/.test(command);
    const writes = /(^|[^0-9&>])>(?!&)|\bsed\s+-i|\bperl\s+-[a-z]*i|\b(rm|mv|cp|tee|truncate|unlink|install)\s|\bgit\s+(checkout|restore|rm|mv|reset|stash)\b|\b(node|python3?|ruby|php)\s+(-e|-c|-r)\b/.test(command);
    if (touchesGuarded && writes) {
        deny("検証の土台（features.json・テスト・hooks など）を書き換えるコマンドに見えるため止めました。仕様やテストを変える必要があるなら、bash harness/loop.sh escalate \"理由\" を実行して止まり、ユーザーに確認してください");
    }
    process.exit(0);
}

const filePath = args.file_path ?? args.notebook_path;
if (typeof filePath !== "string") process.exit(0);
const rel = relative(ROOT, resolve(input.cwd ?? ROOT, filePath));

if (rel === FEATURES_REL) {
    const found = problems(nextContent(tool, args));
    if (found.length > 0) deny(found.join(" / "));
    process.exit(0);
}
if (INFRA.some((re) => re.test(rel))) {
    deny(`${rel} は検証のしくみなので、実装ループ中は変えられません`);
}
if (TESTS.some((re) => re.test(rel)) && existsSync(join(ROOT, rel))) {
    deny(`既存のテスト ${rel} は実装ループ中は書き換えられません（新しいテストのファイルは作れます）。既存のテストを変える必要があるなら、bash harness/loop.sh escalate "理由" を実行して止まり、ユーザーに確認してください`);
}
