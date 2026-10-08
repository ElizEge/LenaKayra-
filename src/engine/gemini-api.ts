/*
 * AiFotofilm V20.2 — Gemini API extraction candidate.
 * Source: aifotofilm_v20_production_bible.tsx (development)
 * Original API body is unchanged; only top-level 'export' keywords were added.
 * NOT WIRED into the Canvas entrypoint yet. Keep existing TSX intact.
 * Source blob SHA: 23d9146486ed6a22fa22f0b1c093e06c0cb01543
 */

export const API_KEY = "";
export const GEMINI_TEXT_MODEL = "gemini-3-flash-preview";
export const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image";

export const getSavedApiKey = () => {
    try { 
        return localStorage.getItem('ai_fotofilm_gemini_api_key') || API_KEY || ''; 
    } catch { 
        return API_KEY || ''; 
    }
};

export const buildApiUrl = (model: string, method: string) => {
    const key = getSavedApiKey();
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}?key=${key}`;
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. HATA AYIKLAMA VE ÜSTEL GERİ ÇEKİLME (EXPONENTIAL BACKOFF) RETRY MOTORU
// ═══════════════════════════════════════════════════════════════════════════

export const extractApiErrorMessage = async (response: Response) => {
    try {
        const body = await response.json();
        return body?.error?.message || response.statusText || `HTTP ${response.status}`;
    } catch (e) {
        return response.statusText || `HTTP ${response.status}`;
    }
};

export const callApiWithRetry = async (
    url: string, 
    payload: any, 
    retries = 3, 
    delay = 1000, 
    signal: AbortSignal | null = null
) => {
    for (let i = 0; i < retries; i++) {
        if (signal?.aborted) throw new DOMException('İşlem iptal edildi.', 'AbortError');
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal
            });
            if (response.ok) return await response.json();

            // Hız limiti (429) veya sunucu hatalarında (500+) bekle ve tekrar dene
            if (response.status === 429 || response.status >= 500) {
                await new Promise((resolve, reject) => {
                    const t = setTimeout(resolve, delay * Math.pow(2, i));
                    signal?.addEventListener('abort', () => { 
                        clearTimeout(t); 
                        reject(new DOMException('İşlem iptal edildi.', 'AbortError')); 
                    }, { once: true });
                });
                continue;
            }
            const message = await extractApiErrorMessage(response);
            throw new Error(`API Hatası (${response.status}): ${message}`);
        } catch (error: any) {
            if (error.name === 'AbortError') throw error;
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        }
    }
    throw new Error('API yanıt vermedi: yeniden deneme hakkı tükendi.');
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. YARDIMCI VERİ VE SEED DÖNÜŞTÜRÜCÜLERİ
// ═══════════════════════════════════════════════════════════════════════════

export const safeParseGeminiJson = (raw: string) => {
    const cleaned = String(raw || '').replace(/```json/g, '').replace(/```/g, '').trim();
    try { 
        return JSON.parse(cleaned); 
    } catch { 
        throw new Error(`Gemini geçersiz JSON döndürdü: ${cleaned.slice(0, 220)}`); 
    }
};

export const normalizeSeed = (seed: any): number | undefined => {
    if (seed === null || seed === undefined || seed === '') return undefined;
    const n = typeof seed === 'number' ? seed : Number.parseInt(String(seed), 10);
    if (!Number.isFinite(n)) return undefined;
    return Math.max(0, Math.min(2147483647, Math.trunc(n)));
};

// ═══════════════════════════════════════════════════════════════════════════
// 4. GEMINI METİN VE ÇOKLU MODAL (MULTIMODAL) ÇAĞRI FONKSİYONLARI
// ═══════════════════════════════════════════════════════════════════════════

export const callGemini = async (
    prompt: string, 
    isJson = false, 
    systemInstruction = "", 
    signal: AbortSignal | null = null, 
    imageBase64: string | null = null, 
    imageMimeType: string | null = null
) => {
    const parts: any[] = [{ text: prompt }];
    if (imageBase64 && imageMimeType) {
        parts.push({
            inlineData: { mimeType: imageMimeType, data: imageBase64 }
        });
    }

    const payload: any = {
        contents: [{ role: 'user', parts: parts }],
        generationConfig: isJson ? { responseMimeType: "application/json", temperature: 0.7 } : { temperature: 0.7 }
    };
    if (systemInstruction) payload.systemInstruction = { parts: [{ text: systemInstruction }] };

    const data = await callApiWithRetry(buildApiUrl(GEMINI_TEXT_MODEL, 'generateContent'), payload, 3, 1000, signal);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) throw new Error("API yanıtı boş döndü.");

    if (isJson) {
        return safeParseGeminiJson(text);
    }
    return text;
};

export const callGeminiWithImages = async (
    prompt: string, 
    images: Array<{ data: string; mimeType: string }> = [], 
    isJson = false, 
    systemInstruction = "", 
    signal: AbortSignal | null = null
) => {
    const parts: any[] = [{ text: prompt }];
    images.filter(Boolean).forEach(img => {
        if (img?.data && img?.mimeType) {
            parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
        }
    });

    const payload: any = {
        contents: [{ role: 'user', parts }],
        generationConfig: isJson ? { responseMimeType: "application/json", temperature: 0.35 } : { temperature: 0.5 }
    };
    if (systemInstruction) payload.systemInstruction = { parts: [{ text: systemInstruction }] };

    const data = await callApiWithRetry(buildApiUrl(GEMINI_TEXT_MODEL, 'generateContent'), payload, 3, 1000, signal);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("API yanıtı boş döndü.");

    if (isJson) {
        return safeParseGeminiJson(text);
    }
    return text;
};

// ═══════════════════════════════════════════════════════════════════════════
// 5. GÖRSEL BASE64 DÖNÜŞTÜRÜCÜSÜ VE EN-BOY ORANI ANALİZİ
// ═══════════════════════════════════════════════════════════════════════════

export const fetchImageAsBase64 = async (url: string, signal: AbortSignal | null = null) => {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Kimlik referansı yüklenemedi (${response.status}).`);
    const blob = await response.blob();
    const mimeType = blob.type || 'image/png';
    const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(new Error('Kimlik referansı okunamadı.'));
        reader.readAsDataURL(blob);
    });
    return { data, mimeType };
};

