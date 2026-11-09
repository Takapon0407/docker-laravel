import { ChordAudio } from "@/lib/chord-audio";
import {
    type Chord,
    chordName,
    lyricsHintText,
    midiName,
    parseProgression,
    parseSettings,
    type ParsedToken,
    type Pattern,
    plainText,
    planStep,
    PRESET_GROUPS,
    PRESETS,
    type Settings,
    type Voicing,
    voiceProgression,
} from "@/lib/chord-player";
import { type Kind, namesOf, type Picked, type Style, suggest } from "@/lib/chord-suggest";
import { setUpCopyButtons } from "../util/copy";

const STORAGE_KEY = "chord-player:v1";
// 鍵盤の範囲（G1〜G5。ベースと上の声部が収まる）
const KEYBOARD_LOW = 31;
const KEYBOARD_HIGH = 79;
// 予約の間隔と、どれだけ先まで予約するか（秒）。タブが裏にあるとタイマーが 1 秒おきに間引かれるため、そのときは長めに予約する
const TICK_MS = 25;
const LOOKAHEAD_SECONDS = 0.15;
const HIDDEN_LOOKAHEAD_SECONDS = 1.5;
// 止めてから AudioContext を休ませるまで（雨音が消えきるのを待つ）
const SUSPEND_DELAY_MS = 2000;

const isBlackKey = (midi: number): boolean => [1, 3, 6, 8, 10].includes(midi % 12);

function element<T extends HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
}

