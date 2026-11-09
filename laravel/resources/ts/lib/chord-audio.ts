// 雨音コードプレイヤーの音（Web Audio API で合成する。音の素材ファイルは使わない）
// 時刻は AudioContext の currentTime（秒）で指定する。ブラウザは操作のあとでないと音を出せないため、
// AudioContext は最初に再生・試聴のボタンを押したときに作る

const midiToFrequency = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

// ストラム：和音の各音をこの秒数ずつずらす
const STRUM_SECONDS = 0.014;

export class ChordAudio {
    readonly context: AudioContext;
    private readonly master: GainNode;
    private readonly instrument: AudioNode;
    private readonly drums: AudioNode;
    private readonly noise: AudioBuffer;
    private readonly rainGain: GainNode;
    private readonly crackleGain: GainNode;

    constructor() {
        const context = new AudioContext();
        this.context = context;

        this.master = context.createGain();
        this.master.gain.value = 0.75;
        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -16;
        compressor.ratio.value = 3;
        this.master.connect(compressor).connect(context.destination);

        // エレピの通り道：ローパス → トレモロ → そのまま ＋ リバーブ
        const lowpass = new BiquadFilterNode(context, { type: "lowpass", frequency: 3200 });
        const tremolo = new GainNode(context, { gain: 0.85 });
        const lfo = new OscillatorNode(context, { frequency: 4.2 });
        lfo.connect(new GainNode(context, { gain: 0.12 })).connect(tremolo.gain);
        lfo.start();
        const reverb = new ConvolverNode(context, { buffer: this.impulseResponse(2.4) });
        lowpass.connect(tremolo);
        tremolo.connect(this.master);
        tremolo.connect(reverb).connect(new GainNode(context, { gain: 0.28 })).connect(this.master);
        this.instrument = lowpass;

        const drums = new BiquadFilterNode(context, { type: "lowpass", frequency: 5000 });
        drums.connect(this.master);
        this.drums = drums;

        // ホワイトノイズ（雨音・ドラム・雨粒の素材）
        this.noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
        const noiseData = this.noise.getChannelData(0);
        for (let i = 0; i < noiseData.length; i++) {
            noiseData[i] = Math.random() * 2 - 1;
        }

        // 雨音：ノイズをループさせ、高すぎる音と低すぎる音を削る
        this.rainGain = new GainNode(context, { gain: 0 });
        const rain = new AudioBufferSourceNode(context, { buffer: this.noise, loop: true });
        rain.connect(new BiquadFilterNode(context, { type: "highpass", frequency: 350 }))
            .connect(new BiquadFilterNode(context, { type: "lowpass", frequency: 2600 }))
            .connect(this.rainGain)
            .connect(this.master);
        rain.start();

        // レコードノイズ：まばらなプチッという音と、かすかなサーという音を 3 秒ループさせる
        const crackleBuffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
        const crackleData = crackleBuffer.getChannelData(0);
        for (let i = 0; i < crackleData.length; i++) {
            const pop = Math.random() < 0.0006 ? (Math.random() * 2 - 1) * (0.3 + Math.random() * 0.7) : 0;
            crackleData[i] = pop + (Math.random() * 2 - 1) * 0.004;
        }
        this.crackleGain = new GainNode(context, { gain: 0 });
        const crackle = new AudioBufferSourceNode(context, { buffer: crackleBuffer, loop: true });
        crackle.connect(new BiquadFilterNode(context, { type: "lowpass", frequency: 4500 })).connect(this.crackleGain).connect(this.master);
        crackle.start();
    }

    get currentTime(): number {
        return this.context.currentTime;
    }

