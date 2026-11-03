// 投稿に、電話番号・メールアドレス・郵便番号のようなものが入っていないかを調べる（ブラウザの中だけで使う）
// うっかり書いてしまうのを防ぐための補助で、すべての書き方を見つけられるわけではない（氏名・住所は文章だけでは見分けにくいので調べない）

export type PersonalInfoKind = "phone" | "email" | "postal";

export const PERSONAL_INFO_LABELS: Record<PersonalInfoKind, string> = {
    phone: "電話番号",
    email: "メールアドレス",
    postal: "郵便番号",
};

// 全角の数字・記号を半角にそろえる（０９０－１２３４ のような書き方も見つけるため）
function normalize(text: string): string {
    return text
        .replace(/[０-９Ａ-Ｚａ-ｚ＠．＿＋]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
        .replace(/[－‐‑–—―ー−]/g, "-")
        .replace(/[（]/g, "(")
        .replace(/[）]/g, ")")
        .replace(/　/g, " ");
}

export function detectPersonalInfo(text: string): PersonalInfoKind[] {
    const normalized = normalize(text);
    const found = new Set<PersonalInfoKind>();

    // 0 から始まり、数字が 10〜11 桁の並び（090-1234-5678 / 03(1234)5678 / 0312345678）、+81 から始まる国際の書き方
    for (const match of normalized.matchAll(/(?<![\d-])(?:\+81[-\s]?|0)\d[\d\-\s()]{6,14}\d(?![\d-])/g)) {
        const digits = match[0].replace(/\D/g, "");
        const national = match[0].startsWith("+81") ? `0${digits.slice(2)}` : digits;
        if (national.length === 10 || national.length === 11) {
            found.add("phone");
        }
    }
    if (/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.test(normalized)) {
        found.add("email");
    }
    // 〒123-4567 / 〒1234567 / 123-4567（ほかの数字の並びの一部は除く）
    if (/〒\s*\d{3}-?\d{4}(?!\d)|(?<![\d-])\d{3}-\d{4}(?![\d-])/.test(normalized)) {
        found.add("postal");
    }
    return (["phone", "email", "postal"] as const).filter((kind) => found.has(kind));
}