document.addEventListener("DOMContentLoaded", () => {
    const input = element<HTMLInputElement>("chord-progression");
    const error = element<HTMLElement>("chord-error");
    const presetBox = element<HTMLElement>("chord-presets");
    // 鳴らすボタンは、組み立てる欄と鳴らし方の欄の 2 か所にある（どちらも同じ再生を切り替える）
    const playButtons = document.querySelectorAll<HTMLButtonElement>("[data-chord-play]");
    const bpmInput = element<HTMLInputElement>("chord-bpm");
    const bpmValue = element<HTMLOutputElement>("chord-bpm-value");
    const barsSelect = element<HTMLSelectElement>("chord-bars");
    const patternSelect = element<HTMLSelectElement>("chord-pattern");
    const transposeSelect = element<HTMLSelectElement>("chord-transpose");
    const toggles = {
        rain: element<HTMLInputElement>("chord-rain"),
        crackle: element<HTMLInputElement>("chord-crackle"),
        beat: element<HTMLInputElement>("chord-beat"),
        bass: element<HTMLInputElement>("chord-bass"),
    };
    const cardBox = element<HTMLElement>("chord-cards");
    const keyboard = element<HTMLElement>("chord-keyboard");
    const copyPlain = element<HTMLElement>("chord-copy-plain");
    const copyHint = element<HTMLElement>("chord-copy-hint");

    let tokens: ParsedToken[] = [];
    let voicings: Voicing[] = [];
    let current = 0;

    function readSettings(): Settings {
        return {
            progression: input.value,
            bpm: Number(bpmInput.value),
            bars: barsSelect.value === "1" ? 1 : 2,
            pattern: patternSelect.value as Pattern,
            transpose: Number(transposeSelect.value),
            rain: toggles.rain.checked,
            crackle: toggles.crackle.checked,
            beat: toggles.beat.checked,
            bass: toggles.bass.checked,
        };
    }

    function save(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(readSettings()));
        } catch {
            // 保存できない（プライベートブラウズなど）ときは、覚えないだけにする
        }
    }

    function restore(): void {
        let json: string | null = null;
        try {
            json = localStorage.getItem(STORAGE_KEY);
        } catch {
            // 読めないときは既定の値で始める
        }
        const settings = parseSettings(json);
        input.value = settings.progression;
        bpmInput.value = String(settings.bpm);
        bpmValue.textContent = String(settings.bpm);
        barsSelect.value = String(settings.bars);
        patternSelect.value = settings.pattern;
        transposeSelect.value = String(settings.transpose);
        toggles.rain.checked = settings.rain;
        toggles.crackle.checked = settings.crackle;
        toggles.beat.checked = settings.beat;
        toggles.bass.checked = settings.bass;
    }

    // ---------- 鍵盤 ----------
    const keys = new Map<number, HTMLElement>();
    const whiteKeys: number[] = [];
    for (let midi = KEYBOARD_LOW; midi <= KEYBOARD_HIGH; midi++) {
        if (!isBlackKey(midi)) {
            whiteKeys.push(midi);
        }
    }
    for (const midi of whiteKeys) {
        const key = document.createElement("div");
        key.className = "chord-key-white";
        if (midi % 12 === 0) {
            const label = document.createElement("span");
            label.className = "chord-key-label";
            label.textContent = midiName(midi);
            key.append(label);
        }
        keys.set(midi, key);
        keyboard.append(key);
    }
    for (let midi = KEYBOARD_LOW; midi <= KEYBOARD_HIGH; midi++) {
        if (isBlackKey(midi)) {
            // 左の白鍵との境目に、白鍵の 6 割の幅で置く
            const leftWhite = whiteKeys.indexOf(midi - 1);
            const key = document.createElement("div");
            key.className = "chord-key-black";
            key.style.left = `${((leftWhite + 1 - 0.3) / whiteKeys.length) * 100}%`;
            key.style.width = `${(0.6 / whiteKeys.length) * 100}%`;
            keys.set(midi, key);
            keyboard.append(key);
        }
    }

    function highlight(index: number): void {
        cardBox.querySelectorAll<HTMLElement>("[data-chord-index]").forEach((card) => {
            card.classList.toggle("is-now", Number(card.dataset.chordIndex) === index);
        });
        keys.forEach((key) => key.classList.remove("is-on", "is-bass"));
        const voicing = voicings[index];
        if (voicing === undefined) {
            return;
        }
        voicing.upper.forEach((note) => keys.get(note)?.classList.add("is-on"));
        keys.get(voicing.bass)?.classList.add("is-bass");
    }

    // ---------- 進行 ----------
    function goodChords(): Chord[] {
        return tokens.flatMap((token) => (token.ok ? [token.chord] : []));
    }

    function renderCards(transpose: number): void {
        let index = 0;
        cardBox.replaceChildren(
            ...tokens.map((token) => {
                const card = document.createElement("button");
                card.type = "button";
                card.className = "chord-card";
                const label = document.createElement("span");
                label.className = "chord-card-index";
                const name = document.createElement("span");
                name.className = "chord-card-name";
                if (!token.ok) {
                    card.classList.add("is-bad");
                    card.disabled = true;
                    label.textContent = "読めません";
                    name.textContent = token.source;
                    card.append(label, name);
                    return card;
                }
                const myIndex = index++;
                const voicing = voicings[myIndex]!;
                card.dataset.chordIndex = String(myIndex);
                label.textContent = `${myIndex + 1} 番目`;
                name.textContent = chordName(token.chord, transpose);
                const notes = document.createElement("span");
                notes.className = "chord-card-notes";
                notes.textContent = [voicing.bass, ...voicing.upper].map(midiName).join(" ");
                card.append(label, name, notes);
                card.setAttribute("aria-label", `${name.textContent}を試しに鳴らす（${notes.textContent}）`);
                card.addEventListener("click", () => void preview(myIndex));
                return card;
            }),
        );
    }

    function rebuild(): void {
        const settings = readSettings();
        tokens = parseProgression(settings.progression);
        const bad = tokens.flatMap((token) => (token.ok ? [] : [token.source]));
        error.textContent = bad.length > 0 ? `読めないコード：${bad.join("、")}（とばして鳴らします）` : "";
        error.hidden = bad.length === 0;
        const chords = goodChords();
        voicings = voiceProgression(chords, settings.transpose);
        renderCards(settings.transpose);
        copyPlain.textContent = chords.length > 0 ? plainText(chords, settings.transpose) : "";
        copyHint.textContent = chords.length > 0 ? lyricsHintText(chords, settings.transpose) : "";
        presetBox.querySelectorAll<HTMLButtonElement>("button").forEach((button, i) => {
            button.setAttribute("aria-pressed", String(PRESETS[i]!.progression === input.value));
        });
        highlight(current);
        save();
    }

    // ジャンルごとに並べる（押したボタンの判定は PRESETS の順で行うため、同じ順に作る）
    for (const group of PRESET_GROUPS) {
        const row = document.createElement("div");
        row.className = "chord-preset-group";
        const label = document.createElement("span");
        label.className = "chord-preset-label";
        label.textContent = group.label;
        const buttons = document.createElement("div");
        buttons.className = "chord-presets";
        buttons.setAttribute("role", "group");
        buttons.setAttribute("aria-label", group.label);
        for (const preset of group.presets) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "btn btn-outline-success btn-sm";
            button.textContent = preset.label;
            button.title = preset.progression;
            button.addEventListener("click", () => {
                input.value = preset.progression;
                barsSelect.value = String(preset.bars);
                bpmInput.value = String(preset.bpm);
                bpmValue.textContent = String(preset.bpm);
                rebuild();
            });
            buttons.append(button);
        }
        row.append(label, buttons);
        presetBox.append(row);
    }

    // ---------- 1 つずつ組み立てる ----------
    const startRoot = element<HTMLSelectElement>("chord-start-root");
    const slotBox = element<HTMLElement>("chord-slots");
    const suggestionBox = element<HTMLElement>("chord-suggestions");
    const suggestionHeading = element<HTMLElement>("chord-suggestions-heading");
    const checked = (name: string): string => (document.querySelector(`input[name="${name}"]:checked`) as HTMLInputElement).value;

    function startChord(): Picked {
        return { root: Number(startRoot.value), kind: checked("chord-start-kind") as Kind };
    }

    let built: Picked[] = [startChord()];
    // 次に選ぶ場所（built.length 以下。length と同じなら、そろっている）
    let active = 1;

    function builderLength(): number {
        return Number(checked("chord-length"));
    }

    function builderStyle(): Style {
        return checked("chord-style") as Style;
    }

    function renderBuilder(): void {
        const length = builderLength();
        const names = namesOf(built, builderStyle());
        slotBox.replaceChildren(
            ...Array.from({ length }, (_, i) => {
                const slot = document.createElement("button");
                slot.type = "button";
                slot.className = "chord-slot";
                slot.textContent = names[i] ?? "?";
                slot.classList.toggle("is-empty", names[i] === undefined);
                slot.classList.toggle("is-active", i === active);
                if (i === active) {
                    slot.setAttribute("aria-current", "step");
                }
                slot.setAttribute("aria-label", `${i + 1} 番目：${names[i] ?? "まだ選んでいません"}${i > 0 && i <= built.length ? "（押すと選び直せます）" : ""}`);
                // 先頭は「始まりのコード」で選ぶ。まだ前が決まっていないところは選べない
                slot.disabled = i > built.length;
                slot.addEventListener("click", () => {
                    if (i === 0) {
                        startRoot.focus();
                        return;
                    }
                    active = i;
                    renderBuilder();
                });
                return slot;
            }),
        );

        if (active >= length) {
            suggestionHeading.textContent = "そろいました";
            const done = document.createElement("p");
            done.className = "chord-help mb-0";
            done.textContent = "選んだ進行をくり返し鳴らせます。コードを押すと、そこから選び直せます。";
            suggestionBox.replaceChildren(done);
            return;
        }
        suggestionHeading.textContent = `${active + 1} 番目の候補（${names[active - 1] ?? ""} の次）`;
        suggestionBox.replaceChildren(
            ...suggest(built, active, length, builderStyle()).map((suggestion) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "chord-suggestion";
                const name = document.createElement("span");
                name.className = "chord-suggestion-name";
                name.textContent = suggestion.name;
                const note = document.createElement("span");
                note.className = "chord-suggestion-note";
                note.textContent = suggestion.note;
                button.append(name, note);
                // 選び直しているときは、今入っているコードがわかるようにする
                const chosen = built[active];
                button.setAttribute("aria-pressed", String(chosen !== undefined && chosen.root === suggestion.chord.root && chosen.kind === suggestion.chord.kind));
                if (suggestion.closesLoop) {
                    const loop = document.createElement("span");
                    loop.className = "chord-suggestion-loop";
                    loop.textContent = "先頭に戻りやすい";
                    button.append(loop);
                }
                button.addEventListener("click", () => {
                    built[active] = suggestion.chord;
                    // 続きが決まっていなければ次へ。選び直したときは、まだ選んでいない最初の場所へ
                    active = Math.min(built.length, builderLength());
                    applyBuilder();
                });
                return button;
            }),
        );
    }

    // 組み立てた進行を入力欄に入れて、カード・鍵盤・再生に反映する
    function applyBuilder(): void {
        input.value = namesOf(built, builderStyle()).join(" → ");
        rebuild();
        renderBuilder();
    }

    function restartBuilder(): void {
        built = [startChord()];
        active = 1;
        applyBuilder();
    }

    startRoot.addEventListener("change", restartBuilder);
    document.querySelectorAll<HTMLInputElement>('input[name="chord-start-kind"]').forEach((radio) => radio.addEventListener("change", restartBuilder));
    document.querySelectorAll<HTMLInputElement>('input[name="chord-length"]').forEach((radio) =>
        radio.addEventListener("change", () => {
            built = built.slice(0, builderLength());
            active = Math.min(built.length, builderLength());
            applyBuilder();
        }),
    );
    document.querySelectorAll<HTMLInputElement>('input[name="chord-style"]').forEach((radio) => radio.addEventListener("change", applyBuilder));
    element<HTMLButtonElement>("chord-undo").addEventListener("click", () => {
        if (built.length > 1) {
            built.pop();
        }
        active = built.length;
        applyBuilder();
    });
    element<HTMLButtonElement>("chord-reset").addEventListener("click", restartBuilder);

    // ---------- 再生 ----------
    let audio: ChordAudio | null = null;
    let playing = false;
    let timer: number | undefined;
    let suspendTimer: number | undefined;
    let nextTime = 0;
    let step = 0;
    // 画面を光らせる時刻（音の予約は先に進むため、鳴る時刻になってから光らせる）
    let highlightQueue: { time: number; index: number }[] = [];

    async function ready(): Promise<ChordAudio> {
        audio ??= new ChordAudio();
        clearTimeout(suspendTimer);
        await audio.context.resume();
        return audio;
    }

    // 鳴らし終わったら、電池を使わないよう AudioContext を休ませる
    function suspendLater(): void {
        clearTimeout(suspendTimer);
        suspendTimer = window.setTimeout(() => {
            if (!playing) {
                void audio?.context.suspend();
            }
        }, SUSPEND_DELAY_MS);
    }

    function applyAmbience(): void {
        audio?.setAmbience(playing && toggles.rain.checked, playing && toggles.crackle.checked);
    }

    function scheduleStep(engine: ChordAudio, time: number): void {
        if (voicings.length === 0) {
            return;
        }
        const settings = readSettings();
        const beat = 60 / settings.bpm;
        const eighth = beat / 2;
        const plan = planStep(step, voicings.length, settings.bars, settings.pattern);
        const voicing = voicings[plan.chordIndex]!;
        const at = time + plan.swing * eighth;
        if (plan.chordStart) {
            highlightQueue.push({ time, index: plan.chordIndex });
        }
        for (const { velocity, beats } of plan.chords) {
            engine.chord(voicing.upper, at, beats * beat, velocity);
        }
        if (plan.bassBeats !== null && settings.bass) {
            engine.bass(voicing.bass, at, plan.bassBeats * beat);
        }
        if (settings.beat) {
            if (plan.kick) {
                engine.kick(at);
            }
            if (plan.brush) {
                engine.brush(at);
            }
            engine.hat(at, plan.hatStrong);
        }
        // 雨粒は 8 分ごとに 6 割の確率で、ばらばらのタイミングで落とす
        if (settings.rain && Math.random() < 0.6) {
            engine.raindrop(time + Math.random() * eighth);
        }
    }

    function tick(): void {
        if (audio === null) {
            return;
        }
        const now = audio.currentTime;
        // 裏にあったタブが戻ったときなど、予約が遅れていたら、まとめて鳴らさずに今から続ける
        if (nextTime < now) {
            nextTime = now + 0.05;
        }
        const lookahead = document.hidden ? HIDDEN_LOOKAHEAD_SECONDS : LOOKAHEAD_SECONDS;
        while (nextTime < now + lookahead) {
            scheduleStep(audio, nextTime);
            nextTime += 30 / Number(bpmInput.value);
            step++;
        }
    }

    function drawLoop(): void {
        if (!playing || audio === null) {
            return;
        }
        while (highlightQueue.length > 0 && highlightQueue[0]!.time <= audio.currentTime) {
            current = highlightQueue.shift()!.index;
            highlight(current);
        }
        requestAnimationFrame(drawLoop);
    }

    function updatePlayButtons(): void {
        playButtons.forEach((button) => {
            button.textContent = playing ? "■ 止める" : "▶ 鳴らす";
            button.setAttribute("aria-pressed", String(playing));
        });
    }

    async function start(): Promise<void> {
        // 準備を待つ間にもう一度押されても、二重に鳴らさない（止めるほうに働く）
        playing = true;
        updatePlayButtons();
        const engine = await ready();
        if (!playing) {
            return;
        }
        step = 0;
        highlightQueue = [];
        nextTime = engine.currentTime + 0.08;
        applyAmbience();
        tick();
        timer = window.setInterval(tick, TICK_MS);
        drawLoop();
    }

    function stop(): void {
        playing = false;
        clearInterval(timer);
        highlightQueue = [];
        applyAmbience();
        suspendLater();
        updatePlayButtons();
    }

    // 止めているときに、カードのコードだけを鳴らす
    async function preview(index: number): Promise<void> {
        if (playing) {
            return;
        }
        const voicing = voicings[index];
        if (voicing === undefined) {
            return;
        }
        const engine = await ready();
        const time = engine.currentTime + 0.03;
        engine.chord(voicing.upper, time, 1.8, 0.95);
        if (toggles.bass.checked) {
            engine.bass(voicing.bass, time, 1.8);
        }
        current = index;
        highlight(index);
        suspendLater();
    }

    // ---------- 操作 ----------
    restore();
    input.addEventListener("input", rebuild);
    barsSelect.addEventListener("change", save);
    patternSelect.addEventListener("change", save);
    transposeSelect.addEventListener("change", rebuild);
    bpmInput.addEventListener("input", () => {
        bpmValue.textContent = bpmInput.value;
        save();
    });
    toggles.beat.addEventListener("change", save);
    toggles.bass.addEventListener("change", save);
    toggles.rain.addEventListener("change", () => {
        applyAmbience();
        save();
    });
    toggles.crackle.addEventListener("change", () => {
        applyAmbience();
        save();
    });
    playButtons.forEach((button) =>
        button.addEventListener("click", () => {
            if (playing) {
                stop();
            } else {
                void start();
            }
        }),
    );
    setUpCopyButtons();
    rebuild();
    // 組み立てる欄は、操作するまで入力欄（前回の続き）を書きかえない
    renderBuilder();
});
