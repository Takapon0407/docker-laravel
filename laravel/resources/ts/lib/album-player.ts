// アルバムのプレーヤー（/works/*）の、DOM に依存しない計算

// 「前の曲」を押したとき、この秒数より先まで聴いていたら、前の曲ではなく今の曲の頭に戻す（多くの音楽アプリと同じ動き）
export const RESTART_THRESHOLD_SECONDS = 3;

// 秒を「分:秒」にする（再生前など、長さがわからないときは 0:00）
export function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return "0:00";
    }
    const whole = Math.floor(seconds);
    const minutes = Math.floor(whole / 60);
    const rest = whole % 60;
    return `${minutes}:${String(rest).padStart(2, "0")}`;
}

// 曲が終わったときに次に流す曲（最後の曲のあとは止める＝ null）
export function nextIndex(current: number, count: number): number | null {
    return current + 1 < count ? current + 1 : null;
}

export type PreviousAction = { readonly type: "restart" } | { readonly type: "play"; readonly index: number };

// 「前の曲」を押したときの動き：聴き始めてしばらく経っていたら頭に戻し、そうでなければ前の曲へ（最初の曲なら頭に戻す）
export function previousAction(current: number, currentTime: number): PreviousAction {
    if (currentTime > RESTART_THRESHOLD_SECONDS || current <= 0) {
        return { type: "restart" };
    }
    return { type: "play", index: current - 1 };
}

// MediaError の code のうち、再生できなかったことを知らせるもの
// （1 = MEDIA_ERR_ABORTED は、曲を切り替えたときなどに自分で止めた場合なので知らせない）
export function isPlaybackFailure(code: number | undefined): boolean {
    return code !== undefined && code !== 1;
}
