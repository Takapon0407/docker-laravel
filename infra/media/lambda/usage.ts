// 転送量の上限の判定（AWS に依存しない部分。test/usage.test.ts でテストする）

// AWS の料金の「GB」は 2^30 バイト
export const BYTES_PER_GB = 1024 ** 3;

// 今月の初め（UTC）。AWS の請求と CloudFront の無料枠（毎月 1TB）は UTC の暦月で数える
export function monthStart(now: Date): Date {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// 今月の転送量が上限より少なければ配信する（上限ちょうどで止める）
export function shouldEnable(usedBytes: number, limitBytes: number): boolean {
    return usedBytes < limitBytes;
}

export type Transition = "enable" | "disable" | null;

// 前回から変わったときだけ切り替える（KeyValueStore の API は 1,000 回で 1 ドルかかるため、毎回は書かない）
// 前回の状態がわからない（初回など）ときは、今の判定どおりに書く
export function transitionOf(previous: boolean | null, enabled: boolean): Transition {
    if (previous === enabled) {
        return null;
    }
    return enabled ? "enable" : "disable";
}

// Parameter Store に残している前回の状態（"true" / "false"）を読む。それ以外は不明として扱う
export function parseState(value: string | undefined): boolean | null {
    if (value === "true") {
        return true;
    }
    if (value === "false") {
        return false;
    }
    return null;
}

export function formatGb(bytes: number): string {
    return `${(bytes / BYTES_PER_GB).toFixed(1)} GB`;
}

// 切り替えたときの通知の文面（SNS の件名は ASCII だけなので英語にする）
export function notificationOf(transition: "enable" | "disable", usedBytes: number, limitBytes: number, now: Date): { subject: string; message: string } {
    const usage = `今月（${now.getUTCFullYear()} 年 ${now.getUTCMonth() + 1} 月、UTC）の CloudFront の転送量：${formatGb(usedBytes)}（上限 ${formatGb(limitBytes)}）`;
    if (transition === "disable") {
        return {
            subject: "[tektektech] Paused /media/* (monthly transfer limit reached)",
            message: `${usage}\n\n/media/*（作品の音源）は 403 を返しています。来月の初め（UTC）に自動で再開します。`,
        };
    }
    return {
        subject: "[tektektech] Resumed /media/*",
        message: `${usage}\n\n/media/*（作品の音源）の配信を再開しました。`,
    };
}
