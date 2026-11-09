import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTime, isPlaybackFailure, nextIndex, previousAction } from "./album-player.ts";

test("秒を「分:秒」にし、長さがわからないときは 0:00", () => {
    assert.equal(formatTime(0), "0:00");
    assert.equal(formatTime(9.9), "0:09");
    assert.equal(formatTime(213), "3:33");
    assert.equal(formatTime(3661), "61:01");
    assert.equal(formatTime(Number.NaN), "0:00");
    assert.equal(formatTime(Number.POSITIVE_INFINITY), "0:00");
    assert.equal(formatTime(-1), "0:00");
});

test("曲が終わったら次の曲へ進み、最後の曲のあとは止める", () => {
    assert.equal(nextIndex(0, 19), 1);
    assert.equal(nextIndex(17, 19), 18);
    assert.equal(nextIndex(18, 19), null);
});

test("「前の曲」は、3 秒より先まで聴いていたら頭に戻し、そうでなければ前の曲へ", () => {
    assert.deepEqual(previousAction(5, 3.5), { type: "restart" });
    assert.deepEqual(previousAction(5, 3), { type: "play", index: 4 });
    assert.deepEqual(previousAction(5, 0), { type: "play", index: 4 });
    // 最初の曲は、前がないので頭に戻す
    assert.deepEqual(previousAction(0, 1), { type: "restart" });
});

test("曲を切り替えたときの中断（ABORTED）は、再生できなかったこととして扱わない", () => {
    assert.equal(isPlaybackFailure(1), false);
    assert.equal(isPlaybackFailure(2), true);
    assert.equal(isPlaybackFailure(4), true);
    assert.equal(isPlaybackFailure(undefined), false);
});
