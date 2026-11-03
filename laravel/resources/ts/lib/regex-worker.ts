// 正規表現を Web Worker の中で動かす（時間のかかるパターンでもページが固まらず、ページの側から止められる）
import { runRegex, type RegexInput } from "./regex-check.ts";

export interface RegexRequest {
    id: number;
    input: RegexInput;
}

const scope = self as unknown as { addEventListener(type: "message", listener: (event: MessageEvent<RegexRequest>) => void): void; postMessage(message: unknown): void };

scope.addEventListener("message", (event) => {
    scope.postMessage({ id: event.data.id, result: runRegex(event.data.input) });
});
