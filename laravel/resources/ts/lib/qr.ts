import { encode } from "uqr";

// QR コード（ブラウザ内で作り、外部には通信しない）。匿名質問ボードの共有用 URL と、QR コード作成のツールで使う
// SVG の path（1 マス 1 単位）にして返す。周りの余白（クワイエットゾーン）は 4 マス
export interface QrPath {
    readonly size: number;
    readonly d: string;
    // QR コードの型番（1〜40。大きいほどマスが多い）
    readonly version: number;
}

// 誤り訂正のレベル：L 7%・M 15%・Q 25%・H 30% まで欠けても読める（高いほど同じ大きさに入る文字が減る）
export type QrEcc = "L" | "M" | "Q" | "H";

export const QR_BORDER = 4;

// 既定の M は、会場のスクリーンを撮るなど、多少かすれても読めるように
export function qrPath(text: string, ecc: QrEcc = "M"): QrPath {
    const { size, data, version } = encode(text, { ecc, border: QR_BORDER });
    let d = "";
    data.forEach((row, y) =>
        row.forEach((dark, x) => {
            if (dark) {
                d += `M${x} ${y}h1v1h-1z`;
            }
        }),
    );
    return { size, d, version };
}

// 入りきらない（型番 40 を超える）ときは null
export function tryQrPath(text: string, ecc: QrEcc = "M"): QrPath | null {
    try {
        return qrPath(text, ecc);
    } catch {
        return null;
    }
}

// 保存用の SVG ファイルの中身。1 マスを moduleSize ピクセルにし、拡大してもぼやけないよう crispEdges で描く
export function qrSvg(qr: QrPath, moduleSize = 10): string {
    const pixels = qr.size * moduleSize;
    return [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels}" height="${pixels}" viewBox="0 0 ${qr.size} ${qr.size}" shape-rendering="crispEdges">`,
        `<rect width="${qr.size}" height="${qr.size}" fill="#fff"/>`,
        `<path d="${qr.d}" fill="#000"/>`,
        "</svg>",
    ].join("");
}

// ---- Wi-Fi の設定 ----
// 読み取ると、スマホがそのネットワークにつなぐか尋ねる（iOS 11 以降・Android 10 以降のカメラ）
// 書き方：WIFI:T:<種類>;S:<ネットワーク名>;P:<パスワード>;H:true;;（ZXing の決まり）

// WPA は WPA2・WPA3 も含む（ふつうはこれ）。nopass はパスワードなし
export type WifiSecurity = "WPA" | "WEP" | "nopass";

export interface WifiSettings {
    readonly ssid: string;
    readonly password: string;
    readonly security: WifiSecurity;
    // ネットワーク名を周りに知らせない（ステルス）ネットワーク
    readonly hidden: boolean;
}

// 区切りに使う記号（\ ; , " :）は、前に \ を付けて文字として扱わせる
export function escapeWifi(value: string): string {
    return value.replace(/([\\;,":])/g, "\\$1");
}

export function wifiPayload(settings: WifiSettings): string {
    const fields = [`T:${settings.security}`, `S:${escapeWifi(settings.ssid)}`];
    if (settings.security !== "nopass") {
        fields.push(`P:${escapeWifi(settings.password)}`);
    }
    if (settings.hidden) {
        fields.push("H:true");
    }
    return `WIFI:${fields.join(";")};;`;
}

// 入力の確かめ（QR コードは作るが、つながらない設定のときに知らせる）。問題がなければ null
export function wifiProblem(settings: WifiSettings): string | null {
    const ssidBytes = new TextEncoder().encode(settings.ssid).length;
    if (ssidBytes === 0) {
        return "ネットワーク名を入れてください";
    }
    if (ssidBytes > 32) {
        return "ネットワーク名が長すぎます（半角 32 文字まで）";
    }
    if (settings.security === "WPA" && (settings.password.length < 8 || settings.password.length > 63)) {
        return "WPA のパスワードは 8〜63 文字です";
    }
    if (settings.security === "WEP" && settings.password === "") {
        return "パスワードを入れてください";
    }
    return null;
}