    // 減衰していくノイズで、部屋の響き（リバーブ）を作る
    private impulseResponse(seconds: number): AudioBuffer {
        const length = Math.floor(this.context.sampleRate * seconds);
        const buffer = this.context.createBuffer(2, length, this.context.sampleRate);
        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
            }
        }
        return buffer;
    }

    // 雨音とレコードノイズを、なめらかに出したり消したりする
    setAmbience(rain: boolean, crackle: boolean): void {
        const time = this.context.currentTime;
        this.rainGain.gain.setTargetAtTime(rain ? 0.07 : 0, time, 0.3);
        this.crackleGain.gain.setTargetAtTime(crackle ? 0.35 : 0, time, 0.3);
    }

    // エレピ（ローズピアノ風）の 1 音：FM 合成。変調を弱めていき、高い音を一瞬だけ足して「チーン」というアタックにする
    private electricPiano(midi: number, time: number, seconds: number, velocity: number): void {
        const context = this.context;
        const frequency = midiToFrequency(midi);
        const end = time + Math.max(seconds, 0.15);

        const carrier = new OscillatorNode(context, { frequency });
        const modulator = new OscillatorNode(context, { frequency });
        const modulation = context.createGain();
        modulation.gain.setValueAtTime(frequency * 1.3 * velocity, time);
        modulation.gain.exponentialRampToValueAtTime(frequency * 0.15 * velocity + 0.01, time + 0.9);
        modulator.connect(modulation).connect(carrier.frequency);

        const tine = new OscillatorNode(context, { frequency: frequency * 7.03 });
        const tineGain = context.createGain();
        tineGain.gain.setValueAtTime(0.018 * velocity, time);
        tineGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);

        const amplitude = context.createGain();
        amplitude.gain.setValueAtTime(0.0001, time);
        amplitude.gain.exponentialRampToValueAtTime(0.15 * velocity, time + 0.006);
        amplitude.gain.setTargetAtTime(0.055 * velocity, time + 0.01, 0.6);
        // 音を離すとき（ノートごとに分けて、ほかの音に影響しないようにする）
        const release = context.createGain();
        release.gain.setValueAtTime(1, end);
        release.gain.setTargetAtTime(0, end, 0.12);

        carrier.connect(amplitude);
        tine.connect(tineGain).connect(amplitude);
        amplitude.connect(release).connect(this.instrument);
        for (const oscillator of [carrier, modulator, tine]) {
            oscillator.start(time);
            oscillator.stop(end + 0.9);
        }
    }

    // 和音を少しずつずらして（ストラム）、強さも少しばらつかせて鳴らす
    chord(notes: readonly number[], time: number, seconds: number, velocity: number): void {
        notes.forEach((note, i) => {
            const offset = i * STRUM_SECONDS;
            this.electricPiano(note, time + offset, seconds - offset, velocity * (0.9 + Math.random() * 0.15));
        });
    }

    // ベース：サイン波に三角波を少し混ぜ、こもらせる
    bass(midi: number, time: number, seconds: number): void {
        const context = this.context;
        const frequency = midiToFrequency(midi);
        const end = time + seconds;
        const sine = new OscillatorNode(context, { type: "sine", frequency });
        const triangle = new OscillatorNode(context, { type: "triangle", frequency });
        const lowpass = new BiquadFilterNode(context, { type: "lowpass", frequency: 650 });
        const amplitude = context.createGain();
        amplitude.gain.setValueAtTime(0.0001, time);
        amplitude.gain.exponentialRampToValueAtTime(0.32, time + 0.012);
        amplitude.gain.setTargetAtTime(0.2, time + 0.02, 0.4);
        const release = context.createGain();
        release.gain.setValueAtTime(1, end);
        release.gain.setTargetAtTime(0, end, 0.06);
        sine.connect(lowpass);
        triangle.connect(new GainNode(context, { gain: 0.25 })).connect(lowpass);
        lowpass.connect(amplitude).connect(release).connect(this.master);
        for (const oscillator of [sine, triangle]) {
            oscillator.start(time);
            oscillator.stop(end + 0.5);
        }
    }

    // ノイズを短く鳴らす（ドラム・雨粒）
    private noiseHit(time: number, type: BiquadFilterType, frequency: number, q: number, gain: number, decay: number): void {
        const context = this.context;
        const source = new AudioBufferSourceNode(context, { buffer: this.noise });
        const envelope = context.createGain();
        envelope.gain.setValueAtTime(gain, time);
        envelope.gain.exponentialRampToValueAtTime(0.0001, time + decay);
        source.connect(new BiquadFilterNode(context, { type, frequency, Q: q })).connect(envelope).connect(this.drums);
        // 毎回ノイズの違うところを使い、同じ音の繰り返しに聞こえないようにする
        source.start(time, Math.random() * 1.5);
        source.stop(time + decay + 0.05);
    }

    // キック：サイン波の高さを急に下げる
    kick(time: number): void {
        const oscillator = new OscillatorNode(this.context);
        oscillator.frequency.setValueAtTime(110, time);
        oscillator.frequency.exponentialRampToValueAtTime(42, time + 0.14);
        const envelope = this.context.createGain();
        envelope.gain.setValueAtTime(0.55, time);
        envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.38);
        oscillator.connect(envelope).connect(this.drums);
        oscillator.start(time);
        oscillator.stop(time + 0.4);
    }

    brush(time: number): void {
        this.noiseHit(time, "bandpass", 1900, 0.7, 0.14, 0.24);
    }

    hat(time: number, strong: boolean): void {
        this.noiseHit(time, "highpass", 7500, 0.7, strong ? 0.045 : 0.025, 0.05);
    }

    // 雨粒：高さがばらばらの、ごく短いノイズ
    raindrop(time: number): void {
        this.noiseHit(time, "bandpass", 2200 + Math.random() * 3500, 8, 0.03 + Math.random() * 0.03, 0.03);
    }
}
