import assert from "node:assert/strict";
import { test } from "node:test";
import { parseClientMessage } from "../shared/protocol.ts";

test("ping を受け付ける", () => {
    assert.deepEqual(parseClientMessage('{"action":"ping","requestId":"r1"}'), {
        ok: true,
        message: { action: "ping", requestId: "r1" },
    });
});

test("JSON でない・オブジェクトでない・requestId が正しくないものは invalid_message", () => {
    for (const body of [null, "", "not json", "[]", "null", '{"action":"ping"}', '{"action":"ping","requestId":"a b"}', `{"action":"ping","requestId":"${"x".repeat(65)}"}`]) {
        assert.deepEqual(parseClientMessage(body), { ok: false, requestId: null, code: "invalid_message" }, String(body));
    }
});

test("知らない操作は requestId を付けて unknown_action", () => {
    assert.deepEqual(parseClientMessage('{"action":"hack","requestId":"r2"}'), { ok: false, requestId: "r2", code: "unknown_action" });
});

test("createRoom：前後の空白を除いて検証する", () => {
    const result = parseClientMessage(JSON.stringify({ action: "createRoom", requestId: "r", title: "  A勉強会 ", retention: "24h", nameMode: "anonymous", topics: [" A "] }));

    assert.deepEqual(result, {
        ok: true,
        message: { action: "createRoom", requestId: "r", title: "A勉強会", retention: "24h", nameMode: "anonymous", topics: ["A"] },
    });
});

test("createRoom：タイトル・保存期間・名前の扱い・トピックが正しくなければ validation_error", () => {
    const base = { action: "createRoom", requestId: "r", title: "A", retention: "7d", nameMode: "nickname", topics: [] };
    const cases: Record<string, unknown>[] = [
        { title: "   " },
        { title: "あ".repeat(51) },
        { title: 1 },
        { retention: "1y" },
        { retention: "toString" },
        { nameMode: "real" },
        { topics: "A" },
        { topics: Array.from({ length: 21 }, () => "t") },
        { topics: ["ok", " "] },
        { topics: ["あ".repeat(41)] },
        { topics: [1] },
    ];
    for (const override of cases) {
        const result = parseClientMessage(JSON.stringify({ ...base, ...override }));
        assert.equal(result.ok === false && result.code, "validation_error", JSON.stringify(override));
    }
    // 絵文字は 1 文字として数える
    assert.equal(parseClientMessage(JSON.stringify({ ...base, title: "🎉".repeat(50) })).ok, true);
});

test("join：ルーム ID・鍵の形が正しくなければ room_not_found", () => {
    const valid = "a".repeat(22);
    assert.equal(parseClientMessage(JSON.stringify({ action: "join", requestId: "r", roomId: valid, key: valid, browserId: valid })).ok, true);
    for (const [roomId, key] of [[valid, "short"], ["a".repeat(23), valid], [valid, "a".repeat(21) + "!"], [1, valid]]) {
        const result = parseClientMessage(JSON.stringify({ action: "join", requestId: "r", roomId, key, browserId: valid }));
        assert.equal(result.ok === false && result.code, "room_not_found");
    }
});

test("join：ブラウザ ID がないか形が正しくなければ invalid_message", () => {
    const valid = "a".repeat(22);
    for (const browserId of [undefined, "short", 1]) {
        const result = parseClientMessage(JSON.stringify({ action: "join", requestId: "r", roomId: valid, key: valid, browserId }));
        assert.equal(result.ok === false && result.code, "invalid_message");
    }
});

test("post：改行を \\n にそろえ、制御文字と前後の空白を除く。空のニックネームは null", () => {
    const result = parseClientMessage(JSON.stringify({ action: "post", requestId: "r", kind: "question", body: "  1行目\r\n2行目\u0007\t ", nickname: "  " }));

    assert.deepEqual(result, { ok: true, message: { action: "post", requestId: "r", kind: "question", body: "1行目\n2行目", nickname: null } });
});

test("post：ニックネームは 1 行にし、なければ null", () => {
    const parse = (nickname: unknown) => {
        const result = parseClientMessage(JSON.stringify({ action: "post", requestId: "r", kind: "comment", body: "本文", nickname }));
        return result.ok && result.message.action === "post" ? result.message.nickname : "error";
    };

    assert.equal(parse(" たか\nさん "), "たか さん");
    assert.equal(parse(null), null);
    assert.equal(parse(undefined), null);
});

test("post：種類・本文・ニックネームが正しくなければ validation_error", () => {
    const base = { action: "post", requestId: "r", kind: "question", body: "本文", nickname: null };
    const cases: Record<string, unknown>[] = [
        { kind: "reply" },
        { body: " \n " },
        { body: "あ".repeat(301) },
        { body: 1 },
        { nickname: "あ".repeat(21) },
        { nickname: 1 },
    ];
    for (const override of cases) {
        const result = parseClientMessage(JSON.stringify({ ...base, ...override }));
        assert.equal(result.ok === false && result.code, "validation_error", JSON.stringify(override));
    }
    assert.equal(parseClientMessage(JSON.stringify({ ...base, body: "🎉".repeat(300) })).ok, true);
});

test("deletePost / like / unlike：投稿 ID・鍵の形が正しくなければ post_not_found", () => {
    const valid = "a".repeat(22);
    assert.equal(parseClientMessage(JSON.stringify({ action: "deletePost", requestId: "r", postId: valid, key: valid })).ok, true);
    assert.equal(parseClientMessage(JSON.stringify({ action: "like", requestId: "r", postId: valid })).ok, true);
    for (const body of [
        { action: "deletePost", requestId: "r", postId: valid, key: "short" },
        { action: "deletePost", requestId: "r", postId: 1, key: valid },
        { action: "like", requestId: "r", postId: "short" },
        { action: "unlike", requestId: "r" },
    ]) {
        const result = parseClientMessage(JSON.stringify(body));
        assert.equal(result.ok === false && result.code, "post_not_found", JSON.stringify(body));
    }
});
