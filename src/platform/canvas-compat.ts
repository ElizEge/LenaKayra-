/** Extracted Canvas compatibility shim. Must execute before application state initialization. */

/* ╔══════════════════════════════════════════════════════════════════════════╗
   ║  GEMINI CANVAS · PREVIEW GÜVENLİK KATMANI (Sandbox Uyumlu)               ║
   ║  iframe içi localStorage ve pano hatalarını izole eder.                 ║
   ╚══════════════════════════════════════════════════════════════════════════╝ */
(() => {
    try {
        const w: any = typeof window !== 'undefined' ? window : {};
        const mem = new Map<string, string>();
        let real: any = null;
        try {
            const s = w.localStorage;
            s.setItem('__canvas_probe__', '1');
            s.removeItem('__canvas_probe__');
            real = s;
        } catch (e) { real = null; }

        const hybrid: any = {
            getItem(k: any) {
                const key = String(k);
                if (mem.has(key)) return mem.get(key) as string;
                try { return real ? real.getItem(key) : null; } catch (e) { return null; }
            },
            setItem(k: any, v: any) {
                const key = String(k), val = String(v);
                if (real) {
                    try { real.setItem(key, val); mem.delete(key); return; } catch (e) { /* kotada belleğe düş */ }
                }
                mem.set(key, val);
            },
            removeItem(k: any) {
                const key = String(k);
                mem.delete(key);
                try { real && real.removeItem(key); } catch (e) { /* sessiz */ }
            },
            clear() {
                mem.clear();
                try { real && real.clear(); } catch (e) { /* sessiz */ }
            },
            key(i: number) {
                try {
                    const keys = new Set<string>(mem.keys());
                    if (real) for (let n = 0; n < real.length; n++) keys.add(real.key(n));
                    return Array.from(keys)[i] ?? null;
                } catch (e) { return null; }
            },
            get length() {
                try {
                    const keys = new Set<string>(mem.keys());
                    if (real) for (let n = 0; n < real.length; n++) keys.add(real.key(n));
                    return keys.size;
                } catch (e) { return mem.size; }
            }
        };
        try { Object.defineProperty(w, 'localStorage', { value: hybrid, configurable: true, writable: true }); } catch (e) { /* yoksay */ }

        const nav: any = w.navigator;
        const origWrite = nav?.clipboard?.writeText ? nav.clipboard.writeText.bind(nav.clipboard) : null;
        const safeWriteText = async (text: any) => {
            const str = String(text ?? '');
            if (origWrite) { try { await origWrite(str); return; } catch (e) { /* yedeğe geç */ } }
            try {
                const ta = document.createElement('textarea');
                ta.value = str;
                ta.setAttribute('readonly', '');
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            } catch (e) { /* sessizce geç */ }
        };
        try { Object.defineProperty(nav, 'clipboard', { value: { writeText: safeWriteText, readText: async () => '' }, configurable: true }); } catch (e) { /* yoksay */ }
    } catch (e) { /* katman hiçbir koşulda uygulamayı durdurmaz */ }
})();

