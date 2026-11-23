// ガチャの分布を Web Worker の中で計算する（天井 1000 回などの重い入力でもページが固まらず、ページの側から止められる）
import { computeGacha, type GachaInput, type GachaResult } from "./gacha.ts";

export interface GachaRequest {
    id: number;
    input: GachaInput;
}

export interface GachaResponse {
    id: number;
    result: GachaResult;
}

const scope = self as unknown as { addEventListener(type: "message", listener: (event: MessageEvent<GachaRequest>) => void): void; postMessage(message: GachaResponse): void };

scope.addEventListener("message", (event) => {
    scope.postMessage({ id: event.data.id, result: computeGacha(event.data.input) });
});