export const detectClosestAspectRatio = (imageUrl: string): Promise<string> => {
    return new Promise((resolve) => {
        if (!imageUrl) return resolve('16:9');
        const img = new Image();
        img.onload = () => {
            const w = img.naturalWidth || img.width;
            const h = img.naturalHeight || img.height;
            if (!w || !h) return resolve('16:9');
            const ratio = w / h;
            const targetRatios = [
                { id: '16:9', val: 16 / 9 },
                { id: '9:16', val: 9 / 16 },
                { id: '1:1', val: 1 / 1 },
                { id: '4:5', val: 4 / 5 },
                { id: '21:9', val: 21 / 9 }
            ];
            let closest = targetRatios[0].id;
            let minDiff = Math.abs(ratio - targetRatios[0].val);
            for (let i = 1; i < targetRatios.length; i++) {
                const diff = Math.abs(ratio - targetRatios[i].val);
                if (diff < minDiff) {
                    minDiff = diff;
                    closest = targetRatios[i].id;
                }
            }
            resolve(closest);
        };
        img.onerror = () => resolve('16:9');
        img.src = imageUrl;
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// 6. GÖRSEL ÜRETİMİ (STRICT REAL-RENDER GATE)
// ═══════════════════════════════════════════════════════════════════════════

export const generateImage = async (
    prompt: string, 
    aspectRatio?: string, 
    seed?: any, 
    signal?: AbortSignal | null, 
    baseImageBase64: string | null = null, 
    baseImageMimeType: string | null = null, 
    referenceImages: any[] = []
) => {
    const parts: any[] = [{ text: prompt }];

    // 1) 360° Karakter Kimlik Sayfası referansları (Yüz/Anatomi Kilidi)
    referenceImages.filter(ref => ref?.data && ref?.mimeType).forEach((ref, index) => {
        parts.push({ 
            text: `REFERENCE ${index + 1} — ${ref.label || 'IDENTITY'}: CANONICAL IDENTITY ONLY. ${ref.genderLock ? `SEX / GENDER IDENTITY LOCK: ${ref.genderLock}. ` : ''}Preserve this person's face, facial geometry, apparent age, hair, skin and body proportions. Do NOT copy the reference sheet background, pose, lighting or reference clothing. Scene wardrobe is controlled by the Wardrobe Bible.` 
        });
        parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.data } });
    });

    // 2) Önceki kare / Sekans referansı (Süreklilik Kilidi)
    if (baseImageBase64 && baseImageMimeType) {
        parts.push({ text: 'STORY / EDIT ANCHOR REFERENCE: preserve established scene continuity unless the prompt explicitly changes it.' });
        parts.push({ inlineData: { mimeType: baseImageMimeType, data: baseImageBase64 } });
    }

    const safeRatio = (aspectRatio && aspectRatio !== 'any' && ['16:9', '9:16', '1:1', '4:5', '21:9'].includes(aspectRatio))
        ? aspectRatio
        : '16:9';

    const payload: any = {
        contents: [{ role: 'user', parts: parts }],
        generationConfig: { 
            responseModalities: ["IMAGE"],
            imageConfig: { aspectRatio: safeRatio }
        }
    };
    
    const normalizedSeed = normalizeSeed(seed);
    if (normalizedSeed !== undefined) {
        payload.generationConfig.imageConfig.seed = normalizedSeed;
    }

    const data = await callApiWithRetry(buildApiUrl(GEMINI_IMAGE_MODEL, 'generateContent'), payload, 2, 2000, signal);

    if (data.predictions?.[0]?.raiFilteredReason) {
        throw new Error(`İçerik Filtresi: ${data.predictions[0].raiFilteredReason}`);
    }

    // STRICT REAL-RENDER GATE:
    // Yalnızca Gemini image endpoint'inden dönen gerçek raster baytları kabul edilir.
    // SVG, sahte placeholder veya metin yanıtları asla kabul edilmez.
    const part = data.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data);
    if (part) {
        const mime = String(part.inlineData.mimeType || '').toLowerCase();
        const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
        if (!allowed.includes(mime)) {
            throw new Error(`Gemini gerçek raster görsel döndürmedi. MIME: ${mime || 'bilinmiyor'}`);
        }
        const bytes = String(part.inlineData.data || '');
        if (bytes.length < 1000) {
            throw new Error("Gemini görsel verisi geçersiz veya aşırı küçük döndü.");
        }
        return `data:${mime};base64,${bytes}`;
    }

    const predictionBytes = data.predictions?.[0]?.bytesBase64Encoded;
    if (predictionBytes) {
        const bytes = String(predictionBytes);
        if (bytes.length < 1000) {
            throw new Error("Gemini prediction görsel verisi geçersiz veya aşırı küçük döndü.");
        }
        return `data:image/png;base64,${bytes}`;
    }

    const finishReason = data.candidates?.[0]?.finishReason;
    const textReply = data.candidates?.[0]?.content?.parts?.find((p: any) => typeof p?.text === 'string')?.text;
    throw new Error(
        `Gemini gerçek görsel döndürmedi${finishReason ? ` (finishReason: ${finishReason})` : ''}.` +
        `${textReply ? ` API metin yanıtı: ${String(textReply).slice(0, 240)}` : ''}`
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 7. YÖNETMEN VE SÜREKLİLİK MOTORU SİSTEM KOMUTLARI (SYSTEM PROMPTS)
// ═══════════════════════════════════════════════════════════════════════════

