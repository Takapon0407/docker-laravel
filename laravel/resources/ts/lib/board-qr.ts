import { encode } from "uqr";

// 共有用 URL の QR コード（ブラウザ内で作り、外部には通信しない）
// SVG の path（1 マス 1 単位）にして返す。周りの余白（クワイエットゾーン）は 4 マス
export interface QrPath {
    readonly size: number;
    readonly d: string;
}

export const QR_BORDER = 4;

export function qrPath(text: string): QrPath {
    // 会場のスクリーンを撮るなど、多少かすれても読めるよう誤り訂正は M（15%）
    const { size, data } = encode(text, { ecc: "M", border: QR_BORDER });
    let d = "";
    data.forEach((row, y) =>
        row.forEach((dark, x) => {
            if (dark) {
                d += `M${x} ${y}h1v1h-1z`;
            }
        }),
    );
    return { size, d };
}
