import { formatTime, isPlaybackFailure, nextIndex, previousAction } from "@/lib/album-player";

// 作品のページ（/works/*）：アルバムのプレーヤーと、押したら読み込む YouTube

function element<T extends HTMLElement>(id: string): T | null {
    return document.getElementById(id) as T | null;
}

// 押すまで YouTube に接続しない。押したら youtube-nocookie.com のプレーヤーに差し替えて再生する
function setUpVideoEmbed(): void {
    const box = element<HTMLElement>("video-embed");
    const button = element<HTMLButtonElement>("video-embed-button");
    const id = box?.dataset.youtubeId;
    if (!box || !button || !id) {
        return;
    }
    button.addEventListener("click", () => {
        const frame = document.createElement("iframe");
        frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`;
        frame.title = "YouTube の動画";
        frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
        frame.allowFullscreen = true;
        box.replaceChildren(frame);
        frame.focus();
    });
}

function setUpAlbumPlayer(): void {
    const player = element<HTMLElement>("album-player");
    const audio = element<HTMLAudioElement>("album-audio");
    const playButton = element<HTMLButtonElement>("album-play");
    const prevButton = element<HTMLButtonElement>("album-prev");
    const nextButton = element<HTMLButtonElement>("album-next");
    const nowTitle = element<HTMLElement>("album-now-title");
    const seek = element<HTMLInputElement>("album-seek");
    const currentLabel = element<HTMLElement>("album-current");
    const durationLabel = element<HTMLElement>("album-duration");
    const unavailable = element<HTMLElement>("album-unavailable");
    if (!player || !audio || !playButton || !prevButton || !nextButton || !nowTitle || !seek || !currentLabel || !durationLabel || !unavailable) {
        return;
    }
    const tracks = Array.from(player.querySelectorAll<HTMLButtonElement>("[data-album-track]"));
    if (tracks.length === 0) {
        return;
    }

    let current: number | null = null;
    // つまみを動かしている間は、再生位置の表示で上書きしない
    let seeking = false;

    function render(): void {
        const playing = !audio!.paused && !audio!.ended;
        player!.classList.toggle("is-playing", playing);
        playButton!.setAttribute("aria-label", playing ? "一時停止" : "再生");
        prevButton!.disabled = current === null;
        nextButton!.disabled = current === null || nextIndex(current, tracks.length) === null;
        tracks.forEach((track, index) => {
            if (index === current) {
                track.setAttribute("aria-current", "true");
            } else {
                track.removeAttribute("aria-current");
            }
        });
    }

    // 曲の長さは、変わったとき（曲を切り替えて読み込んだとき）だけ書く
    function renderDuration(): void {
        const duration = Number.isFinite(audio!.duration) ? audio!.duration : 0;
        seek!.max = String(Math.floor(duration));
        seek!.disabled = duration === 0;
        durationLabel!.textContent = formatTime(duration);
    }

    function renderCurrentTime(): void {
        if (!seeking) {
            seek!.value = String(Math.floor(audio!.currentTime));
            currentLabel!.textContent = formatTime(audio!.currentTime);
        }
    }

    function play(index: number): void {
        const track = tracks[index];
        const src = track?.dataset.src;
        if (!track || !src) {
            return;
        }
        unavailable!.hidden = true;
        // 再生に失敗したあと（配信を止めている月など）に同じ曲をもう一度押したときも、読み込み直して確かめる
        if (current !== index || audio!.error) {
            current = index;
            audio!.src = src;
            nowTitle!.textContent = `${index + 1}. ${track.dataset.title ?? ""}`;
            updateMediaSession(track.dataset.title ?? "");
        }
        // 再生できなかったときは error イベントで知らせる（自動再生の制限などで断られたときは何もしない）
        audio!.play().catch(() => undefined);
        render();
    }

    function togglePlay(): void {
        if (current === null) {
            play(0);
        } else if (audio!.ended && nextIndex(current, tracks.length) === null) {
            // アルバムを最後まで聴いたあとは、最初の曲から
            play(0);
        } else if (audio!.paused) {
            play(current);
        } else {
            audio!.pause();
        }
    }

    function playPrevious(): void {
        if (current === null) {
            return;
        }
        const action = previousAction(current, audio!.currentTime);
        if (action.type === "restart") {
            audio!.currentTime = 0;
        } else {
            play(action.index);
        }
    }

    function playNext(): void {
        const next = current === null ? null : nextIndex(current, tracks.length);
        if (next !== null) {
            play(next);
        }
    }

    // ロック画面・イヤホンのボタンからも操作できるようにする
    function updateMediaSession(title: string): void {
        if (!("mediaSession" in navigator)) {
            return;
        }
        const artwork = player!.dataset.artwork;
        navigator.mediaSession.metadata = new MediaMetadata({
            title,
            artist: player!.dataset.artist ?? "",
            album: player!.dataset.album ?? "",
            artwork: artwork ? [{ src: artwork, sizes: "640x640", type: "image/jpeg" }] : [],
        });
    }
    if ("mediaSession" in navigator) {
        navigator.mediaSession.setActionHandler("play", togglePlay);
        navigator.mediaSession.setActionHandler("pause", () => audio.pause());
        navigator.mediaSession.setActionHandler("previoustrack", playPrevious);
        navigator.mediaSession.setActionHandler("nexttrack", playNext);
    }

    tracks.forEach((track, index) => {
        track.addEventListener("click", () => {
            if (index === current && !audio.paused) {
                audio.pause();
            } else {
                play(index);
            }
        });
    });
    playButton.addEventListener("click", togglePlay);
    prevButton.addEventListener("click", playPrevious);
    nextButton.addEventListener("click", playNext);

    seek.addEventListener("input", () => {
        seeking = true;
        currentLabel.textContent = formatTime(Number(seek.value));
    });
    seek.addEventListener("change", () => {
        audio.currentTime = Number(seek.value);
        seeking = false;
    });

    audio.addEventListener("play", render);
    audio.addEventListener("pause", render);
    audio.addEventListener("timeupdate", renderCurrentTime);
    audio.addEventListener("durationchange", renderDuration);
    audio.addEventListener("ended", () => {
        const next = current === null ? null : nextIndex(current, tracks.length);
        if (next === null) {
            render();
        } else {
            play(next);
        }
    });
    // 再生できなかったとき（その月の配信を止めているときは /media/* が 403 になる）は、ほかで聴ける場所を案内する
    audio.addEventListener("error", () => {
        if (isPlaybackFailure(audio.error?.code)) {
            unavailable.hidden = false;
            render();
        }
    });

    render();
}

document.addEventListener("DOMContentLoaded", () => {
    setUpVideoEmbed();
    setUpAlbumPlayer();
});
