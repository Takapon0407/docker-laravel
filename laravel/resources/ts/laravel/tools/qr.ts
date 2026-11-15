import { QR_BORDER, qrSvg, tryQrPath, wifiPayload, wifiProblem, type QrEcc, type QrPath, type WifiSecurity, type WifiSettings } from "@/lib/qr";

const SVG_NS = "http://www.w3.org/2000/svg";
const TOO_LONG = "長すぎて QR コードに入りません。短くするか、読み取りやすさを「低」にしてみてください。";

document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("qr-input") as HTMLTextAreaElement;
    const textFields = document.getElementById("qr-text-fields") as HTMLElement;
    const wifiFields = document.getElementById("qr-wifi-fields") as HTMLElement;
    const ssid = document.getElementById("qr-wifi-ssid") as HTMLInputElement;
    const password = document.getElementById("qr-wifi-password") as HTMLInputElement;
    const passwordToggle = document.getElementById("qr-wifi-password-toggle") as HTMLButtonElement;
    const security = document.getElementById("qr-wifi-security") as HTMLSelectElement;
    const hidden = document.getElementById("qr-wifi-hidden") as HTMLInputElement;
    const wifiNote = document.getElementById("qr-wifi-note") as HTMLElement;
    const error = document.getElementById("qr-error") as HTMLElement;
    const image = document.getElementById("qr-image") as unknown as SVGSVGElement;
    const empty = document.getElementById("qr-empty") as HTMLElement;
    const info = document.getElementById("qr-info") as HTMLElement;
    const pngSize = document.getElementById("qr-png-size") as HTMLSelectElement;
    const savePng = document.getElementById("qr-save-png") as HTMLButtonElement;
    const saveSvg = document.getElementById("qr-save-svg") as HTMLButtonElement;
    let current: QrPath | null = null;

    const checked = (name: string): string | undefined => document.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value;
    const isWifi = (): boolean => checked("qr-mode") === "wifi";

    // QR コードにする文字と、知らせること（つながらない設定など）。まだ何も入っていなければ null
    function payload(): { text: string; problem: string | null } | null {
        if (!isWifi()) {
            return input.value === "" ? null : { text: input.value, problem: null };
        }
        const settings: WifiSettings = { ssid: ssid.value, password: password.value, security: security.value as WifiSecurity, hidden: hidden.checked };
        if (settings.ssid === "" && settings.password === "") {
            return null;
        }
        return { text: wifiPayload(settings), problem: wifiProblem(settings) };
    }

    function render(): void {
        const wifi = isWifi();
        textFields.hidden = wifi;
        wifiFields.hidden = !wifi;
        wifiNote.hidden = !wifi;
        password.disabled = security.value === "nopass";
        passwordToggle.disabled = password.disabled;
        empty.textContent = wifi ? "ネットワーク名とパスワードを入れると、ここに表示します" : "URL や文章を入れると、ここに表示します";

        const next = payload();
        current = next === null ? null : tryQrPath(next.text, (checked("qr-ecc") ?? "M") as QrEcc);
        const message = next === null ? null : current === null ? TOO_LONG : next.problem;
        error.hidden = message === null;
        error.textContent = message ?? "";
        image.toggleAttribute("hidden", current === null);
        empty.hidden = current !== null;
        savePng.disabled = current === null;
        saveSvg.disabled = current === null;
        if (current === null || next === null) {
            image.replaceChildren();
            info.textContent = "";
            return;
        }
        image.setAttribute("viewBox", `0 0 ${current.size} ${current.size}`);
        image.setAttribute("aria-label", wifi ? `Wi-Fi「${ssid.value}」につなぐ QR コード` : "QR コード");
        const background = document.createElementNS(SVG_NS, "rect");
        background.setAttribute("width", String(current.size));
        background.setAttribute("height", String(current.size));
        background.setAttribute("fill", "#fff");
        const modules = document.createElementNS(SVG_NS, "path");
        modules.setAttribute("d", current.d);
        modules.setAttribute("fill", "#000");
        image.replaceChildren(background, modules);
        const cells = current.size - QR_BORDER * 2;
        info.textContent = `型番 ${current.version}（${cells} × ${cells} マス）・${new TextEncoder().encode(next.text).length.toLocaleString()} バイト`;
    }

    const filename = (extension: string): string => `${isWifi() ? "wifi-qr-code" : "qr-code"}.${extension}`;

    // 1 マスを整数のピクセルにして、ぼやけないように描く（選んだ大きさに近い、それ以下の大きさになる）
    savePng.addEventListener("click", () => {
        if (current === null) {
            return;
        }
        const moduleSize = Math.max(1, Math.floor(Number(pngSize.value) / current.size));
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = current.size * moduleSize;
        const context = canvas.getContext("2d")!;
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.scale(moduleSize, moduleSize);
        context.fillStyle = "#000";
        context.fill(new Path2D(current.d));
        const name = filename("png");
        canvas.toBlob((blob) => {
            if (blob !== null) {
                download(blob, name);
            }
        }, "image/png");
    });

    saveSvg.addEventListener("click", () => {
        if (current !== null) {
            download(new Blob([qrSvg(current)], { type: "image/svg+xml" }), filename("svg"));
        }
    });

    passwordToggle.addEventListener("click", () => {
        const show = password.type === "password";
        password.type = show ? "text" : "password";
        passwordToggle.textContent = show ? "隠す" : "表示";
        passwordToggle.setAttribute("aria-pressed", String(show));
    });

    for (const field of [input, ssid, password]) {
        field.addEventListener("input", render);
    }
    for (const field of [security, hidden]) {
        field.addEventListener("change", render);
    }
    document.querySelectorAll<HTMLInputElement>('input[name="qr-ecc"], input[name="qr-mode"]').forEach((radio) => radio.addEventListener("change", render));
    render();
});

function download(blob: Blob, filename: string): void {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    // ダウンロードが始まるまで待ってから片づける
    setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
}
