import React, { useState, useRef, useEffect, useCallback } from 'react';

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
    } catch (e) { /* katman güvenli modda devam eder */ }
})();

const API_KEY = "";
const GEMINI_TEXT_MODEL = "gemini-3-flash-preview";
const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image";

const getSavedApiKey = () => {
    try { 
        return localStorage.getItem('ai_fotofilm_gemini_api_key') || API_KEY || ''; 
    } catch { 
        return API_KEY || ''; 
    }
};

const buildApiUrl = (model: string, method: string) => {
    const key = getSavedApiKey();
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}?key=${key}`;
};

const extractApiErrorMessage = async (response: Response) => {
    try {
        const body = await response.json();
        return body?.error?.message || response.statusText || `HTTP ${response.status}`;
    } catch (e) {
        return response.statusText || `HTTP ${response.status}`;
    }
};

const callApiWithRetry = async (
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

const safeParseGeminiJson = (raw: string) => {
    const cleaned = String(raw || '').replace(/```json/g, '').replace(/```/g, '').trim();
    try { 
        return JSON.parse(cleaned); 
    } catch { 
        throw new Error(`Gemini geçersiz JSON döndürdü: ${cleaned.slice(0, 220)}`); 
    }
};

const normalizeSeed = (seed: any): number | undefined => {
    if (seed === null || seed === undefined || seed === '') return undefined;
    const n = typeof seed === 'number' ? seed : Number.parseInt(String(seed), 10);
    if (!Number.isFinite(n)) return undefined;
    return Math.max(0, Math.min(2147483647, Math.trunc(n)));
};

const callGemini = async (
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

const callGeminiWithImages = async (
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

const fetchImageAsBase64 = async (url: string, signal: AbortSignal | null = null) => {
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

const detectClosestAspectRatio = (imageUrl: string): Promise<string> => {
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

const generateImage = async (
    prompt: string, 
    aspectRatio?: string, 
    seed?: any, 
    signal?: AbortSignal | null, 
    baseImageBase64: string | null = null, 
    baseImageMimeType: string | null = null, 
    referenceImages: any[] = []
) => {
    const parts: any[] = [{ text: prompt }];

    referenceImages.filter(ref => ref?.data && ref?.mimeType).forEach((ref, index) => {
        parts.push({ 
            text: `REFERENCE ${index + 1} — ${ref.label || 'IDENTITY'}: CANONICAL IDENTITY ONLY. ${ref.genderLock ? `SEX / GENDER IDENTITY LOCK: ${ref.genderLock}. ` : ''}Preserve this person's face, facial geometry, apparent age, hair, skin and body proportions. Do NOT copy the reference sheet background, pose, lighting or reference clothing. Scene wardrobe is controlled by the Wardrobe Bible.` 
        });
        parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.data } });
    });

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

const J = 'Return JSON only.';
const SC = 'score MUST be an integer from 0 to 100 (100 = perfect continuity, 80+ = consistent). Never use a 0-10 or 0-1 scale.';

const SYS = {
    plan: `Sen AiFotofilm V19 Hikâye İlham ve Anlık Sahne Yönetmenisin. Yalnızca geçerli JSON döndür. Karakter kimliğini, cinsiyet kilidini ve kıyafet sürekliliğini koru. JSON: {"title":"","scene_summary_tr":"","action_tr":"","location":"","time":"","weather":"","camera_setup":"any","camera_angle":"any","aspect_ratio":"16:9","director_intent_tr":"","continuity_notes_tr":"","wardrobe_state":{"characterId":{"state_id":"","outfit_en":"","hair_makeup_en":"","props_en":""}},"story_state":{"previous_action":"","current_action":"","active_props":[]}}`,
    pre: `You are AiFotofilm Continuity Preflight Analyst. Audit the image prompt BEFORE rendering against the cast sex locks, DNA, the OUTFIT LOCK and the scene bible: find contradictions, missing locks, outfit drift, impossible light/time/weather. If repair is required, return a corrected COMPLETE but CONCISE English render prompt. Preserve every essential identity, gender, wardrobe, blocking, prop, environment, time, lighting, camera-side, action-axis and screen-direction lock, but NEVER append raw AI BLOCKING, SCENE MAP, CONTINUITY MANIFEST or other JSON objects to the render prompt. Avoid repeating the same fact in multiple sections. ${J} ${SC} {"score":0,"status":"ready|minor_drift","issues_tr":[""],"fixed_prompt":""}`,
    img: `Sen AiFotofilm Post-Render Continuity Director'sın. Üretilen görseli prompt, kadro, OUTFIT LOCK ve (varsa) referans kare ile karşılaştır: yüz/kimlik, cinsiyet kilidi, kıyafet, mekan, ışık, el/anatomi. Kamera açısı/kadraj/poz farkı beklenen bir durumdur, ceza verme; yalnızca gerçek kimlik, cinsiyet, kıyafet ve anatomi hatalarını puanla. ${J} ${SC} {"score":0,"status":"consistent|minor_drift","issues_tr":[""],"fix_prompt_en":""}`,
    batch: `You are AiFotofilm Multi-Shot Continuity Auditor. Compare every shot with the MASTER (image 1). Judge ONLY: face/identity, sex/gender, outfit, hair and overall art style / light mood. Different camera angle, framing, pose, composition, story progression and location changes that follow the story are EXPECTED and must NOT be penalised. Give fix_en only for real identity / outfit / anatomy errors, otherwise leave it empty. ${J} ${SC} {"shots":[{"id":"S1","score":0,"status":"consistent|minor_drift","issue_tr":"","fix_en":""}]}`,
    refine: `You are AiFotofilm Locked Refinement Director. Apply only the requested change; keep cast, outfits (OUTFIT LOCK), location, light and composition identical. Return only the complete corrected English image prompt.`,
    cont: `You are AiFotofilm Multi-Cam Continuity Planner. ${J} {"blocking_tr":"","action_axis_tr":"","continuity_lock_en":""}`,
    edit: `You are AiFotofilm Image Lab Edit Compiler. Convert the user's edit (any language) into ONE English edit prompt for the attached image; preserve identity, outfits and composition except what is explicitly changed. Return only the English edit prompt.`,
    analyze: `Analyze the supplied image and reconstruct a detailed English photographic MASTER PROMPT (cast, outfit, location, camera, lens, light). Return only the prompt.`,
    cut: `You are AiFotofilm Master Retouch Director. Study the image and choose the single most valuable cinematic improvement (light, grade, skin realism, background, composition) without changing identity. ${J} {"critique_tr":"","edit_prompt_en":""}`,
    labCrit: `Sen Image Lab Continuity Analyst'sin. Image 1 = ÖNCE, image 2 = SONRA. Kimlik, kıyafet ve istenmeyen değişiklikleri kontrol et. ${J} ${SC} {"score":0,"status":"consistent|minor_drift","issues_tr":[""],"fix_prompt_en":""}`,
    next: `You are AiFotofilm Continuity Director. From the attached previous frame, the scenario, the next action and camera motion, write ONE English image prompt for the next frame: same people, same outfits (respect OUTFIT LOCK exactly), same location and light; advance the action naturally. Return only the prompt.`,
    story: `You are a Professional Storyboard Director with a continuity engine. Plan consecutive shots as a real STORY progression across time: each shot is a DIFFERENT moment with its own action and MUST use a clearly different shot size, camera angle, lens and composition from the previous shot (never repeat the same framing). Location may change when the story moves on. Keep identities, outfits, art style and light mood continuous. Create ONE continuity manifest (outfits, location, light, props) that every shot must obey. ${J} {"estimated_duration":"18 sec","manifest_en":"","shots":[{"order":1,"title":"","story_beat":"","action":"","shot_size":"","angle":"","lens":"","movement":"","duration":2.5,"image_prompt_en":"self-contained detailed prompt with cast DNA, outfit, location, light"}]}`,
    nextAct: `You are AiFotofilm Story Director. Look at the attached frame and the scenario and propose the single most natural NEXT action beat (what happens in the next few seconds) as ONE short Turkish sentence. Keep the same people and setting. Return only the sentence.`,
    video: `You are AiFotofilm Video Preparation Director. Write ONE English image-to-video prompt for a video platform: subject action, camera movement, physics and continuity; with two frames, move from the first to the second. Return only the prompt.`,
    inf: `You are a Social Media Director for an AI influencer. Respect the profile (niche, personality, city, visual identity) and trend notes. If several characters are given they appear together in every shot (duo/group content) and every shot prompt must name all of them with their own look. ${J} {"caption":"","hashtags":[""],"shots":[{"title":"","prompt":""}]}`,
    ideas: `You are a Social Media Strategist. Propose 5 fresh, specific content topics (Turkish) for this influencer. ${J} {"ideas":[""]}`,
    scn: `Summarize the image prompt as a short Turkish scene summary (scenario) of 2-3 sentences. Return only the summary.`,
    core: `You are AiFotofilm Production Continuity Architect. Convert the scene plan into structured production state. Never change character identity, sex/gender, wardrobe facts or story intent. ${J} {"blocking":{"summary_tr":"","characters":[{"id":"","frame_position":"","depth":"","body_orientation":"","eyeline":"","action":""}],"action_axis":"","camera_side":"","screen_direction":""},"scene_map":{"people_count":0,"foreground":[],"midground":[],"background":[],"props":[{"name":"","position":"","owner":""}],"environment_anchors":[{"name":"","position":""}],"light_direction":"","action_axis":"","camera_side":""},"continuity_manifest":{"cast":[],"identity":{},"wardrobe":{},"hair":{},"props":{},"environment":"","time":"","weather":"","lighting":"","blocking":{},"action_axis":"","screen_direction":"","story_state":{}}}`
};

const normV = (v: any, keepStatus = false) => {
    if (!v || typeof v !== 'object') return v;
    let n = Number(v.score);
    if (!Number.isFinite(n)) return v;
    if (n > 0 && n <= 1) n *= 100; else if (n > 1 && n <= 10) n *= 10;
    n = Math.round(Math.max(0, Math.min(100, n)));
    return { ...v, score: n, ...(keepStatus ? {} : { status: n >= 80 ? 'consistent' : 'minor_drift' }) };
};

const auditPromptService = async (
    prompt: string, 
    castInfoText: string, 
    lockText: string, 
    bibleContext: any, 
    sig: AbortSignal | null
) => {
    return callGemini(
        `CAST:\n${castInfoText}\nOUTFIT LOCK:\n${lockText}\nSCENE BIBLE: ${JSON.stringify(bibleContext)}\nPROMPT:\n${prompt}`, 
        true, 
        SYS.pre, 
        sig
    );
};

const auditImageService = async (
    imageUrl: string, 
    prompt: string, 
    castInfoText: string, 
    lockText: string, 
    sig: AbortSignal | null, 
    refUrl: string | null = null
) => {
    const split64 = (u: string) => { 
        const m = /^data:([^;]+);base64,(.+)$/.exec(u || ''); 
        return m ? { mimeType: m[1], data: m[2] } : null; 
    };
    const toB64 = async (u: string, s: AbortSignal | null) => split64(u) || fetchImageAsBase64(u, s);

    const imgs = [await toB64(imageUrl, sig)];
    if (refUrl) imgs.unshift(await toB64(refUrl, sig));

    return callGeminiWithImages(
        `PROMPT:\n${prompt}\nCAST:\n${castInfoText}\nOUTFIT LOCK: ${lockText}\n${refUrl ? 'Image 1 = reference / previous frame, image 2 = the new frame.' : 'Single image to audit.'}`, 
        imgs, 
        true, 
        SYS.img, 
        sig
    );
};

const Icons = {
    Camera: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>,
    Users: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    Sun: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>,
    Palette: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>,
    Image: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>,
    Wand: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg>,
    Sparkles: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>,
    Download: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>,
    Maximize: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>,
    RotateCcw: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>,
    Trash: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>,
    Clapperboard: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"/><path d="m6.2 5.3 3.1 3.9"/><path d="m12.4 3.4 3.1 4"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>,
    Moon: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>,
    Sunrise: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v6"/><path d="M8.4 10.4 4.6 6.6"/><path d="M2 18h20"/><path d="M15.6 10.4l3.8-3.8"/><path d="M22 22H2"/><path d="M8 18v-2a4 4 0 0 1 8 0v2"/></svg>,
    Plus: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    Key: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>,
    ChevronLeft: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
    ChevronRight: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>,
    ZoomIn: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>,
    ZoomOut: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/></svg>
};

const INITIAL_CHARACTERS = [
    { id: "lena", ad: "Lena", yas: 22, sex: "female", genderLock: "ADULT WOMAN / FEMALE — never male, man or boy", dna: "A 22-year-old elegant female model, porcelain skin, oval face, hazel eyes, natural wavy espresso brown hair", img: "https://raw.githubusercontent.com/ElizEge/LenaKayra-/main/LENA.png", identitySheet: "https://raw.githubusercontent.com/ElizEge/LenaKayra-/main/LENA%20CHARACTER%20IDENTITY%20SHEET.png", identityLocked: true, outfit: "white crop top, light blue denim mini skirt, white sneakers" },
    { id: "kayra", ad: "Kayra", yas: 21, sex: "female", genderLock: "ADULT WOMAN / FEMALE — Kayra must NEVER be rendered as male, man, boy or masculine-presenting male", dna: "A 21-year-old energetic ADULT FEMALE model / young woman, slim athletic feminine build, light skin, bright blue eyes, high bob pastel pink hair", img: "https://raw.githubusercontent.com/ElizEge/LenaKayra-/main/KAYRA.png", identitySheet: "https://raw.githubusercontent.com/ElizEge/LenaKayra-/main/KAYRA%20CHARACTER%20IDENTITY%20SHEET.png", identityLocked: true, outfit: "black crop top, white leather mini skirt, black boots" },
    { id: "metin", ad: "Metin", yas: 40, sex: "male", genderLock: "ADULT MAN / MALE", dna: "A 40-year-old witty male model, solid athletic build, light brown skin, brown eyes, short neat black hair, defined jawline", img: "https://raw.githubusercontent.com/ElizEge/LenaKayra-/main/MET%C4%B0N.png", identitySheet: "https://raw.githubusercontent.com/ElizEge/LenaKayra-/main/MET%C4%B0N%20CHARACTER%20IDENTITY%20SHEET.png", identityLocked: true, outfit: "dark green tactical shirt, black cargo pants" }
];

const DEFAULT_INFLUENCER_PROFILES: Record<string, any> = {
    lena: { niche: 'Fashion & Lifestyle', personality: 'Elegant, natural, confident', city: 'İstanbul', contentPillars: 'Fashion 30%, Lifestyle 30%, Travel 15%, Beauty 15%, Personal 10%', visualIdentity: 'Elegant candid editorial, premium but believable social media photography', captionVoice: 'Minimal, elegant, warm; short Turkish/English mix when natural', postingFrequency: 3, favoriteLocations: 'city streets, tasteful cafés, hotels, waterfront, boutiques', wardrobeCapsule: 'refined contemporary fashion, neutral layers, occasional statement piece', avoid: 'same café, same outfit, repetitive mirror selfies, over-polished artificial poses' },
    kayra: { niche: 'Street Fashion & Youth Lifestyle', personality: 'Energetic, playful, colorful', city: 'İstanbul', contentPillars: 'Street Style 30%, Lifestyle 25%, Travel 15%, Café 15%, Beauty & Fun 15%', visualIdentity: 'Youthful candid street photography, playful direct flash, colorful everyday moments', captionVoice: 'Playful, concise, emoji-friendly, Turkish with occasional English phrases', postingFrequency: 3, favoriteLocations: 'street corners, cafés, concerts, airports, colorful interiors', wardrobeCapsule: 'streetwear, crop silhouettes, playful accessories, bold color accents', avoid: 'stiff luxury posing, repeated locations, identical framing, overly serious captions' },
    metin: { niche: 'Photography & Urban Lifestyle', personality: 'Witty, cinematic, grounded', city: 'Trabzon', contentPillars: 'Photography 30%, Urban Life 25%, Travel 20%, Coffee 15%, Behind the Scenes 10%', visualIdentity: 'Cinematic documentary realism, authentic urban moments, photographer lifestyle', captionVoice: 'Short, witty, grounded Turkish; occasional cinematic observation', postingFrequency: 3, favoriteLocations: 'city streets, viewpoints, cafés, coast, behind-the-scenes locations', wardrobeCapsule: 'smart casual, practical dark layers, photographer-friendly outfits', avoid: 'repetitive tactical styling, fake luxury, same camera pose, generic motivational captions' }
};

const ASPECT_RATIOS = [
    { id: 'any', label: 'Otomatik (AI Karar Verir)' },
    { id: '16:9', label: '16:9 (Yatay)' },
    { id: '9:16', label: '9:16 (Dikey)' },
    { id: '1:1', label: '1:1 (Kare)' },
    { id: '4:5', label: '4:5 (Portre)' },
    { id: '21:9', label: '21:9 (Sinema)' }
];

const STYLE_PRESETS = [
    { id: 'any', tr: 'Otomatik', en: '' },
    { id: 'neutral', tr: 'Sinematik Doğal', en: 'Cinematic authentic photorealism, balanced colors, natural contrast' },
    { id: 'pastel', tr: 'Simetrik Pastel', en: 'Perfectly symmetrical composition, refined pastel palette, controlled production design' },
    { id: 'neo_noir', tr: 'Neo-Noir Gerilim', en: 'Cold cyan and warm practical split toning, low-key lighting, deep controlled shadows' },
    { id: 'gritty35', tr: 'Kumlu 35mm Suç', en: 'Gritty 35mm film texture, punchy contrast, warm practical highlights, documentary tension' },
    { id: 'luxury', tr: 'Lüks Editoryal', en: 'High-end fashion editorial polish, elegant tonal separation, premium magazine aesthetic' },
    { id: 'dreamy', tr: 'Rüya Gibi Altın Sinema', en: 'Soft cinematic bloom, luminous highlights, subtle film halation, romantic atmospheric depth' },
    { id: 'bleach', tr: 'Bleach Bypass', en: 'Desaturated cinematic palette, silvery highlights, strong micro contrast, restrained color' },
    { id: 'tealamber', tr: 'Teal & Amber', en: 'Controlled teal shadows and amber highlights, cinematic color separation, realistic skin tones' }
];

const CAMERA_SETUPS = [
    { id: 'any', tr: 'Otomatik', en: '' },
    { id: '14mm_ext_wide', tr: '14mm (Ultra Geniş)', en: '14mm lens, extreme wide shot, deep focus' },
    { id: '24mm_wide', tr: '24mm (Geniş Çekim)', en: '24mm lens, wide shot, full environment context' },
    { id: '35mm_full', tr: '35mm (Tam Boy)', en: '35mm lens, full shot, full body framing' },
    { id: '50mm_medium', tr: '50mm (Orta Çekim)', en: '50mm lens, medium shot, waist-up framing' },
    { id: '85mm_med_close', tr: '85mm (Portre)', en: '85mm lens, medium close-up, chest-up portrait framing, shallow depth of field' },
    { id: '105mm_close', tr: '105mm (Yakın Çekim)', en: '105mm lens, close-up, tight facial framing' },
    { id: '200mm_ext_close', tr: '200mm (Detay)', en: '200mm lens, extreme close-up detail framing' }
];

const CAMERA_ANGLES = [
    { id: 'any', tr: 'Otomatik', en: '' },
    { id: 'eye', tr: 'Göz Hizasında', en: 'eye-level camera angle' },
    { id: 'low', tr: 'Aşağıdan (Low)', en: 'low-angle camera position' },
    { id: 'high', tr: 'Yukarıdan (High)', en: 'high-angle camera position' },
    { id: 'dutch', tr: 'Eğik (Dutch)', en: 'subtle dutch angle' },
    { id: 'ots', tr: 'Omuz Üstü (OTS)', en: 'over-the-shoulder camera position' },
    { id: 'top', tr: 'Kuşbakışı', en: 'top-down camera angle' },
    { id: 'ground', tr: 'Zemin Seviyesi', en: 'ground-level camera position' }
];

const SEASONS = [
    { id: 'any', tr: 'Otomatik', en: '' },
    { id: 'spring', tr: 'İlkbahar', en: 'spring season, blooming, fresh' },
    { id: 'summer', tr: 'Yaz', en: 'summer season, lush green, vibrant' },
    { id: 'autumn', tr: 'Sonbahar', en: 'autumn season, falling leaves, orange and brown tones' },
    { id: 'winter', tr: 'Kış', en: 'winter season, cold, snowy landscape' }
];

const WEATHERS = [
    { id: 'any', tr: 'Otomatik', en: '' },
    { id: 'clear', tr: 'Açık / Güneşli', en: 'clear weather, sunny sky' },
    { id: 'overcast', tr: 'Bulutlu', en: 'overcast, cloudy sky, soft diffused light' },
    { id: 'rain', tr: 'Yağmurlu', en: 'rainy weather, wet surfaces, water reflections' },
    { id: 'snow', tr: 'Karlı', en: 'snowing, snow-covered environment' },
    { id: 'fog', tr: 'Sisli', en: 'thick fog, atmospheric haze, mysterious' }
];

const LIGHT_TIMES = [
    { id: 'any', tr: 'Otomatik', en: '' },
    { id: 'sunrise', tr: 'Gün Doğumu', en: 'sunrise light' },
    { id: 'day', tr: 'Gün Işığı', en: 'daylight' },
    { id: 'golden', tr: 'Altın Saat', en: 'golden hour' },
    { id: 'blue', tr: 'Mavi Saat', en: 'blue hour' },
    { id: 'night', tr: 'Gece', en: 'nighttime' }
];

const LIGHT_STYLES = [
    { id: 'any', tr: 'Otomatik', en: '' },
    { id: 'soft', tr: 'Yumuşak', en: 'soft diffused lighting' },
    { id: 'hard', tr: 'Sert (Hard)', en: 'hard directional lighting' },
    { id: 'rembrandt', tr: 'Rembrandt', en: 'Rembrandt portrait lighting' },
    { id: 'rim', tr: 'Kenar Işığı', en: 'defined rim lighting' },
    { id: 'backlight', tr: 'Ters Işık', en: 'cinematic backlighting' },
    { id: 'highkey', tr: 'Aydınlık (High Key)', en: 'high-key lighting' },
    { id: 'lowkey', tr: 'Karanlık (Low Key)', en: 'low-key dramatic lighting' }
];

const MAGIC_LIGHTS = [
    { id: 'morning', label: 'Sabah', prompt: 'Cinematic morning light, soft dawn illumination, subtle warm tones, fresh atmosphere', icon: Icons.Sunrise },
    { id: 'golden', label: 'Altın Saat', prompt: 'Golden hour lighting, long warm directional shadows, cinematic sunset glow', icon: Icons.Sun },
    { id: 'blue', label: 'Mavi Saat', prompt: 'Blue hour cinematic lighting, cool deep blue ambient light with contrasting warm practical lights', icon: Icons.Sun },
    { id: 'night', label: 'Gece', prompt: 'Cinematic night time lighting, dark atmosphere, motivated practical lights or street lights', icon: Icons.Moon }
];

const DIVERSE_THEME_PROMPTS = [
    "Cyberpunk neon street at twilight, reflective rain puddles, high-contrast atmospheric backlighting",
    "Moody vintage jazz bar interior with warm ambient tungsten lighting, deep velvet shadows",
    "Windy high-rise rooftop golden hour fashion editorial, dynamic hair motion, low sun flare",
    "Atmospheric misty autumn mountain highway overlook, overcast diffused soft daylight",
    "Minimalist modern art gallery with concrete textures, geometric shadow patterns",
    "Late-night retro diner booth with practical neon reflections on glossy table",
    "Lush Mediterranean seaside villa terrace at blue hour, warm terrace lanterns",
    "Dramatic rainstorm under European historic archway, glossy wet cobblestones",
    "Old bookstore or vinyl record shop aisle, soft golden dust motes, rich warm tones",
    "High-speed urban subway platform passing train motion blur, sharp focus on subject"
];

const REJI_CAMERA_SHOTS = [
    { 
        id: 'master', 
        name: 'Master İkili Plan (A-Cam)', 
        tag: 'A-Cam',
        desc: 'İki karakterin mekansal konumunu ve 180° aks çizgisini kuran ana sahne planı',
        prompt: 'Master shot, cinematic two-shot spatial blocking establishing character interaction, environment depth and strict 180-degree axis line.' 
    },
    { 
        id: 'ots_reverse', 
        name: 'Omuz Üstü / Ters Açı (B-Cam)', 
        tag: 'B-Cam',
        desc: 'Ön planda omuz flusu ile 1. karaktere odaklanan sinematik ters açı',
        prompt: 'Professional Over-The-Shoulder (OTS) reverse angle shot, depth layering with foreground shoulder looking at the primary character, matching eyeline and spatial continuity.' 
    },
    { 
        id: 'ots_counter', 
        name: 'Karşı Omuz Üstü (B2-Cam)', 
        tag: 'B2-Cam',
        desc: 'Diğer karakterin açısından 2. karaktere bakan karşı omuz üstü açı',
        prompt: 'Professional counter Over-The-Shoulder (OTS) shot from the opposite perspective looking at the second partner, complementary depth layering and matched focal length.' 
    },
    { 
        id: 'reaction_c1', 
        name: '1. Karakter Yakın Plan (C1-Cam)', 
        tag: 'C1-Cam',
        desc: 'İlk karakterin yüz detaylarına, mimiklerine ve bakış doğrultusuna odaklanan sığ alan derinlikli yakın çekim',
        prompt: 'Cinematic tight close-up portrait of the first character / speaker, dramatic shallow depth of field, focused on their detailed facial geometry, micro-expressions, eyes and authentic optical bokeh.' 
    },
    { 
        id: 'reaction_c2', 
        name: '2. Karakter Karşı Yakın Plan (C2-Cam)', 
        tag: 'C2-Cam',
        desc: 'İkinci / karşı karakterin yüz detaylarına ve dinleme reaksiyonuna odaklanan eşlenik yakın çekim',
        prompt: 'Cinematic tight close-up portrait of the second / opposite character (the dialogue partner), dramatic shallow depth of field, reciprocal eyeline match, micro-expressions and authentic optical bokeh.' 
    },
    { 
        id: 'insert_detail', 
        name: 'Detay / İnsert Plan (D-Cam)', 
        tag: 'D-Cam',
        desc: 'Sahnedeki prop, el teması, kahve, çanta veya jest etkileşimine odaklanan detay planı',
        prompt: 'Cinematic insert shot / detail close-up focusing on character hands, tactile interaction with key props (cup, bag, accessories) or critical scene objects with cinematic macro lighting.' 
    },
    { 
        id: 'wide_env', 
        name: 'Geniş Çevre / Establishing (E-Cam)', 
        tag: 'E-Cam',
        desc: 'Sahnenin geçtiği atmosferik mekanı ve ortam derinliğini gösteren genel çevre planı',
        prompt: 'Atmospheric wide establishing shot, full environment context, environmental lighting and architectural mood while keeping character spatial positions intact.' 
    },
    { 
        id: 'low_dramatic', 
        name: 'Dramatik Alt Açı (F-Cam)', 
        tag: 'F-Cam',
        desc: 'Sahnedeki dinamizm ve güç dengesini hissettiren stilize düşük açı',
        prompt: 'Cinematic low-angle camera perspective looking slightly upward, dynamic framing emphasizing character presence and dramatic environmental scale.' 
    }
];

const STORY_CAMERA_SHOTS = [
    { id: 'follow', name: 'Takip Planı', tag: 'FLOW-A', desc: 'Karakterin doğal aksiyonunu takip eden hareketli plan', prompt: 'Smooth cinematic follow shot tracking the visible subject through the next natural beat of the action.' },
    { id: 'front_track', name: 'Önden Takip', tag: 'FLOW-B', desc: 'Kamera karakterin önünde kontrollü geri hareket eder', prompt: 'Controlled front tracking shot, camera moving backward ahead of the visible subject while maintaining eyeline and spatial continuity.' },
    { id: 'rear_track', name: 'Arkadan Takip', tag: 'FLOW-C', desc: 'Kamera karakteri arkadan takip eder', prompt: 'Cinematic rear follow shot tracking behind the visible subject, preserving screen direction and environment continuity.' },
    { id: 'side_track', name: 'Yandan Takip', tag: 'FLOW-D', desc: 'Kamera karakterle paralel ilerler', prompt: 'Smooth lateral tracking shot moving parallel with the visible subject, stable horizon and coherent background parallax.' },
    { id: 'push_action', name: 'Aksiyona Yaklaş', tag: 'FLOW-E', desc: 'Aksiyon ilerlerken kontrollü yaklaşma', prompt: 'Slow controlled dolly-in during the natural action progression, increasing emotional emphasis without changing cast or blocking arbitrarily.' },
    { id: 'pull_reveal', name: 'Çevreyi Aç', tag: 'FLOW-F', desc: 'Aksiyondan uzaklaşıp çevreyi açan plan', prompt: 'Smooth dolly-out / pull-away during action progression, gradually revealing more of the established environment.' },
    { id: 'orbit_action', name: 'Yörünge Takibi', tag: 'FLOW-G', desc: 'Aksiyon sırasında kontrollü çevresel kamera hareketi', prompt: 'Subtle controlled orbit during the action beat, only when spatial geometry supports it; preserve the established action axis.' },
    { id: 'crane_reveal', name: 'Vinç Açılımı', tag: 'FLOW-H', desc: 'Aksiyonu çevreyle birlikte açan yükselen plan', prompt: 'Smooth crane rise revealing the established environment as the action progresses, with physically plausible motion and stable continuity.' }
];

const VIDEO_CAMERA_MOVEMENTS = [
    { id: 'auto', label: 'Otomatik · Yönetmen Seçimi', prompt: 'Analyze both frames and choose the most cinematic physically plausible camera movement. A locked-off camera is valid when movement would weaken the scene.' },
    { id: 'locked', label: 'Sabit Kamera', prompt: 'Locked-off tripod camera. No camera translation, pan, tilt, zoom or orbit.' },
    { id: 'dolly_in', label: 'Kamera Yaklaşma', prompt: 'Slow controlled cinematic dolly-in toward the subject.' },
    { id: 'dolly_out', label: 'Kamera Uzaklaşma', prompt: 'Slow controlled cinematic dolly-out away from the subject.' },
    { id: 'pan_left', label: 'Sola Çevirme', prompt: 'Smooth cinematic pan left while preserving horizon and subject continuity.' },
    { id: 'pan_right', label: 'Sağa Çevirme', prompt: 'Smooth cinematic pan right while preserving horizon and subject continuity.' },
    { id: 'tilt_up', label: 'Yukarı Çevirme', prompt: 'Smooth cinematic tilt up.' },
    { id: 'tilt_down', label: 'Aşağı Çevirme', prompt: 'Smooth cinematic tilt down.' },
    { id: 'track_left', label: 'Sola Takip', prompt: 'Smooth lateral tracking / truck left.' },
    { id: 'track_right', label: 'Sağa Takip', prompt: 'Smooth lateral tracking / truck right.' },
    { id: 'orbit', label: 'Yörünge Hareketi', prompt: 'Slow controlled cinematic orbit around the subject while preserving spatial continuity.' },
    { id: 'crane_up', label: 'Vinç Yükselme', prompt: 'Smooth cinematic crane / pedestal rise.' },
    { id: 'crane_down', label: 'Vinç Alçalma', prompt: 'Smooth cinematic crane / pedestal descent.' },
    { id: 'drone_in', label: 'Drone Yaklaşma', prompt: 'Cinematic aerial drone push-in: smoothly fly toward the subject while gently descending only if composition benefits.' },
    { id: 'drone_out', label: 'Drone Uzaklaşma', prompt: 'Cinematic aerial drone pull-away: smoothly fly backward and gradually reveal the wider environment, with a subtle rise when appropriate.' }
];

const MEMORY_FORMAT = 'aifotofilm.production-memory';
const MEMORY_VERSION = 1;
const memoryPlain = (v: any): any => {
    if (typeof v === 'string') return v.startsWith('data:') ? '[IMAGE_DATA_EXCLUDED]' : v;
    if (Array.isArray(v)) return v.map(memoryPlain);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([k]) => !/^(apiKey|accessToken|authorization|secret)$/i.test(k)).map(([k, x]) => [k, memoryPlain(x)]));
    return v;
};
const createProductionMemory = (state: any) => ({
    format: MEMORY_FORMAT, schemaVersion: MEMORY_VERSION, appVersion: '20.5.1',
    exportedAt: new Date().toISOString(),
    project: { characters: memoryPlain(state.chars), selectedCharacterIds: [...state.sel],
        influencerProfiles: memoryPlain(state.profiles), trends: state.trends,
        scenes: memoryPlain(state.scenes), activeSceneId: state.aid,
        promptLibrary: memoryPlain(state.library),
        assetIndex: state.assets.map((a: any) => ({ id: a.id, sceneId: a.sceneId, name: a.name, type: a.type, prompt: a.prompt, scenario: a.scenario, ratio: a.ratio, seed: a.seed, parentId: a.parentId })) }
});
const parseProductionMemory = (text: string) => {
    if (text.length > 15_000_000) throw new Error('Production Memory dosyası çok büyük.');
    const data = JSON.parse(text);
    if (data?.format !== MEMORY_FORMAT || data?.schemaVersion !== MEMORY_VERSION) throw new Error('Production Memory biçimi veya sürümü desteklenmiyor.');
    const p = data.project;
    if (!p || !Array.isArray(p.characters) || !p.characters.length || !Array.isArray(p.scenes) || !p.scenes.length || !Array.isArray(p.selectedCharacterIds) || !Array.isArray(p.promptLibrary) || typeof p.influencerProfiles !== 'object' || p.influencerProfiles === null || Array.isArray(p.influencerProfiles) || typeof p.trends !== 'string') throw new Error('Production Memory zorunlu alanları eksik.');
    if (!p.characters.every((c: any) => c && typeof c.id === 'string' && typeof c.ad === 'string') || !p.scenes.every((sc: any) => sc && typeof sc.id === 'string')) throw new Error('Karakter veya sahne kimliği geçersiz.');
    if (!p.scenes.some((sc: any) => sc.id === p.activeSceneId)) throw new Error('Aktif sahne bulunamadı.');
    return p;
};
const downloadJson = (json: string, name: string) => {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
};

const DRIVE_FOLDER_URL = 'https://drive.google.com/drive/u/0/my-drive';
const safeImageName = (name: unknown) => String(name || 'aifotofilm_gorsel')
    .normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 72) || 'aifotofilm_gorsel';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
let driveToken: { access_token: string; expiresAt: number } | null = null;
let driveFolderId: string | null = null;
let driveScriptPromise: Promise<void> | null = null;
const driveConnected = () => !!driveToken && Date.now() < driveToken.expiresAt;
const loadDriveIdentity = () => {
    if (driveScriptPromise) return driveScriptPromise;
    driveScriptPromise = new Promise<void>((resolve, reject) => {
        if ((window as any).google?.accounts?.oauth2) { resolve(); return; }
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
        script.onload = () => (window as any).google?.accounts?.oauth2 ? resolve() : reject(new Error('Google kimlik kitaplığı açılamadı.'));
        script.onerror = () => reject(new Error('Google oturum açma kitaplığı engellendi.'));
        document.head.appendChild(script);
    }).catch((e) => { driveScriptPromise = null; throw e; });
    return driveScriptPromise;
};
const connectGoogleDrive = async (clientId: string): Promise<void> => {
    if (!/^\d+-[a-z0-9-]+\.apps\.googleusercontent\.com$/.test(clientId.trim()))
        throw new Error('Google OAuth Web Client ID girin (…apps.googleusercontent.com).');
    await loadDriveIdentity();
    return new Promise<void>((resolve, reject) => {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: clientId.trim(), scope: DRIVE_SCOPE,
            callback: (response: any) => {
                if (response?.error || !response?.access_token) {
                    reject(new Error('Google erişim izni alınamadı: ' + (response?.error || 'bilinmeyen hata'))); return;
                }
                driveToken = { access_token: response.access_token, expiresAt: Date.now() + Math.max(0, (Number(response.expires_in) || 3600) - 90) * 1000 };
                driveFolderId = null; resolve();
            },
            error_callback: (e: any) => reject(new Error('Google oturum penceresi açılamadı veya kapatıldı: ' + (e?.type || 'popup hatası')))
        });
        client.requestAccessToken({ prompt: 'consent' });
    });
};
const driveFetch = async (url: string, options: RequestInit = {}) => {
    if (!driveConnected()) throw new Error('Google Drive bağlantısı yok veya süresi doldu. Ayarlar üzerinden yeniden bağlanın.');
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${driveToken!.access_token}`);
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
        if (response.status === 401) driveToken = null;
        let detail = ''; try { detail = (await response.json())?.error?.message || ''; } catch {}
        throw new Error(`Google Drive API (${response.status}): ${detail || response.statusText}`);
    }
    return response;
};
const getDriveFolder = async () => {
    if (driveFolderId) return driveFolderId;
    const q = encodeURIComponent("name = 'AiFotofilm Pro' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
    const result = await (await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name),nextPageToken&page_size=100`)).json();
    const existing = result.files?.[0]?.id;
    if (existing) { driveFolderId = existing; return existing; }
    const created = await (await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'AiFotofilm Pro', mimeType: 'application/vnd.google-apps.folder' })
    })).json();
    if (!created.id) throw new Error('Google Drive klasörü oluşturulamadı.');
    driveFolderId = created.id; return created.id;
};
const rasterBlob = async (asset: any): Promise<Blob> => {
    const source = String(asset?.url || '');
    if (!source || source.startsWith('data:image/svg') || source.startsWith('data:text/html'))
        throw new Error('Gerçek bir görsel seçin; sahte önizlemeler kaydedilemez.');
    let blob: Blob;
    if (source.startsWith('data:')) {
        const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-zA-Z0-9+/=]+)$/.exec(source);
        if (!match) throw new Error('Yalnızca PNG, JPEG veya WebP görseller desteklenir.');
        const bytes = atob(match[2]);
        const data = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) data[i] = bytes.charCodeAt(i);
        blob = new Blob([data], { type: match[1] });
    } else {
        const response = await fetch(source);
        if (!response.ok) throw new Error('Görsel indirilemedi.');
        blob = await response.blob();
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(blob.type))
            throw new Error('Geçersiz görsel türü.');
    }
    if (!blob.size) throw new Error('Görsel dosyası boş.');
    return blob;
};
const driveFileName = (asset: any, blob: Blob) => {
    const ext = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png';
    return `${safeImageName(asset?.name || asset?.tag || asset?.type)}_${Date.now()}.${ext}`;
};
const downloadForDrive = async (asset: any) => {
    const blob = await rasterBlob(asset);
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = objectUrl;
    link.download = driveFileName(asset, blob);
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
};
const uploadImageToDrive = async (asset: any) => {
    const blob = await rasterBlob(asset);
    const folder = await getDriveFolder();
    const metadata = { name: driveFileName(asset, blob), parents: [folder], description: 'AiFotofilm Pro görsel arşivi' };
    const boundary = 'aifotofilm_' + Math.random().toString(36).slice(2);
    const body = new Blob([
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
        `--${boundary}\r\nContent-Type: ${blob.type}\r\n\r\n`, blob,
        `\r\n--${boundary}--`
    ], { type: `multipart/related; boundary=${boundary}` });
    const result = await (await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
        method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body
    })).json();
    if (!result.id) throw new Error('Google Drive dosya kimliği alınamadı.');
    return result;
};
const openGoogleDrive = () => window.open(DRIVE_FOLDER_URL, '_blank', 'noopener,noreferrer');

const PFX = 'ai_fotofilm_v20_';
const LS = (k: string, d: any) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const SAVE = (k: string, v: any) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* kotada yoksay */ } };
const usePersist = (key: string, init: any): [any, (x: any) => void] => {
    const [v, setV] = useState<any>(() => LS(PFX + key, init));
    useEffect(() => SAVE(PFX + key, v), [v]);
    return [v, setV];
};
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const split64 = (u: string) => { const m = /^data:([^;]+);base64,(.+)$/.exec(u || ''); return m ? { mimeType: m[1], data: m[2] } : null; };
const toB64 = async (u: string, sig: AbortSignal | null = null) => split64(u) || fetchImageAsBase64(u, sig);
const opt = (list: any[], id: string) => list.find(x => x.id === id)?.en || '';
const has = (list: any[], id: string) => list.some(x => x.id === id);
const rnd = () => Math.floor(Math.random() * 2147483647);
const dl = (url: string, name: string) => { const a = document.createElement('a'); a.href = url; a.download = `${name}_${Date.now()}.png`; a.click(); };
const cssRatio = (r: string) => /^\d+:\d+$/.test(r || '') ? r.replace(':', ' / ') : '16 / 9';
const chk = (sig: any) => { if (sig?.aborted) throw Object.assign(new Error('İptal edildi'), { name: 'AbortError' }); };
const need = (v: any, m: string) => { if (!v || (Array.isArray(v) && !v.length) || (typeof v === 'string' && !v.trim())) throw new Error(m); };
const isAbort = (e: any) => e?.name === 'AbortError';
const LOCK: any = { female: 'ADULT WOMAN / FEMALE — never male, man or boy', male: 'ADULT MAN / MALE' };
const RATIOS = ASPECT_RATIOS.filter((x: any) => x.id !== 'any');
const OPTS: any[] = [['style', 'Stil', STYLE_PRESETS], ['setup', 'Lens', CAMERA_SETUPS], ['angle', 'Kamera açısı', CAMERA_ANGLES], ['ratio', 'Oran', ASPECT_RATIOS], ['time', 'Işık zamanı', LIGHT_TIMES], ['lightStyle', 'Işık stili', LIGHT_STYLES], ['weather', 'Hava', WEATHERS], ['season', 'Mevsim', SEASONS]];
const TABS: any[] = [['studio', 'Studio'], ['reji', 'Reji Multi-Cam'], ['lab', 'Image Lab'], ['next', 'Next Frame'], ['story', 'Storyboard'], ['video', 'Video Prep'], ['influencer', 'Influencer']];
const TYPES: any[] = [['all', 'Hepsi'], ['studio', 'Studio'], ['reji', 'Reji'], ['lab', 'Lab'], ['next', 'Next'], ['storyboard', 'Story'], ['influencer', 'Influencer'], ['upload', 'Yüklenen']];
const XFER: any[] = [['studio', 'Studio'], ['reji', 'Reji referansı'], ['lab', 'Image Lab'], ['next', 'Next Frame'], ['story', 'Storyboard referansı'], ['video', 'Video Prep']];
const VIDEO_MODES: any[] = [
    { id: 'se', tr: 'Başlangıç + Bitiş karesi', fields: ['Başlangıç karesi (First frame)', 'Bitiş karesi (Last frame)'] },
    { id: 'i2v', tr: 'Tek kare → video (Image-to-video)', fields: ['Başlangıç karesi (First frame)'] },
    { id: 'ref', tr: 'Karakter / mekan referanslı', fields: ['Referans 1 (karakter)', 'Referans 2 (sahne/mekan)', 'Referans 3 (opsiyonel)'] }
];
const NEG_VIDEO = 'morphing face, identity drift, extra limbs, warped hands, flicker, outfit change, text, watermark, jump cut, camera shake artifacts';
const newScene = (title = 'Sahne 1') => ({ id: uid(), title, scenario: '', plan: null, prompt: '', seed: '', ratio: 'any', recRatio: '16:9', style: 'any', setup: 'any', angle: 'any', time: 'any', lightStyle: 'any', weather: 'any', season: 'any', useOutfit: false, wardrobeText: '', storyState: {}, manifest: '', continuityManifest: null, blocking: null, sceneMap: null, masterAssetId: null, pre: null });
const wardrobeFromState = (ws: any, chars: any[]) => Object.entries(ws || {}).map(([id, w]: any) => {
    const c = chars.find(x => x.id === id);
    return `${String(c?.ad || id).toUpperCase()} is EXACTLY wearing: ${[w?.outfit_en, w?.hair_makeup_en, w?.props_en].filter(Boolean).join('; ')}.`;
}).join(' ');

const Btn = ({ children, onClick, disabled, tone = 'v' }: any) => (
    <button onClick={onClick} disabled={disabled} className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-40 transition-colors whitespace-nowrap ${tone === 'v' ? 'bg-[#8B5CF6] hover:bg-violet-500 text-white' : tone === 'r' ? 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25' : tone === 'a' ? 'bg-[#8B5CF6]/20 text-[#A78BFA]' : 'bg-[#16181E] border border-slate-800 text-slate-300 hover:text-white'}`}>{children}</button>
);
const ActBtn = ({ S, k, label, run, disabled, tone = 'v' }: any) => S.busy(k)
    ? <Btn tone="r" onClick={() => S.stopKey(k)}>Durdur ✕</Btn>
    : <Btn tone={tone} disabled={disabled} onClick={run}>{label}</Btn>;
const Sel = ({ label, value, onChange, list }: any) => (
    <label className="flex flex-col gap-1 text-[11px] text-slate-400">{label}
        <select value={value} onChange={e => onChange(e.target.value)} className="bg-[#16181E] border border-slate-800 rounded-lg px-2 py-1.5 text-[12px] text-slate-200 outline-none focus:border-[#8B5CF6]">
            {list.map((x: any) => <option key={x.id} value={x.id}>{x.tr || x.label || x.name}</option>)}
        </select>
    </label>
);
const Inp = ({ label, value, onChange, ph = '' }: any) => (
    <label className="flex flex-col gap-1 text-[11px] text-slate-400">{label}
        <input value={value} placeholder={ph} onChange={e => onChange(e.target.value)} className="bg-[#16181E] border border-slate-800 rounded-lg px-2 py-1.5 text-[12px] text-slate-200 outline-none focus:border-[#8B5CF6]" />
    </label>
);
const Area = ({ label, value, onChange, rows = 3, ph = '' }: any) => (
    <label className="flex flex-col gap-1 text-[11px] text-slate-400">{label}
        <textarea rows={rows} value={value} placeholder={ph} onChange={e => onChange(e.target.value)} className="bg-[#16181E] border border-slate-800 rounded-lg p-2 text-[12px] text-slate-200 outline-none focus:border-[#8B5CF6] resize-y" />
    </label>
);
const Box = ({ title, children, right }: any) => (
    <section className="rounded-2xl border border-slate-800 bg-[#0D0F14] p-4 flex flex-col gap-3">
        {title && <div className="flex items-center justify-between gap-2 flex-wrap"><h3 className="text-[13px] font-bold text-white">{title}</h3>{right}</div>}{children}
    </section>
);

const verdictOk = (v: any) => !!v && (v.status === 'consistent' || v.status === 'ready' || Number(v.score) >= 80);
const hasScore = (v: any) => !!v && v.score !== null && v.score !== undefined && v.score !== '' && Number.isFinite(Number(v.score));
const Badge = ({ v }: any) => {
    if (!v) return null;
    const sc = Number(v.score);
    const cls = v.status === 'audit_error' ? 'bg-slate-600 text-white' : verdictOk(v) ? 'bg-emerald-500 text-black' : hasScore(v) && sc >= 60 ? 'bg-amber-400 text-black' : 'bg-rose-500 text-white';
    return <span title={(v.issues_tr || []).join(' · ')} className={`px-2 py-0.5 rounded-md text-[10px] font-bold shadow ${cls}`}>{hasScore(v) ? sc : verdictOk(v) ? '✓' : '!'}</span>;
};
const Verdict = ({ v, title = 'Tutarlılık' }: any) => v ? (
    <div className={`text-[12px] rounded-lg border px-3 py-2 ${v.status === 'audit_error' ? 'border-slate-700 text-slate-400 bg-slate-800/30' : verdictOk(v) ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/5' : 'border-amber-500/30 text-amber-300 bg-amber-500/5'}`}>
        <b>{title}: {v.status}</b>{hasScore(v) ? ` · ${v.score}` : ''} — {(v.issues_tr || []).join(' · ') || 'Sorun bulunmadı.'}
    </div>) : null;
const LinkToggle = ({ S, tab }: any) => (
    <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none" title="Bağlıyken senaryo tüm bağlı sekmelerle ortaktır">
        <input type="checkbox" className="accent-[#8B5CF6]" checked={S.link[tab] !== false} onChange={e => S.setLink({ ...S.link, [tab]: e.target.checked })} />
        <span>{S.link[tab] !== false ? '🔗 Sahne Kitabına bağlı' : '⛓ Bağımsız'}</span>
    </label>
);
const Xfer = ({ a, S }: any) => (
    <select value="" onChange={e => { if (e.target.value) S.transfer(a, e.target.value); }} className="bg-[#16181E] border border-slate-800 rounded-lg px-1.5 py-1 text-[11px] text-slate-300">
        <option value="">Aktar…</option>{XFER.map(([id, t]) => <option key={id} value={id}>{t}</option>)}
    </select>
);
const PromptView = ({ text, S }: any) => (S.showP && text) ? (
    <div className="rounded-lg bg-black/40 border border-slate-800 p-2 text-[10.5px] leading-relaxed text-slate-400 max-h-32 overflow-y-auto sc">
        {String(text)}<div className="mt-1"><button className="underline text-slate-500 hover:text-white" onClick={() => S.copy(String(text))}>kopyala</button></div>
    </div>) : null;

const AssetActions = ({ a, S, extra, plain }: any) => {
    if (!a) return null;
    const v = a.verdict;
    return (
        <div className="flex flex-col gap-1.5">
            <div className="text-[11px] text-slate-400 truncate"><b className="text-slate-200">{a.name}</b> · {a.tag}{a.seed !== undefined && a.seed !== 'AUTO' && a.seed !== '' ? ` · seed ${a.seed}` : ''}</div>
            <PromptView text={a.prompt} S={S} />
            {v?.issues_tr?.length > 0 && <p className="text-[11px] text-amber-300/90">{v.issues_tr.join(' · ')}</p>}
            <div className="flex flex-wrap items-center gap-1.5">{extra}
                {!plain && <><Btn tone="g" disabled={S.busy(`audit.${a.id}`)} onClick={() => S.auditAsset(a)}>Denetle</Btn>
                    {v?.fix_prompt_en && <Btn tone="g" disabled={S.busy(`repair.${a.id}`)} onClick={() => S.repairAsset(a)}>Önerilenle onar</Btn>}</>}
                <Xfer a={a} S={S} />
                <Btn tone="g" onClick={() => dl(a.url, a.type)}><span className="inline-flex items-center gap-1"><Icons.Download />İndir</span></Btn>
                <Btn tone="a" onClick={() => { void downloadForDrive(a).then(() => S.notify('Görsel indirildi. Google Drive’a dosya olarak yükleyin.')).catch((e: any) => S.notify(e.message, 'error')); }}>Drive için indir</Btn><Btn tone="a" onClick={() => { void uploadImageToDrive(a).then(() => S.notify('Görsel Google Drive’a kaydedildi.')).catch((e: any) => S.notify(e.message, 'error')); }}>Drive’a kaydet</Btn>
                <Btn tone="r" onClick={() => S.delAsset(a.id)}><span className="inline-flex items-center gap-1"><Icons.Trash />Sil</span></Btn>
            </div>
        </div>
    );
};

const Flip = ({ items, index, onIndex, S }: any) => {
    const list = items.filter((x: any) => x.a);
    if (!list.length) return null;
    const idx = Math.max(0, Math.min(index, list.length - 1)), cur = list[idx].a;
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1 flex-wrap">
                {list.map((x: any, i: number) => <button key={x.a.id + i} onClick={() => onIndex(i)} className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${i === idx ? 'bg-[#8B5CF6]/25 text-[#C4B5FD]' : 'text-slate-500 hover:text-white'}`}>{x.label}</button>)}
                {list.length > 1 && <span className="ml-auto text-[10px] text-slate-500">görsele tıkla → sıradaki</span>}
            </div>
            <div className="relative bg-black rounded-xl overflow-hidden border border-slate-800 cursor-pointer" style={{ aspectRatio: cssRatio(cur.ratio) }}
                onClick={() => list.length > 1 ? onIndex((idx + 1) % list.length) : S.inspect([cur], 0)}>
                {list.map((x: any, i: number) => <img key={x.a.id + i} src={x.a.url} alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300" style={{ opacity: i === idx ? 1 : 0 }} />)}
                {cur.verdict && <div className="absolute top-2 left-2"><Badge v={cur.verdict} /></div>}
                <button title="Büyüt" onClick={e => { e.stopPropagation(); S.inspect(list.map((x: any) => x.a), idx); }} className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80"><Icons.Maximize /></button>
            </div>
        </div>
    );
};

const Gallery = ({ items, S, extra, plain }: any) => {
    const [idx, setIdx] = useState(0);
    const list = items.filter((x: any) => x.a);
    if (!list.length) return null;
    const i = Math.min(idx, list.length - 1), cur = list[i].a;
    return (
        <div className="flex flex-col gap-2">
            <Flip items={list} index={i} onIndex={setIdx} S={S} />
            <AssetActions a={cur} S={S} plain={plain} extra={extra ? extra(cur, list[i]) : null} />
        </div>
    );
};

const Pane = ({ a, list, S }: any) => a ? (
    <div className="relative bg-black rounded-xl overflow-hidden border border-slate-800 cursor-zoom-in" style={{ aspectRatio: cssRatio(a.ratio) }}
        onClick={() => S.inspect(list, Math.max(0, list.findIndex((x: any) => x.id === a.id)))}>
        <img src={a.url} alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain" />
        {a.verdict && <div className="absolute top-2 left-2"><Badge v={a.verdict} /></div>}
    </div>) : null;

const AssetCard = ({ a, S, extra, plain, group }: any) => {
    const [st, setSt] = useState<any>({ id: a?.id, vi: -1 });
    if (!a) return null;
    const chain = S.lineage(a), vi = st.id === a.id ? st.vi : -1;
    const i = vi >= 0 && vi < chain.length ? vi : chain.length - 1, cur = chain[i] || a;
    return (
        <div className="rounded-xl overflow-hidden border border-slate-800 bg-[#090A0D]">
            <div className="relative bg-black cursor-pointer" style={{ aspectRatio: cssRatio(cur.ratio) }} onClick={() => chain.length > 1 ? setSt({ id: a.id, vi: (i + 1) % chain.length }) : group && group.length > 1 ? S.inspect(group, Math.max(0, group.findIndex((x: any) => x.id === cur.id))) : S.inspect([cur], 0)}>
                {chain.map((c: any) => <img key={c.id} src={c.url} alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300" style={{ opacity: c.id === cur.id ? 1 : 0 }} />)}
                {cur.verdict && <div className="absolute top-2 left-2"><Badge v={cur.verdict} /></div>}
                {chain.length > 1 && <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-[10px] font-semibold text-white">{i === chain.length - 1 ? 'SON' : i === 0 ? 'KAYNAK' : `v${i + 1}`} · {i + 1}/{chain.length} · tıkla</span>}
                <button title="Büyüt" onClick={e => { e.stopPropagation(); S.inspect(chain, i); }} className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80"><Icons.Maximize /></button>
            </div>
            <div className="p-2"><AssetActions a={cur} S={S} extra={extra} plain={plain} /></div>
        </div>
    );
};

const RefSlot = ({ title, a, onClear, onPick, S, hint }: any) => {
    const f = useRef<any>(null);
    return (
        <div className="flex flex-col gap-2">
            <div className="text-[11px] text-slate-400 font-semibold">{title}</div>
            {a ? <AssetCard a={a} S={S} plain extra={<Btn tone="g" onClick={onClear}>Kaldır</Btn>} />
                : <div onClick={() => f.current?.click()} className="cursor-pointer rounded-xl border border-dashed border-slate-700 p-6 text-center text-[11px] text-slate-500 hover:border-[#8B5CF6] transition-colors">{hint || 'Film şeridinden “Yükle” ya da buraya tıklayıp cihazdan görsel seçin.'}</div>}
            <input ref={f} type="file" accept="image/*" className="hidden" onChange={async e => { const file = e.target.files?.[0]; if (file) { const up = await S.uploadFile(file); if (up) onPick(up.id); } e.target.value = ''; }} />
        </div>
    );
};

const Inspector = ({ items, start, onClose, S }: any) => {
    const [list, setList] = useState<any[]>(items); const [i, setI] = useState(Math.min(start, items.length - 1));
    const [z, setZ] = useState(1); const [pan, setPan] = useState({ x: 0, y: 0 }); const [info, setInfo] = useState(false);
    const box = useRef<any>(null); const stage = useRef<any>(null); const drag = useRef<any>(null); const moved = useRef(0); const zr = useRef(1);
    const it = list[i] || list[0];
    const reset = () => { zr.current = 1; setZ(1); setPan({ x: 0, y: 0 }); };
    const go = (n: number) => { setI(n); reset(); };
    const move = (d: number) => { if (list.length > 1) go((i + d + list.length) % list.length); };
    const fs = () => { if (!document.fullscreenElement) box.current?.requestFullscreen?.().catch(() => { }); else document.exitFullscreen?.().catch(() => { }); };
    const zoom = (d: number) => { const n = Math.max(0.5, Math.min(8, Math.round((zr.current + d) * 100) / 100)); zr.current = n; setZ(n); if (n <= 1) setPan({ x: 0, y: 0 }); };
    const del = () => { S.delAsset(it.id); const nl = list.filter(x => x.id !== it.id); if (!nl.length) return onClose(); setList(nl); setI(Math.min(i, nl.length - 1)); reset(); };

    useEffect(() => {
        const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
        const el = stage.current;
        const wheel = (e: WheelEvent) => { e.preventDefault(); e.stopPropagation(); zoom(e.deltaY < 0 ? 0.25 : -0.25); };
        el?.addEventListener('wheel', wheel, { passive: false });
        return () => { document.body.style.overflow = prev; el?.removeEventListener('wheel', wheel); };
    }, []);

    useEffect(() => {
        const k = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') move(-1);
            if (e.key === 'ArrowRight') move(1);
            if (e.key === '+' || e.key === '=') zoom(0.25);
            if (e.key === '-') zoom(-0.25);
            if (e.key === '0') reset();
            if (e.key.toLowerCase() === 'i') setInfo((v: boolean) => !v);
            if (e.key.toLowerCase() === 'f') fs();
        };
        window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
    }, [i, list.length]);

    if (!it) return null;
    return (
        <div ref={box} className="fixed inset-0 z-[70] bg-black/95 flex flex-col">
            <div className="flex flex-wrap items-center gap-2 px-4 py-2 text-[12px] text-slate-300 border-b border-white/10">
                <b className="text-white">{it.name}</b><span className="text-slate-500">{i + 1}/{list.length} · {it.tag}</span>
                <span className="ml-auto flex flex-wrap items-center gap-1.5">
                    <Btn tone="g" onClick={() => zoom(-0.25)}><Icons.ZoomOut /></Btn><span className="w-12 text-center">{Math.round(z * 100)}%</span><Btn tone="g" onClick={() => zoom(0.25)}><Icons.ZoomIn /></Btn>
                    <Btn tone="g" onClick={reset}>Sıfırla</Btn><Btn tone={info ? 'a' : 'g'} onClick={() => setInfo((v: boolean) => !v)}>Bilgi</Btn><Btn tone="g" onClick={fs}>Tam ekran</Btn>
                    <select value="" onChange={e => { if (e.target.value) { S.transfer(it, e.target.value); onClose(); } }} className="bg-[#16181E] border border-slate-800 rounded-lg px-1.5 py-1 text-[11px] text-slate-300"><option value="">Aktar…</option>{XFER.map(([id, t]) => <option key={id} value={id}>{t}</option>)}</select>
                    <Btn tone="g" onClick={() => dl(it.url, it.type)}>İndir</Btn>
                    <Btn tone="a" onClick={() => { void downloadForDrive(it).then(() => S.notify('Görsel indirildi. Google Drive’a dosya olarak yükleyin.')).catch((e: any) => S.notify(e.message, 'error')); }}>Drive için indir</Btn><Btn tone="a" onClick={() => { void uploadImageToDrive(it).then(() => S.notify('Görsel Google Drive’a kaydedildi.')).catch((e: any) => S.notify(e.message, 'error')); }}>Drive’a kaydet</Btn>
                    <Btn tone="r" onClick={del}>Sil</Btn><Btn tone="g" onClick={onClose}>Kapat</Btn>
                </span>
            </div>
            <div ref={stage} className="flex-1 relative overflow-hidden select-none" style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
                onPointerDown={e => { if ((e.target as HTMLElement).closest('button')) return; drag.current = { x: e.clientX - pan.x, y: e.clientY - pan.y, sx: e.clientX, sy: e.clientY }; moved.current = 0; try { (e.currentTarget as any).setPointerCapture(e.pointerId); } catch (err) { /* yoksay */ } }}
                onPointerMove={e => { const d = drag.current; if (!d) return; moved.current = Math.max(moved.current, Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy)); if (zr.current > 1) setPan({ x: e.clientX - d.x, y: e.clientY - d.y }); }}
                onPointerUp={() => { const d = drag.current; drag.current = null; if (d && moved.current < 5 && zr.current === 1) move(1); }}
                onPointerCancel={() => { drag.current = null; }}>
                <img key={it.id} src={it.url} alt="" draggable={false} className="absolute inset-0 m-auto max-w-full max-h-full" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${z})`, willChange: 'transform', cursor: z > 1 ? 'grab' : list.length > 1 ? 'pointer' : 'default' }} />
                {list.length > 1 && <><button onClick={() => move(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white/80 hover:text-white"><Icons.ChevronLeft /></button><button onClick={() => move(1)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white/80 hover:text-white"><Icons.ChevronRight /></button></>}
                <div className="absolute right-3 bottom-3 text-[10px] text-white/40 pointer-events-none">tekerlek: yakınlaştır · sürükle: kaydır · tıkla: sıradaki</div>
                {info && <div className="absolute left-3 bottom-3 max-w-md bg-black/70 rounded-xl p-3 text-[11px] text-slate-300 leading-relaxed" onPointerDown={e => e.stopPropagation()}>
                    Seed: {String(it.seed ?? 'AUTO')} · Oran: {it.ratio || '-'} · {(it.characters || []).join(', ')}{hasScore(it.verdict) ? ` · Tutarlılık ${it.verdict.score}` : ''}<br />
                    <span className="text-slate-400">{String(it.prompt || '').slice(0, 420)}</span></div>}
            </div>
            {list.length > 1 && <div className="flex gap-2 overflow-x-auto sc px-4 py-2 border-t border-white/10">{list.map((x, n) => (
                <img key={x.id} src={x.url} alt="" onClick={() => go(n)} className={`h-14 rounded-md object-cover cursor-pointer transition-opacity ${n === i ? 'ring-2 ring-[#8B5CF6] opacity-100' : 'opacity-50 hover:opacity-90'}`} />))}</div>}
        </div>
    );
};

const useScenario = (S: any, tab: string): [string, (v: string) => void] => {
    const [local, setLocal] = usePersist(`${tab}.scenario`, '');
    const linked = S.link[tab] !== false;
    return [linked ? (S.bible.scenario || '') : local, (v: string) => linked ? S.patchScene({ scenario: v }) : setLocal(v)];
};

const StudioTab = ({ S }: any) => {
    const b = S.bible;
    const [idea, setIdea] = usePersist('studio.idea', '');
    const [ext, setExt] = usePersist('studio.ext', '');
    const [resId, setResId] = useState<any>(() => b.masterAssetId || null);
    const [fix, setFix] = useState('');
    const res = (S.A(resId)?.sceneId === b.id ? S.A(resId) : null) || S.A(b.masterAssetId);
    const eff = b.ratio !== 'any' ? b.ratio : b.recRatio;

    useEffect(() => {
        if (b.masterAssetId && !resId) {
            setResId(b.masterAssetId);
        }
    }, [b.masterAssetId]);

    useEffect(() => {
        const p = S.pkt.studio; if (!p) return; const a = p.asset;
        setResId(a.id);
        const pk = p.package || {};
        S.patchScene({ prompt: a.prompt || b.prompt, ...(typeof a.seed === 'number' ? { seed: String(a.seed) } : {}), ...(a.ratio ? { ratio: a.ratio } : {}), ...(a.scenario ? { scenario: a.scenario } : {}), ...(pk.blocking ? { blocking: pk.blocking } : {}), ...(pk.sceneMap ? { sceneMap: pk.sceneMap } : {}), ...(pk.continuityManifest ? { continuityManifest: pk.continuityManifest } : {}), ...(pk.storyState ? { storyState: pk.storyState } : {}), ...(a.wardrobe ? { wardrobeText: a.wardrobe } : {}), ...(a.tag === 'MASTER' ? { masterAssetId: a.id } : {}) });
        S.clearPkt('studio');
    }, [S.pkt.studio?.n]);

    const planScene = () => S.run('studio.plan', 'studio', 'Sahne planlanıyor', async (sig: any) => {
        need(S.cast, 'İlham motoru için en az bir karakter seçin.');
        const empty = !idea.trim();
        const theme = DIVERSE_THEME_PROMPTS[Math.floor(Math.random() * DIVERSE_THEME_PROMPTS.length)];
        const brief = empty ? `Kullanıcı fikir belirtmedi. YEPYENİ, özgün ve sinematik bir an kurgula. İlham teması: ${theme}` : idea.trim();
        const p = await callGemini(`CAST: ${JSON.stringify(S.castPayload())}\nUSER IDEA: ${brief}\nSESSION MEMORY: ${JSON.stringify({ storyState: b.storyState, outfitLock: b.wardrobeText, previousScenario: b.scenario })}`, true, `${SYS.plan}\nTrend Defteri: ${S.trends || 'Yok'}`, sig);
        const wt = wardrobeFromState(p.wardrobe_state, S.chars);
        let core: any = null;
        try { core = await callGemini(`SCENE PLAN: ${JSON.stringify(p)}\nCAST: ${JSON.stringify(S.castPayload())}\nWARDROBE LOCK: ${b.useOutfit ? b.wardrobeText : (wt || b.wardrobeText)}`, true, SYS.core, sig); } catch (e: any) { if (isAbort(e)) throw e; }
        S.patchScene({
            title: /^(Sahne|Yeni)/.test(b.title) ? (p.title || b.title) : b.title, scenario: p.scene_summary_tr || brief, plan: p,
            setup: has(CAMERA_SETUPS, p.camera_setup) ? p.camera_setup : b.setup, angle: has(CAMERA_ANGLES, p.camera_angle) ? p.camera_angle : b.angle,
            ratio: has(ASPECT_RATIOS, p.aspect_ratio) ? p.aspect_ratio : b.ratio, storyState: p.story_state || {},
            wardrobeText: b.useOutfit ? b.wardrobeText : (wt || b.wardrobeText), blocking: core?.blocking || null, sceneMap: core?.scene_map || null, continuityManifest: core?.continuity_manifest || null, manifest: core?.continuity_manifest ? JSON.stringify(core.continuity_manifest) : b.manifest
        });
        S.notify(empty ? 'AI özgün sahne planı oluşturdu.' : 'Fikir yönetmen planına dönüştü.');
    });

    const compile = () => S.run('studio.compile', 'studio', 'Master prompt derleniyor', async (sig: any) => {
        need(S.cast, 'Master Prompt için en az bir karakter seçin.');
        need(b.scenario, 'Önce sahne fikri yazın veya planlatın.');
        const info = S.castInfo(), plan = b.plan;
        const camEn = [opt(CAMERA_SETUPS, b.setup), opt(CAMERA_ANGLES, b.angle)].filter(Boolean).join(', ') || 'Dynamic cinematic composition';
        const over = plan ? [plan.location && `Location: ${plan.location}`, plan.time && `Time: ${plan.time}`, plan.weather && `Weather: ${plan.weather}`, plan.action_tr && `Action: ${plan.action_tr}`].filter(Boolean).join('\n') : '';
        const sys = `You are AiFotofilm V19 Master Prompt Director.\nACTIVE CAST:\n${info}\nOUTFIT STATE: ${b.wardrobeText || 'none'}\nSTORY STATE: ${JSON.stringify(b.storyState || {})}\nAI BLOCKING: ${JSON.stringify(b.blocking || {})}\nSCENE MAP: ${JSON.stringify(b.sceneMap || {})}\nCONTINUITY MANIFEST: ${JSON.stringify(b.continuityManifest || {})}\nTREND NOTES: ${S.trends || 'none'}\nCAMERA INTENT: ${camEn}\n${J}\n{"master_environment_en":"","master_outfits_en":"","scene_action_en":"","composition_en":"","continuity_locks_en":"","negative_rules_en":"","recommended_aspect_ratio":"16:9|9:16|1:1|4:5|21:9"}`;
        const r = await callGemini(over ? `${b.scenario}\nSTRUCTURED SCENE PLAN:\n${over}` : b.scenario, true, sys, sig);
        chk(sig);
        const light = [opt(LIGHT_TIMES, b.time), opt(LIGHT_STYLES, b.lightStyle)].filter(Boolean).join(', ');
        const atmo = [opt(SEASONS, b.season), opt(WEATHERS, b.weather)].filter(Boolean).join(', ');
        const ratio = b.ratio !== 'any' ? b.ratio : (has(RATIOS, r.recommended_aspect_ratio) ? r.recommended_aspect_ratio : '16:9');
        const outfits = b.useOutfit ? `STRICT OUTFIT LOCK: ${S.cast.map((c: any) => `${c.ad.toUpperCase()} is EXACTLY wearing: ${c.outfit}.`).join(' ')}` : r.master_outfits_en;
        const continuityEssentials = [r.continuity_locks_en, S.prodCtx()].filter(Boolean).join('. ');
        let compiled = `CAMERA & SHOT TYPE: ${camEn}. ACTION & FRAMING: ${r.scene_action_en}. MASTER ENVIRONMENT: ${r.master_environment_en}.${atmo ? ` ATMOSPHERE: ${atmo}.` : ''} CHARACTER DNA LOCK: ${S.cast.map((c: any) => `[${c.ad.toUpperCase()} DNA: ${c.dna}]`).join(' ')} CHARACTER IDENTITY REFERENCE LOCK: Attached canonical identity sheets for ${S.cast.map((c: any) => c.ad.toUpperCase()).join(', ')}. OUTFITS: ${outfits}. COMPOSITION: ${r.composition_en}. CONTINUITY LOCKS: ${continuityEssentials}. CINEMATOGRAPHY: ${light ? `${light}. ` : ''}${opt(STYLE_PRESETS, b.style)}. AVOID: ${r.negative_rules_en}. ASPECT RATIO: ${ratio}.`;
        let pf: any = null;
        if (S.engine) { S.patchScene({ wardrobeText: outfits }); pf = await S.auditPrompt(compiled, sig, outfits); if (pf?.fixed_prompt && pf.status !== 'ready') compiled = pf.fixed_prompt; }
        S.patchScene({ prompt: compiled, recRatio: ratio, wardrobeText: outfits, pre: pf });
        S.pushLib(b.title, compiled);
        S.notify(S.engine ? 'Master Prompt oluşturuldu ve ön denetimden geçti.' : 'Master Prompt oluşturuldu.');
    });

    const adaptExt = () => S.run('studio.ext', 'studio', 'Harici prompt denetleniyor', async (sig: any) => {
        need(ext, 'Önce harici promptu yapıştırın.');
        const pf = await S.auditPrompt(ext, sig);
        S.patchScene({ prompt: pf?.fixed_prompt && pf.status !== 'ready' ? pf.fixed_prompt : ext, pre: pf });
        S.notify('Harici prompt kadro ve sahne kitabına göre denetlendi.');
    });

    const scnFromPrompt = () => S.run('studio.scn', 'studio', 'Senaryo çıkarılıyor', async (sig: any) => {
        const src = ext.trim() || b.prompt; need(src, 'Önce bir prompt yazın.');
        S.patchScene({ scenario: (await callGemini(src, false, SYS.scn, sig)).trim() }); S.notify('Senaryo Sahne Kitabına yazıldı; tüm bağlı sekmeler kullanacak.');
    });

    const render = () => S.run('studio.render', 'studio', 'Master görsel üretiliyor', async (sig: any) => {
        need(b.prompt, 'Önce Master Prompt oluşturun.');
        const refs = await S.refsOf(S.cast, sig), seed = normalizeSeed(b.seed) ?? rnd();
        const a = await S.produce({ sig, type: 'studio', name: b.title, tag: 'MASTER', prompt: b.prompt, ratio: eff, seed, refs, scenario: b.scenario });
        if (a?.id) {
            setResId(a.id);
            S.patchScene({ masterAssetId: a.id });
            setFix(a.verdict?.fix_prompt_en || '');
            S.notify('Master görsel üretildi.');
        }
    });

    const repair = () => S.repairAsset(res, fix).then((a: any) => { if (a) { setResId(a.id); S.patchScene({ prompt: a.prompt, masterAssetId: a.id }); setFix(''); } });

    return (
        <div className="flex flex-col gap-4">
            <Box title="1 · Fikir ve sahne planı">
                <Area label="Fikir (boş bırakırsan yapay zeka özgün bir sahne kurgular)" value={idea} onChange={setIdea} rows={2} />
                <div className="flex gap-2"><ActBtn S={S} k="studio.plan" label="Sahneyi planla" run={planScene} /></div>
                {b.plan && <div className="text-[12px] text-slate-400 leading-relaxed"><b className="text-slate-200">{b.plan.title}</b> · {b.plan.location} · {b.plan.time} · {b.plan.weather}<br />{b.plan.director_intent_tr}<br /><span className="text-slate-500">{b.plan.continuity_notes_tr}</span></div>}
                {(b.blocking || b.sceneMap || b.continuityManifest) && <details className="rounded-lg border border-slate-800 px-3 py-2 text-[11px] text-slate-400"><summary className="cursor-pointer text-slate-300 font-semibold">Sahne Kitabı ayrıntıları (blocking · harita · manifest)</summary>
                    <p className="mt-2 leading-relaxed">{S.prodCtx() || 'Ayrıntı yok.'}</p>{b.blocking?.summary_tr && <p className="mt-1 text-slate-500">{b.blocking.summary_tr}</p>}</details>}
                <Area label="Sahne senaryosu — TÜM bağlı sekmeler bunu kullanır" value={b.scenario} onChange={(v: string) => S.patchScene({ scenario: v })} rows={3} />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{OPTS.map(([k, label, list]) => <Sel key={k} label={label} list={list} value={b[k]} onChange={(v: string) => S.patchScene({ [k]: v })} />)}</div>
                <div className="flex flex-wrap items-end gap-4">
                    <label className="flex items-center gap-2 text-[12px] text-slate-300"><input type="checkbox" checked={b.useOutfit} onChange={e => S.patchScene({ useOutfit: e.target.checked })} />Varsayılan kıyafet kilidi</label>
                    <Inp label="Seed (boş = rastgele)" value={b.seed} onChange={(v: string) => S.patchScene({ seed: v })} />
                </div>
                {b.wardrobeText && <p className="text-[11px] text-slate-500">Kıyafet kilidi: {b.wardrobeText}</p>}
            </Box>
            <Box title="2 · Harici prompt (isteğe bağlı)">
                <Area label="Başka yerden hazırladığın promptu yapıştır" value={ext} onChange={setExt} rows={3} />
                <div className="flex flex-wrap gap-2">
                    <Btn tone="g" disabled={!ext.trim()} onClick={() => { S.patchScene({ prompt: ext }); S.notify('Harici prompt master prompt alanına alındı.'); }}>Olduğu gibi kullan</Btn>
                    <ActBtn S={S} k="studio.ext" label="Denetle ve kadroya uyarla" run={adaptExt} disabled={!ext.trim()} tone="g" />
                    <ActBtn S={S} k="studio.scn" label="Promptan senaryo çıkar" run={scnFromPrompt} tone="g" />
                </div>
            </Box>
            <Box title="3 · Master prompt ve üretim">
                <div className="flex flex-wrap gap-2"><ActBtn S={S} k="studio.compile" label="Master prompt derle" run={compile} /><ActBtn S={S} k="studio.render" label="Master görseli üret" run={render} disabled={!b.prompt.trim()} /></div>
                <Area label="Master prompt (İngilizce, düzenlenebilir)" value={b.prompt} onChange={(v: string) => S.patchScene({ prompt: v })} rows={7} />
                <Verdict v={b.pre} title="Ön denetim" />
                {S.library.length > 0 && <Sel label="Prompt kütüphanesi" value="" onChange={(id: string) => { const l = S.library.find((x: any) => String(x.id) === id); if (l) S.patchScene({ prompt: l.prompt }); }} list={[{ id: '', tr: 'Kayıtlı bir prompt yükle…' }, ...S.library.map((l: any) => ({ id: String(l.id), tr: `${l.time} · ${l.title}` }))]} />}
            </Box>
            {res && <Box title="4 · Sonuç, görsel denetimi ve kilitli düzeltme">
                <div className="max-w-2xl"><AssetCard a={res} S={S} extra={<Btn tone="g" onClick={() => S.copy(String(res.seed))}>Seed kopyala</Btn>} /></div>
                <Area label="Düzeltme talebi (seed, kimlik ve kıyafet kilitli kalır)" value={fix} onChange={setFix} rows={2} />
                <div><ActBtn S={S} k={`repair.${res.id}`} label="Düzelt" run={repair} disabled={!fix.trim()} /></div>
            </Box>}
        </div>
    );
};

const RejiTab = ({ S }: any) => {
    const [scenario, setScenario] = useScenario(S, 'reji');
    const [sel, setSel] = usePersist('reji.sel', ['master', 'ots_reverse', 'reaction_c1']);
    const [style, setStyle] = usePersist('reji.style', 'neutral'); const [cam, setCam] = usePersist('reji.cam', '35mm_full');
    const [aspect, setAspect] = usePersist('reji.aspect', '16:9'); const [seed, setSeed] = usePersist('reji.seed', '');
    const [refId, setRefId] = useState<any>(null); const [plan, setPlan] = useState<any>(null); const [out, setOut] = useState<any>({});
    const ref = S.A(refId);

    useEffect(() => {
        const p = S.pkt.reji; if (!p) return; const a = p.asset;
        setRefId(a.id); setPlan(null);
        if (a.scenario) setScenario(a.scenario); else if (!scenario.trim() && a.prompt) setScenario(a.prompt);
        if (a.ratio && has(RATIOS, a.ratio)) setAspect(a.ratio);
        S.clearPkt('reji');
    }, [S.pkt.reji?.n]);

    const go = (only: any = null, fixText = '') => S.run(only ? `reji.${only.id}` : 'reji.run', 'reji', only ? `Reji · ${only.name}` : 'Reji çekimi', async (sig: any, prog: any) => {
        const sc = scenario.trim() || ref?.scenario || ref?.prompt || '';
        need(sc, 'Senaryo bulunamadı: Studio\'da senaryo yazın ya da senaryolu bir görsel aktarın.'); need(S.cast, 'En az bir karakter seçin.');
        const shots = only ? [only] : REJI_CAMERA_SHOTS.filter((s: any) => sel.includes(s.id));
        need(shots, 'En az bir kadraj seçin.');
        let cp = plan;
        if (!only || !cp) { prog(0.02, 'Süreklilik planı'); cp = await callGemini(`SCENE: ${sc}\nPRODUCTION STATE: ${S.prodCtx() || 'none'}\nOUTFIT LOCK: ${S.lockText()}\nCAST: ${JSON.stringify(S.cast.map((c: any) => ({ name: c.ad, sex: c.sex, dna: c.dna, outfit: c.outfit })))}`, true, SYS.cont, sig); setPlan(cp); }
        const refs = await S.refsOf(S.cast, sig), master = ref ? await toB64(ref.url, sig) : null, made: any[] = [];
        for (let i = 0; i < shots.length; i++) {
            chk(sig); const s = shots[i]; prog((i + 0.1) / shots.length, s.name);
            const prev = out[s.id] ? S.A(out[s.id]) : null;
            const base = fixText && prev ? await toB64(prev.url, sig) : master;
            const p = `[CINEMATIC MULTI-CAM REJI DIRECTED SHOT: ${s.name}]\nSCENE CONTEXT: ${sc}\nCAMERA SHOT: ${s.prompt}\nCHARACTERS: ${S.cast.map((c: any) => `[CHARACTER: ${c.ad} (${String(c.sex).toUpperCase()})] DNA: ${c.dna}. Wardrobe: ${c.outfit}.`).join(' | ')}\nOUTFIT LOCK: ${ref?.wardrobe || S.lockText()}\nSTYLE: ${opt(STYLE_PRESETS, style) || 'Photorealistic cinematic'}\nLENS: ${opt(CAMERA_SETUPS, cam) || '35mm focal depth'}\nCONTINUITY MANIFEST: ${cp?.continuity_lock_en || ''}${S.prodCtx() ? `\nPRODUCTION STATE: ${S.prodCtx()}` : ''}${base ? '\nREFERENCE FRAME: same people, outfits, location, light and time as the attached frame; only camera position and lens change.' : ''}${fixText ? `\nFIX: ${fixText}` : ''}`;
            const a = await S.produce({ sig, type: 'reji', name: s.name, tag: s.tag, prompt: p, ratio: aspect, seed: normalizeSeed(seed) ?? undefined, base, refs, anchorMode: fixText ? 'edit' : 'continuity', scenario: sc, audit: false, extra: { shotId: s.id, wardrobe: ref?.wardrobe || S.lockText() } });
            setOut((o: any) => ({ ...o, [s.id]: a.id })); made.push(a);
        }
        const list = ref ? made : made.slice(1);
        if (S.engine && list.length) { prog(0.95, 'Süreklilik denetimi'); const rep = await S.batchAudit(list, ref || made[0], sig); if (rep.size) setOut((o: any) => Object.fromEntries(Object.entries(o).map(([k, v]: any) => [k, rep.get(v)?.id || v]))); }
        S.notify('Reji çekimi tamamlandı.');
    });

    const auditAll = () => S.run('reji.audit', 'reji', 'Reji denetimi', async (sig: any) => {
        const list = REJI_CAMERA_SHOTS.map((s: any) => S.A(out[s.id])).filter(Boolean);
        const master = ref || list[0]; const rest = list.filter((x: any) => x !== master);
        need(master && rest.length, 'Denetim için referans ve en az bir kadraj gerekir.');
        const rep = await S.batchAudit(rest, master, sig); if (rep.size) setOut((o: any) => Object.fromEntries(Object.entries(o).map(([k, v]: any) => [k, rep.get(v)?.id || v])));
    });

    return (
        <div className="flex flex-col gap-4">
            <Box title="Reji Multi-Cam · senaryodan çoklu kamera" right={<LinkToggle S={S} tab="reji" />}>
                <p className="text-[11px] text-slate-500">Aynı anın farklı kamera açıları (A-Cam, omuz üstü, yakın plan…). Hikâyeyi zaman içinde ilerletmek için Storyboard sekmesini kullanın.</p>
                <Area label={S.link.reji !== false ? 'Sahne senaryosu (Sahne Kitabı ile ortak)' : 'Bu sekmeye özel senaryo'} value={scenario} onChange={setScenario} rows={3} />
                <div className="grid md:grid-cols-[minmax(0,320px)_1fr] gap-4">
                    <RefSlot title="A-Cam / master referansı" a={ref} S={S} onClear={() => setRefId(null)} onPick={setRefId} />
                    <div className="flex flex-col gap-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <Sel label="Stil" list={STYLE_PRESETS} value={style} onChange={setStyle} /><Sel label="Lens" list={CAMERA_SETUPS} value={cam} onChange={setCam} />
                            <Sel label="Oran" list={RATIOS} value={aspect} onChange={setAspect} /><Inp label="Seed (boş = rastgele)" value={seed} onChange={setSeed} />
                        </div>
                        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-1.5">{REJI_CAMERA_SHOTS.map((s: any) => (
                            <label key={s.id} className="flex items-start gap-2 rounded-lg border border-slate-800 p-2 text-[11px] text-slate-300"><input type="checkbox" checked={sel.includes(s.id)} onChange={() => setSel((x: string[]) => x.includes(s.id) ? x.filter(y => y !== s.id) : [...x, s.id])} /><span><b className="text-white">{s.name}</b><br /><span className="text-slate-500">{s.tag}</span></span></label>))}</div>
                        <div className="flex flex-wrap gap-2"><Btn tone="g" onClick={() => setSel(REJI_CAMERA_SHOTS.map((s: any) => s.id))}>Tümünü seç</Btn><Btn tone="g" onClick={() => setSel(['master', 'ots_reverse', 'reaction_c1'])}>Varsayılan</Btn>
                            <ActBtn S={S} k="reji.run" label={`Çekimi başlat (${sel.length})`} run={() => go()} disabled={!sel.length} /><ActBtn S={S} k="reji.audit" label="Süreklilik denetimi" run={auditAll} disabled={!Object.keys(out).length} tone="g" /></div>
                    </div>
                </div>
                {plan && <div className="text-[12px] text-slate-400 leading-relaxed"><b className="text-slate-200">Blocking:</b> {plan.blocking_tr}<br /><b className="text-slate-200">Aksiyon ekseni:</b> {plan.action_axis_tr}</div>}
            </Box>
            {REJI_CAMERA_SHOTS.some((s: any) => S.A(out[s.id])) && (
                <Box title="Çekim sonuçları · görsele tıklayınca sıradaki kadraja geçer">
                    <Gallery S={S} items={REJI_CAMERA_SHOTS.map((s: any) => ({ label: s.tag, a: S.A(out[s.id]) }))}
                        extra={(a: any) => { const s = REJI_CAMERA_SHOTS.find((x: any) => x.id === a.shotId); return s ? <><Btn tone="g" disabled={S.busy('reji*')} onClick={() => go(s)}>Yeniden üret</Btn>{a.verdict?.fix_prompt_en && <Btn tone="g" disabled={S.busy('reji*')} onClick={() => go(s, a.verdict.fix_prompt_en)}>Öneriyi uygula</Btn>}</> : null; }} />
                </Box>)}
        </div>
    );
};

const LabTab = ({ S }: any) => {
    const [mode, setMode] = usePersist('lab.mode', 'edit'); const [prompt, setPrompt] = usePersist('lab.prompt', '');
    const [aspect, setAspect] = usePersist('lab.aspect', '16:9'); const [charId, setCharId] = usePersist('lab.char', '');
    const [seed, setSeed] = usePersist('lab.seed', ''); const [magic, setMagic] = usePersist('lab.magic', MAGIC_LIGHTS[0].id);
    const [lt, setLt] = usePersist('lab.lt', 'any'); const [ls, setLs] = usePersist('lab.ls', 'any');
    const [refId, setRefId] = useState<any>(null); const [afterId, setAfterId] = useState<any>(null); const [view, setView] = useState(0);
    const [note, setNote] = useState(''); const [analysis, setAnalysis] = useState('');
    const ref = S.A(refId), after = S.A(afterId), shown = after && view === 1 ? after : ref;
    const MODES: any[] = [['edit', '✎ Düzenle', 'Komutla rötuş; “AI öneri” ile Director\'s Cut'], ['light', '☀ Işık', 'Hazır ışık ayarları'], ['expand', '⤢ Genişlet', 'Oranı büyüt (outpaint)'], ['analyze', '⌕ Analiz', 'Görselden prompt çıkar']];
    const pick = (id: string) => { setRefId(id); setAfterId(null); setView(0); setNote(''); setAnalysis(''); };

    useEffect(() => {
        const p = S.pkt.lab; if (!p) return; const a = p.asset;
        pick(a.id);
        detectClosestAspectRatio(a.url).then((r: string) => { if (has(RATIOS, r)) setAspect(r); }).catch(() => { });
        S.clearPkt('lab');
    }, [S.pkt.lab?.n]);

    const suggest = () => S.run('lab.suggest', 'lab', "Director's Cut önerisi", async (sig: any) => {
        need(ref, 'Önce referans görsel yükleyin.');
        const r = await callGeminiWithImages(`ORIGINAL PROMPT: ${ref.prompt || ''}`, [await toB64(ref.url, sig)], true, SYS.cut, sig);
        setNote(r.critique_tr || ''); setPrompt(r.edit_prompt_en || '');
    });

    const run = () => S.run('lab.run', 'lab', `Image Lab · ${mode}`, async (sig: any) => {
        need(ref, 'Image Lab için önce bir referans görsel belirleyin.');
        const base = await toB64(ref.url, sig);
        if (mode === 'analyze') { setAnalysis(await callGemini('Analyze this image and reconstruct its production-ready master prompt.', false, SYS.analyze, sig, base.data, base.mimeType)); S.notify('Görsel analiz edildi.'); return; }
        const ch = S.chars.find((c: any) => c.id === charId);
        const refs = ch ? await S.refsOf([ch], sig) : await S.refsOf(S.castOf(ref), sig);
        let fp = '', tag = 'EDIT', name = 'Lab · Düzenle';
        if (mode === 'expand') { fp = `[STRICT OUTPAINTING TO ${aspect}] Preserve original image center and subjects. ${prompt || 'Seamlessly extend the environment.'}`; tag = 'EXPAND'; name = 'Lab · Genişlet'; }
        else if (mode === 'light') {
            const m = MAGIC_LIGHTS.find((x: any) => x.id === magic);
            fp = `[RELIGHT] ${m?.prompt}${opt(LIGHT_TIMES, lt) ? `, ${opt(LIGHT_TIMES, lt)}` : ''}${opt(LIGHT_STYLES, ls) ? `, ${opt(LIGHT_STYLES, ls)}` : ''}. Keep faces, identity, outfits, pose, composition and background unchanged; change only lighting and color grade.`; tag = 'RELIGHT'; name = `Lab · Işık (${m?.label})`;
        } else {
            need(prompt, 'Düzenleme komutu girin ya da “AI öneri” kullanın.');
            fp = `[STRICT IMAGE EDIT LOCK] ${await callGemini(`USER EDIT: ${prompt}\nTARGET CHARACTER: ${ch?.ad || 'general'}\nOUTFIT LOCK: ${ref.wardrobe || S.lockText()}`, false, SYS.edit, sig, base.data, base.mimeType)}`;
        }
        const a = await S.produce({ sig, type: 'lab', name, tag, prompt: fp, ratio: aspect, seed: normalizeSeed(seed) ?? undefined, base, refs, parentId: ref.id, audit: false, scenario: ref.scenario, extra: { wardrobe: ref.wardrobe } });
        setAfterId(a.id); setView(1);
        const af = split64(a.url);
        if (S.engine && af) { try { S.patchAsset(a.id, { verdict: normV(await callGeminiWithImages(`EDIT INTENT: ${prompt || fp}`, [base, af], true, SYS.labCrit, sig)) }); } catch (e: any) { if (isAbort(e)) throw e; } }
        S.notify('Image Lab işlemi tamamlandı — görsele tıklayarak önce/sonra arasında geçin.');
    });

    const runLabel = mode === 'analyze' ? 'Görseli analiz et' : mode === 'light' ? 'Işığı uygula' : mode === 'expand' ? 'Genişlet' : 'Düzenlemeyi uygula';

    return (
        <div className="flex flex-col gap-4">
            <Box title="Image Lab" right={<div className="flex flex-wrap gap-1">{MODES.map(([id, t, d]) => <button key={id} title={d} onClick={() => setMode(id)} className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${mode === id ? 'bg-[#8B5CF6]/25 text-[#C4B5FD]' : 'bg-[#16181E] text-slate-400 hover:text-white'}`}>{t}</button>)}</div>}>
                <p className="text-[11px] text-slate-500">{MODES.find(m => m[0] === mode)?.[2]}</p>
                {mode === 'edit' && <>
                    <Area label="Komut (Türkçe olabilir)" value={prompt} onChange={setPrompt} rows={2} ph="Örn: Arka plandaki kalabalığı kaldır, kıyafet rengini koru" />
                    <div><ActBtn S={S} k="lab.suggest" label="AI öneri (Director's Cut)" run={suggest} disabled={!ref} tone="g" /></div>
                    {note && <p className="text-[12px] text-slate-400">{note}</p>}
                </>}
                {mode === 'light' && <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{MAGIC_LIGHTS.map((m: any) => (
                        <button key={m.id} onClick={() => setMagic(m.id)} className={`rounded-xl border p-3 text-left transition-colors ${magic === m.id ? 'border-[#8B5CF6] bg-[#8B5CF6]/10' : 'border-slate-800 bg-[#0D0F14] hover:border-slate-600'}`}>
                            <b className="text-[12px] text-white">{m.label}</b><br /><span className="text-[10px] text-slate-500 line-clamp-3">{m.prompt}</span></button>))}</div>
                    <div className="grid grid-cols-2 gap-2"><Sel label="Ek ışık zamanı" list={LIGHT_TIMES} value={lt} onChange={setLt} /><Sel label="Ek ışık stili" list={LIGHT_STYLES} value={ls} onChange={setLs} /></div>
                </>}
                {mode === 'expand' && <Area label="Genişletme notu (isteğe bağlı)" value={prompt} onChange={setPrompt} rows={2} ph="Örn: Sağ tarafa Boğaz manzarası eklensin" />}
                {mode === 'analyze' && analysis && <>
                    <Area label="Çıkarılan master prompt" value={analysis} onChange={setAnalysis} rows={7} />
                    <div className="flex flex-wrap gap-2"><Btn tone="g" onClick={() => S.copy(analysis)}>Kopyala</Btn>
                        <Btn tone="g" onClick={() => { S.patchScene({ prompt: analysis }); S.setTab('studio'); S.notify('Prompt Studio\'ya aktarıldı.'); }}>Studio promptu yap</Btn>
                        <Btn tone="g" onClick={() => { S.newSceneWith({ prompt: analysis, title: 'Analizden Sahne' }); S.setTab('studio'); }}>Yeni sahne olarak başlat</Btn></div></>}
                {mode !== 'analyze' && <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <Sel label="Hedef oran" list={RATIOS} value={aspect} onChange={setAspect} />
                    <Sel label="Hedef karakter" list={[{ id: '', tr: 'Genel' }, ...S.chars.map((c: any) => ({ id: c.id, tr: c.ad }))]} value={charId} onChange={setCharId} />
                    <Inp label="Seed" value={seed} onChange={setSeed} />
                </div>}
                <div><ActBtn S={S} k="lab.run" label={runLabel} run={run} disabled={!ref} /></div>
            </Box>
            {!ref
                ? <Box title="Referans görsel"><RefSlot title="Düzenlenecek görsel" a={null} S={S} onClear={() => { }} onPick={pick} /></Box>
                : <Box title="Önizleme" right={<Btn tone="g" onClick={() => { setRefId(null); setAfterId(null); setView(0); }}>Referansı kaldır</Btn>}>
                    <Flip items={[{ label: 'ÖNCE', a: ref }, { label: 'SONRA', a: after }]} index={after ? view : 0} onIndex={setView} S={S} />
                    <AssetActions a={shown} S={S} plain={shown === ref} extra={after && shown === after ? <Btn tone="a" onClick={() => pick(after.id)}>Sonucu yeni referans yap</Btn> : null} />
                </Box>}
        </div>
    );
};

const NextTab = ({ S }: any) => {
    const [scenario, setScenario] = useScenario(S, 'next');
    const [action, setAction] = usePersist('next.action', '');
    const [shotId, setShotId] = usePersist('next.shot', STORY_CAMERA_SHOTS[0].id);
    const [count, setCount] = usePersist('next.count', '1'); const [lockOutfit, setLockOutfit] = usePersist('next.lock', true);
    const [anchorId, setAnchorId] = useState<any>(null); const [startId, setStartId] = useState<any>(null); const [made, setMade] = useState<string[]>([]); const [view, setView] = useState(1);
    const [aiActs, setAiActs] = useState<string[]>([]);
    const anchor = S.A(anchorId), start = S.A(startId);
    const chain = [start, ...made.map((id: string) => S.A(id))].filter(Boolean);
    const vi = Math.max(1, Math.min(view, chain.length - 1));
    const left = chain[vi - 1], right = chain[vi];

    useEffect(() => {
        const p = S.pkt.next; if (!p) return; const a = p.asset;
        setAnchorId(a.id); setStartId(a.id); setMade([]); setView(1); setAiActs([]);
        if (a.scenario) setScenario(a.scenario);
        S.clearPkt('next');
    }, [S.pkt.next?.n]);

    const suggest = async (cur: any, sig: any) => String(await callGeminiWithImages(
        `SCENARIO: ${scenario || cur.scenario || ''}\nPRODUCTION STATE: ${S.prodCtx() || 'none'}\nPREVIOUS PROMPT: ${cur.prompt || ''}\nCAST: ${S.castInfo(S.castOf(cur))}`,
        [await toB64(cur.url, sig)], false, SYS.nextAct, sig)).trim();

    const suggestJob = () => S.run('next.suggest', 'next', 'Aksiyon öneriliyor', async (sig: any) => {
        need(anchor, 'Önce başlangıç karesi seçin.');
        setAction(await suggest(anchor, sig));
    });

    const go = () => S.run('next.run', 'next', 'Next Frame', async (sig: any, prog: any) => {
        let cur = S.A(anchorId);
        need(cur, 'Başlangıç karesi seçin (Film şeridinden “Yükle”).');
        const shot = STORY_CAMERA_SHOTS.find((s: any) => s.id === shotId) || STORY_CAMERA_SHOTS[0], n = Math.max(1, Number(count) || 1);
        const refs = await S.refsOf(S.castOf(cur), sig); setStartId(cur.id); setMade([]); setView(1); setAiActs([]);
        for (let i = 0; i < n; i++) {
            chk(sig); prog(i / n, `Kare ${i + 1}/${n}`);
            const base = await toB64(cur.url, sig);
            const ratio = cur.ratio && cur.ratio !== 'any' ? cur.ratio : await detectClosestAspectRatio(cur.url);
            const lock = lockOutfit ? (cur.wardrobe || S.lockText()) : '';
            const manual = action.trim();
            const act = manual || await suggest(cur, sig);
            if (!manual) setAiActs((l: string[]) => [...l, act]);
            let p = await callGeminiWithImages(`SCENARIO: ${scenario || cur.scenario || ''}\nPRODUCTION STATE: ${S.prodCtx() || 'none'}\nPREVIOUS PROMPT: ${cur.prompt || ''}\nNEXT ACTION: ${act}${manual && n > 1 ? ` (beat ${i + 1} of ${n}, continue the progression)` : ''}\nCAMERA MOTION: ${shot.prompt}\n${lock ? `OUTFIT LOCK (must stay identical): ${lock}` : 'Outfit may change only if the action requires it.'}`, [base], false, SYS.next, sig);
            p = `[NEXT FRAME] ${p}${lock ? ` OUTFIT LOCK: ${lock}` : ''}`;
            const a = await S.produce({ sig, type: 'next', name: `Next Frame · ${shot.name}`, tag: `FLOW-${i + 1}`, prompt: p, ratio, base, refs, anchorMode: 'continuity', parentId: cur.id, scenario: scenario || cur.scenario, pre: true, audit: true, auditRefId: cur.id, extra: { wardrobe: lock || cur.wardrobe } });
            setMade((m: string[]) => [...m, a.id]); setView(i + 1); cur = a; setAnchorId(a.id);
        }
        S.notify('Devam kareleri üretildi; son kare yeni başlangıç karesi oldu.');
    });

    return (
        <div className="flex flex-col gap-4">
            <Box title="Next Frame · bir sonraki kare / devam zinciri" right={<LinkToggle S={S} tab="next" />}>
                <div className="grid md:grid-cols-[minmax(0,340px)_1fr] gap-4">
                    <RefSlot title="Başlangıç karesi" a={anchor} S={S} onClear={() => setAnchorId(null)} onPick={(id: string) => { setAnchorId(id); setStartId(id); setMade([]); setView(1); setAiActs([]); }} />
                    <div className="flex flex-col gap-3">
                        <Area label={S.link.next !== false ? 'Sahne senaryosu (ortak)' : 'Bu sekmeye özel senaryo'} value={scenario} onChange={setScenario} rows={2} />
                        <Area label="Sonraki aksiyon (boş bırakırsan yapay zekâ kareye bakıp kendisi belirler)" value={action} onChange={setAction} rows={2} ph="Örn: Lena bardağını masaya koyar ve boğaza doğru bakar." />
                        <div className="flex flex-wrap gap-2"><ActBtn S={S} k="next.suggest" label="✨ AI aksiyon öner" run={suggestJob} disabled={!anchor} tone="g" />{action.trim() && <Btn tone="g" onClick={() => setAction('')}>Temizle (AI belirlesin)</Btn>}</div>
                        <div className="grid grid-cols-2 gap-2"><Sel label="Kamera hareketi" list={STORY_CAMERA_SHOTS} value={shotId} onChange={setShotId} /><Sel label="Zincir uzunluğu" list={['1', '2', '3', '4'].map(x => ({ id: x, tr: `${x} kare` }))} value={count} onChange={setCount} /></div>
                        <p className="text-[11px] text-slate-500">{STORY_CAMERA_SHOTS.find((s: any) => s.id === shotId)?.desc}</p>
                        <label className="flex items-center gap-2 text-[12px] text-slate-300"><input type="checkbox" className="accent-[#8B5CF6]" checked={lockOutfit} onChange={e => setLockOutfit(e.target.checked)} />Kıyafet kilidi: önceki karenin kıyafeti aynen taşınsın</label>
                        <div><ActBtn S={S} k="next.run" label="Sonraki kareyi üret" run={go} disabled={!anchor} /></div>
                    </div>
                </div>
            </Box>
            {made.length > 0 && right && left && <Box title="Önceki kare → Yeni kare" right={chain.length > 2 ? <div className="flex flex-wrap gap-1">{chain.slice(1).map((_: any, k: number) => <button key={k} onClick={() => setView(k + 1)} className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${k + 1 === vi ? 'bg-[#8B5CF6]/25 text-[#C4B5FD]' : 'text-slate-500 hover:text-white'}`}>{k === 0 ? 'BAŞLANGIÇ' : `KARE ${k}`} → KARE {k + 1}</button>)}</div> : null}>
                <div className="grid md:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5"><div className="text-[11px] font-semibold text-slate-400">{vi === 1 ? 'BAŞLANGIÇ' : `KARE ${vi - 1}`}</div><Pane a={left} list={chain} S={S} /></div>
                    <div className="flex flex-col gap-1.5"><div className="text-[11px] font-semibold text-[#C4B5FD]">KARE {vi} (yeni)</div><Pane a={right} list={chain} S={S} /></div>
                </div>
                {aiActs[vi - 1] && <p className="text-[11px] text-slate-400">AI aksiyonu: {aiActs[vi - 1]}</p>}
                <AssetActions a={right} S={S} />
            </Box>}
        </div>
    );
};

const StoryTab = ({ S }: any) => {
    const [scenario, setScenario] = useScenario(S, 'story');
    const [density, setDensity] = usePersist('story.density', 'balanced'); const [mode, setMode] = usePersist('story.mode', 'chain');
    const [ratio, setRatio] = usePersist('story.ratio', '16:9');
    const [plan, setPlan] = usePersist('story.plan', []); const [manifest, setManifest] = usePersist('story.manifest', ''); const [dur, setDur] = usePersist('story.dur', '');
    const [refId, setRefId] = useState<any>(null); const [out, setOut] = useState<any>({});
    const ref = S.A(refId);
    const outRef = useRef<any>({}); outRef.current = out;

    useEffect(() => {
        const p = S.pkt.story; if (!p) return; const a = p.asset;
        setRefId(a.id); if (a.scenario) setScenario(a.scenario);
        S.clearPkt('story');
    }, [S.pkt.story?.n]);

    const planJob = () => S.run('story.plan', 'story', 'Storyboard planlanıyor', async (sig: any) => {
        need(scenario, 'Hikâye/senaryo gerekli.'); need(S.cast, 'En az bir karakter seçin.');
        const rule = density === 'short' ? 'minimum essential shots' : density === 'detailed' ? 'rich, detailed coverage with inserts and reactions' : 'balanced coverage';
        const r = await callGemini(`Plan a storyboard using ${rule}.\nSTORY: ${scenario}\nCAST: ${JSON.stringify(S.castPayload())}\nOUTFIT LOCK: ${S.lockText()}\nPRODUCTION STATE: ${S.prodCtx() || 'none'}\nREFERENCE PROMPT: ${ref?.prompt || ''}`, true, SYS.story, sig);
        setPlan((r.shots || []).map((s: any, i: number) => ({ ...s, order: i + 1, selected: true }))); setManifest(r.manifest_en || ''); setDur(r.estimated_duration || ''); setOut({});
        S.notify(`Storyboard planı hazır: ${(r.shots || []).length} plan.`);
    });

    const patch = (i: number, p: any) => setPlan((x: any[]) => x.map((s, k) => k === i ? { ...s, ...p } : s));
    const shotPrompt = (s: any) => `[AiFotofilm STORYBOARD SHOT ${s.order}] ${s.image_prompt_en}. ACTION: ${s.action}. FRAMING: ${[s.shot_size, s.angle, s.lens, s.movement].filter(Boolean).join(', ')}. DIFFERENT STORY MOMENT: new pose, new action and a clearly new composition; only identities, outfits, art style and light mood stay identical. CONTINUITY MANIFEST (obey strictly): ${manifest}. OUTFIT LOCK: ${S.lockText()}.${S.prodCtx() ? ` PRODUCTION STATE: ${S.prodCtx()}.` : ''}`;

    const renderOne = async (i: number, baseA: any, sig: any, refs: any[]) => {
        const s = plan[i], base = baseA ? await toB64(baseA.url, sig) : null;
        const a = await S.produce({ sig, type: 'storyboard', name: `${pad(s.order)} · ${s.title}`, tag: `SHOT-${pad(s.order)}`, prompt: shotPrompt(s), ratio, base, refs, anchorMode: 'continuity', scenario, audit: false, extra: { duration: s.duration, storyBeat: s.story_beat, wardrobe: S.lockText() } });
        setOut((o: any) => ({ ...o, [i]: a.id })); return a;
    };

    const runAll = (missing: boolean) => {
        const idx = plan.map((_: any, i: number) => i).filter((i: number) => plan[i].selected !== false && (!missing || !S.A(outRef.current[i])));
        if (!idx.length) return S.notify('Üretilecek plan yok.', 'error');
        if (mode === 'chain') return S.run('story.all', 'story', 'Storyboard (zincir)', async (sig: any, prog: any) => {
            const refs = await S.refsOf(S.cast, sig);
            const made: any[] = [];
            let prev = ref || (idx[0] > 0 ? S.A(outRef.current[idx[0] - 1]) : null);
            for (let n = 0; n < idx.length; n++) { chk(sig); prog(n / idx.length, `Kare ${idx[n] + 1}`); const a = await renderOne(idx[n], prev, sig, refs); made.push(a); prev = a; }
            if (S.engine && made.length > 1) { prog(0.97, 'Süreklilik denetimi'); const rep = await S.batchAudit(made.slice(1), ref || made[0], sig); if (rep.size) setOut((o: any) => Object.fromEntries(Object.entries(o).map(([k, v]: any) => [k, rep.get(v)?.id || v]))); }
            S.notify(`${made.length} storyboard karesi üretildi.`);
        });
        return (async () => {
            let anchorA: any = ref || null, rest = idx;
            if (!anchorA) { anchorA = await S.run(`story.s${idx[0]}`, 'story', `Kare ${idx[0] + 1}`, async (sig: any) => renderOne(idx[0], null, sig, await S.refsOf(S.cast, sig))); if (!anchorA) return; rest = idx.slice(1); }
            const made = (await Promise.all(rest.map((i: number) => S.run(`story.s${i}`, 'story', `Kare ${i + 1}`, async (sig: any) => renderOne(i, anchorA, sig, await S.refsOf(S.cast, sig)))))).filter(Boolean);
            if (S.engine && made.length) { const rep = await S.run('story.audit', 'story', 'Süreklilik denetimi', async (sig: any) => S.batchAudit(made, anchorA, sig)); if (rep?.size) setOut((o: any) => Object.fromEntries(Object.entries(o).map(([k, v]: any) => [k, rep.get(v)?.id || v]))); }
            S.notify(`${made.length + (ref ? 0 : 1)} storyboard karesi üretildi (hızlı mod).`);
        })();
    };

    const one = (i: number) => S.run(`story.s${i}`, 'story', `Kare ${i + 1}`, async (sig: any) => renderOne(i, S.A(outRef.current[i - 1]) || ref, sig, await S.refsOf(S.cast, sig)));
    const job = S.jobOf('story.all');
    const selCount = plan.filter((s: any) => s.selected !== false).length, doneCount = plan.filter((_: any, i: number) => S.A(out[i])).length;

    return (
        <div className="flex flex-col gap-4">
            <Box title="Storyboard · plan ve toplu üretim" right={<LinkToggle S={S} tab="story" />}>
                <p className="text-[11px] text-slate-500">Hikâyenin zaman içindeki farklı anları: her kare farklı kadraj/aksiyon alır, yalnızca kimlik, kıyafet ve ışık havası sabit kalır. Aynı anın farklı açıları için Reji Multi-Cam sekmesini kullanın.</p>
                <div className="grid md:grid-cols-[minmax(0,300px)_1fr] gap-4">
                    <RefSlot title="Referans / ilk kare (opsiyonel)" a={ref} S={S} onClear={() => setRefId(null)} onPick={setRefId} hint="Görsel yoksa ilk kare sıfırdan üretilir; sonrakiler ondan türer." />
                    <div className="flex flex-col gap-3">
                        <Area label={S.link.story !== false ? 'Hikâye / sahne senaryosu (ortak)' : 'Bu sekmeye özel hikâye'} value={scenario} onChange={setScenario} rows={3} />
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <Sel label="Yoğunluk" list={[{ id: 'short', tr: 'Kısa' }, { id: 'balanced', tr: 'Dengeli' }, { id: 'detailed', tr: 'Detaylı' }]} value={density} onChange={setDensity} />
                            <Sel label="Üretim modu" list={[{ id: 'chain', tr: 'Zincir (en tutarlı)' }, { id: 'fast', tr: 'Hızlı (2 paralel)' }]} value={mode} onChange={setMode} />
                            <Sel label="Oran" list={RATIOS} value={ratio} onChange={setRatio} />
                        </div>
                        <div className="flex flex-wrap gap-2"><ActBtn S={S} k="story.plan" label="Storyboard planla" run={planJob} disabled={!scenario.trim()} />
                            {plan.length > 0 && <><ActBtn S={S} k="story*" label={`Tüm sahneleri oluştur (${selCount})`} run={() => runAll(false)} />
                                <Btn tone="g" disabled={S.busy('story*')} onClick={() => runAll(true)}>Eksikleri oluştur</Btn></>}</div>
                        {job && <div><div className="h-2 rounded bg-slate-800 overflow-hidden"><div className="h-full bg-[#8B5CF6]" style={{ width: `${Math.round((job.progress || 0) * 100)}%` }} /></div><p className="text-[11px] text-slate-500 mt-1">{job.text}</p></div>}
                        {plan.length > 0 && <p className="text-[12px] text-slate-400">Tahmini süre: {dur || '-'} · {doneCount}/{plan.length} kare üretildi · {selCount} plan seçili</p>}
                    </div>
                </div>
                {plan.length > 0 && S.showP && <Area label="Süreklilik manifestosu (kıyafet, mekan, ışık — tüm karelere işlenir)" value={manifest} onChange={setManifest} rows={3} />}
            </Box>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">{plan.map((s: any, i: number) => (
                <Box key={i}>
                    <label className="flex items-center gap-2 text-[12px] font-semibold text-white"><input type="checkbox" checked={s.selected !== false} onChange={e => patch(i, { selected: e.target.checked })} />{pad(s.order)} · {s.title}</label>
                    <p className="text-[11px] text-slate-400">{s.story_beat} — {s.action}<br /><span className="text-slate-500">{[s.shot_size, s.angle, s.lens, s.movement, s.duration && `${s.duration}s`].filter(Boolean).join(' · ')}</span></p>
                    {S.showP && <Area label="Görsel promptu" value={s.image_prompt_en || ''} onChange={(v: string) => patch(i, { image_prompt_en: v })} rows={3} />}
                    {S.A(out[i]) && <AssetCard a={S.A(out[i])} S={S} group={plan.map((_: any, k: number) => S.A(out[k])).filter(Boolean)} />}
                    <div><ActBtn S={S} k={`story.s${i}`} label={S.A(out[i]) ? 'Bu kareyi yeniden çiz' : 'Bu kareyi çiz'} run={() => one(i)} tone="g" /></div>
                </Box>))}</div>
        </div>
    );
};

const VideoTab = ({ S }: any) => {
    const [list, setList] = usePersist('video.list', []); const [modeId, setModeId] = usePersist('video.mode', 'se');
    const [movId, setMovId] = usePersist('video.mov', 'dolly_in'); const [pk, setPk] = usePersist('video.pk', {}); const [neg, setNeg] = usePersist('video.neg', NEG_VIDEO);
    const items = list.map((id: string) => S.A(id)).filter(Boolean);
    const mode = VIDEO_MODES.find(m => m.id === modeId) || VIDEO_MODES[0];

    useEffect(() => {
        const p = S.pkt.video; if (!p) return;
        setList((l: string[]) => l.includes(p.asset.id) ? l : [...l, p.asset.id]); S.clearPkt('video');
    }, [S.pkt.video?.n]);

    const castSheet = () => { const c = S.cast.find((x: any) => x.identitySheet || x.img); return c ? { url: c.identitySheet || c.img, name: `${c.ad} kimlik sayfası` } : null; };
    const fieldsFor = (A: any, B: any) => {
        if (mode.id === 'se') return [{ label: mode.fields[0], a: A }, { label: mode.fields[1], a: B }];
        if (mode.id === 'i2v') return [{ label: mode.fields[0], a: A }];
        return [{ label: mode.fields[0], a: castSheet() || A }, { label: mode.fields[1], a: A }, { label: mode.fields[2], a: B }];
    };

    const gen = (i: number) => S.run(`video.${i}`, 'video', `Video promptu ${i + 1}`, async (sig: any) => {
        const A = items[i], B = items[i + 1], m = VIDEO_CAMERA_MOVEMENTS.find((x: any) => x.id === movId);
        const imgs = [await toB64(A.url, sig)]; if (B && mode.id !== 'i2v') imgs.push(await toB64(B.url, sig));
        const t = await callGeminiWithImages(`TARGET MODE: ${mode.tr}\nCAMERA MOVEMENT: ${m?.prompt}\nDURATION: ${(pk[A.id]?.dur || A.duration || 5)}s\nSCENARIO: ${A.scenario || ''}\nPRODUCTION STATE: ${S.prodCtx() || 'none'}\nOUTFIT LOCK: ${A.wardrobe || S.lockText()}\nSTART PROMPT: ${A.prompt || ''}\nSTORY BEAT: ${A.storyBeat || ''}\n${B && mode.id !== 'i2v' ? `Image 2 is the END frame. END PROMPT: ${B.prompt || ''}` : 'Only a start frame exists; continue the action naturally.'}`, imgs, false, SYS.video, sig);
        setPk((x: any) => ({ ...x, [A.id]: { ...(x[A.id] || {}), prompt: t, dur: x[A.id]?.dur || A.duration || 5 } }));
    });

    const genAll = async () => { for (let i = 0; i < items.length; i++) await gen(i); };
    const move = (i: number, d: number) => setList((l: string[]) => { const a = [...l], j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });
    const pack = (i: number) => {
        const A = items[i], B = items[i + 1], p = pk[A.id] || {};
        return `VIDEO PAKETİ ${i + 1} — ${mode.tr}\n${fieldsFor(A, B).filter(f => f.a).map(f => `[${f.label}] ${f.a.name || f.a.url} (${f.a.tag || 'görsel'})`).join('\n')}\n\nPROMPT:\n${p.prompt || ''}\n\nNEGATIVE PROMPT:\n${neg}\n\nSÜRE: ${p.dur || 5}s · ORAN: ${A.ratio || '16:9'} · KAMERA: ${VIDEO_CAMERA_MOVEMENTS.find((x: any) => x.id === movId)?.label}`;
    };

    return (
        <div className="flex flex-col gap-4">
            <Box title="Video Prep · platforma hazır paketler" right={<Btn tone="g" disabled={!items.length || S.busy('video*')} onClick={genAll}>Tüm promptları üret</Btn>}>
                <div className="grid md:grid-cols-3 gap-2"><Sel label="Platform paketi" list={VIDEO_MODES} value={modeId} onChange={setModeId} /><Sel label="Kamera modeli" list={VIDEO_CAMERA_MOVEMENTS} value={movId} onChange={setMovId} /></div>
                <p className="text-[11px] text-slate-500">Platformların alan adları değişebildiği için paketler “ne nereye yüklenecek” mantığıyla hazırlanır; her görselin hangi alana konacağı kartlarda etiketlidir.</p>
                <Area label="Olumsuz prompt (negative)" value={neg} onChange={setNeg} rows={2} />
                {!items.length && <p className="text-[12px] text-slate-500">Liste boş. Film şeridinden “Aktar… → Video Prep” ile kare ekleyin; kareler sırayla birbirine geçiş olarak planlanır.</p>}
            </Box>
            {items.map((A: any, i: number) => {
                const B = items[i + 1], p = pk[A.id] || {};
                return (
                    <Box key={A.id} title={`Segment ${i + 1}: ${A.name}${B && mode.id !== 'i2v' ? ` → ${B.name}` : ''}`} right={<div className="flex gap-1"><Btn tone="g" onClick={() => move(i, -1)}>↑</Btn><Btn tone="g" onClick={() => move(i, 1)}>↓</Btn><Btn tone="r" onClick={() => setList((l: string[]) => l.filter(x => x !== A.id))}>✕</Btn></div>}>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">{fieldsFor(A, B).map((f: any, k: number) => (
                            <div key={k} className="rounded-xl border border-slate-800 p-2 flex flex-col gap-1">
                                <div className="text-[10px] uppercase tracking-wide text-[#A78BFA]">{f.label}</div>
                                {f.a ? <><div className="bg-black rounded-lg overflow-hidden" style={{ aspectRatio: cssRatio(f.a.ratio) }}><img src={f.a.url} alt="" className="w-full h-full object-contain" /></div>
                                    <div className="flex gap-1"><Btn tone="g" onClick={() => dl(f.a.url, `video_${i + 1}_${k + 1}`)}>İndir</Btn></div></> : <div className="text-[11px] text-slate-600 py-6 text-center">Bu alan için kare yok</div>}
                            </div>))}</div>
                        <div className="flex flex-wrap gap-2"><ActBtn S={S} k={`video.${i}`} label="Video promptu üret" run={() => gen(i)} />
                            <Sel label="" list={['4', '5', '8', '10'].map(x => ({ id: x, tr: `${x} sn` }))} value={String(p.dur || A.duration || 5)} onChange={(v: string) => setPk((x: any) => ({ ...x, [A.id]: { ...(x[A.id] || {}), dur: v } }))} /></div>
                        {p.prompt && <><Area label="Video promptu" value={p.prompt} onChange={(v: string) => setPk((x: any) => ({ ...x, [A.id]: { ...(x[A.id] || {}), prompt: v } }))} rows={5} />
                            <div className="flex flex-wrap gap-2"><Btn tone="g" onClick={() => S.copy(p.prompt)}>Promptu kopyala</Btn><Btn tone="g" onClick={() => S.copy(neg)}>Negatifi kopyala</Btn><Btn tone="a" onClick={() => S.copy(pack(i))}>Tüm paketi kopyala</Btn></div></>}
                    </Box>);
            })}
        </div>
    );
};

const InfluencerTab = ({ S }: any) => {
    const [charIds, setCharIds] = usePersist('inf.chars', ['lena']); const [topic, setTopic] = usePersist('inf.topic', 'İstanbul Galata sokaklarında bahar stil kombini ve kahve molası');
    const [format, setFormat] = usePersist('inf.format', 'story'); const [n, setN] = usePersist('inf.n', '3'); const [useScene, setUseScene] = usePersist('inf.scene', false);
    const [ideas, setIdeas] = useState<string[]>([]); const [res, setRes] = useState<any>(null); const [fixes, setFixes] = useState<any>({});
    const picked = S.chars.filter((x: any) => charIds.includes(x.id));
    const group = picked.length ? picked : S.chars.slice(0, 1);
    const FORMATS: any[] = [{ id: 'story', tr: 'Story (9:16)', ratio: '9:16' }, { id: 'post', tr: 'Post (4:5)', ratio: '4:5' }, { id: 'reel', tr: 'Reel kapak (9:16)', ratio: '9:16' }];
    const fmt = FORMATS.find(f => f.id === format) || FORMATS[0];
    const toggle = (id: string) => setCharIds((l: string[]) => l.includes(id) ? (l.length > 1 ? l.filter(x => x !== id) : l) : [...l, id]);
    const castLine = (list: any[]) => list.map(c => `[CHARACTER: ${String(c.ad).toUpperCase()} (${String(c.sex).toUpperCase()}) — ${c.genderLock}] DNA: ${c.dna}. Default outfit: ${c.outfit}.`).join(' | ');
    const lockOf = (list: any[]) => list.map(c => `${String(c.ad).toUpperCase()} is EXACTLY wearing: ${c.outfit}.`).join(' ');
    const tags = (h: any[]) => (h || []).map((x: string) => (String(x).startsWith('#') ? x : `#${x}`)).join(' ');

    const makeShot = (plan: any, i: number, list: any[], refs: any[], sig: any) => S.produce({
        sig, type: 'influencer', name: plan.title || `Kare ${i + 1}`, tag: `${fmt.id.toUpperCase()}-${i + 1}`, ratio: fmt.ratio, refs, castList: list, audit: true, scenario: topic,
        prompt: `[INFLUENCER ${fmt.tr}] ${castLine(list)} OUTFIT LOCK: ${lockOf(list)}${list.length > 1 ? ` All ${list.length} characters appear together in the same frame, each with their own distinct face, sex and outfit.` : ''} ${plan.prompt}`,
        extra: { characters: list.map(c => c.ad), castIds: list.map(c => c.id), wardrobe: lockOf(list) }
    });

    const ideasJob = () => S.run('inf.ideas', 'influencer', 'Fikirler üretiliyor', async (sig: any) => {
        const j = await callGemini(`Characters: ${group.map((c: any) => `${c.ad}: ${JSON.stringify(S.profiles[c.id] || {})}`).join(' | ')}. Trend notes: ${S.trends || 'none'}.`, true, SYS.ideas, sig); setIdeas(j.ideas || []);
    });

    const go = () => S.run('inf.run', 'influencer', 'Influencer içeriği', async (sig: any, prog: any) => {
        need(group, 'Karakter seçin.'); need(topic, 'İçerik konusu belirtin.');
        const j = await callGemini(`Characters: ${group.map((c: any) => `${c.ad} (${c.sex}). DNA: ${c.dna}. Profile: ${JSON.stringify(S.profiles[c.id] || {})}`).join(' || ')}. Trend notes: ${S.trends || 'none'}. ${useScene ? `Scene context: ${S.bible.scenario}. ` : ''}Format: ${fmt.tr}. Topic: ${topic}. Plan a caption, hashtags and exactly ${n} shots.`, true, SYS.inf, sig);
        const plans = (j.shots || []).slice(0, Math.max(1, Number(n) || 3));
        const refs = await S.refsOf(group, sig), ids: string[] = [];
        setRes({ caption: j.caption, hashtags: j.hashtags || [], plans, ids: [] }); setFixes({});
        for (let i = 0; i < plans.length; i++) {
            chk(sig); prog(i / plans.length, `Kare ${i + 1}`);
            const a = await makeShot(plans[i], i, group, refs, sig);
            ids.push(a.id); setRes((r: any) => ({ ...r, ids: [...ids] }));
        }
        S.notify('İçerik hazır.');
    });

    const regen = (i: number) => S.run(`inf.s${i}`, 'influencer', `Kare ${i + 1} yeniden`, async (sig: any) => {
        const old = S.A(res.ids[i]), list = old ? S.castOf(old) : group;
        const a = await makeShot(res.plans[i], i, list, await S.refsOf(list, sig), sig);
        setRes((r: any) => ({ ...r, ids: r.ids.map((x: string, k: number) => k === i ? a.id : x) }));
    });

    const fixIt = (i: number, a: any) => S.repairAsset(a, fixes[a.id]).then((nw: any) => { if (nw) { setRes((r: any) => ({ ...r, ids: r.ids.map((x: string, k: number) => k === i ? nw.id : x) })); setFixes((f: any) => ({ ...f, [a.id]: '' })); } });

    return (
        <div className="flex flex-col gap-4">
            <Box title="Influencer · story / post / reel içeriği">
                <div className="flex flex-col gap-1 text-[11px] text-slate-400">Karakterler (birden fazla seçilebilir — birlikte aynı karede çıkar)
                    <div className="flex flex-wrap gap-2">{S.chars.map((x: any) => { const on = charIds.includes(x.id); return (
                        <button key={x.id} onClick={() => toggle(x.id)} className={`flex items-center gap-1.5 rounded-full border pl-1 pr-3 py-1 text-[12px] transition-colors ${on ? 'border-[#8B5CF6] bg-[#8B5CF6]/15 text-white' : 'border-slate-800 text-slate-500 hover:text-slate-300'}`}>
                            {x.img ? <img src={x.img} alt="" className="w-5 h-5 rounded-full object-cover" /> : <span className="w-5 h-5 rounded-full bg-slate-700" />}{x.ad}{on ? ' ✓' : ''}</button>); })}</div></div>
                <div className="grid md:grid-cols-4 gap-2"><Sel label="Format" list={FORMATS} value={format} onChange={setFormat} /><Sel label="Kare sayısı" list={['1', '2', '3', '4', '5'].map(x => ({ id: x, tr: x }))} value={n} onChange={setN} /></div>
                <Inp label="İçerik konusu" value={topic} onChange={setTopic} />
                <label className="flex items-center gap-2 text-[12px] text-slate-300"><input type="checkbox" checked={useScene} onChange={e => setUseScene(e.target.checked)} />Aktif sahnenin senaryosunu bağlam olarak kullan</label>
                <div className="flex flex-wrap gap-2"><ActBtn S={S} k="inf.ideas" label="AI konu fikirleri" run={ideasJob} tone="g" /><ActBtn S={S} k="inf.run" label="İçeriği üret" run={go} /></div>
                {ideas.length > 0 && <div className="flex flex-wrap gap-2">{ideas.map((x, i) => <button key={i} onClick={() => setTopic(x)} className="text-left text-[11px] rounded-lg border border-slate-800 px-2 py-1 text-slate-300 hover:border-[#8B5CF6]">{x}</button>)}</div>}
            </Box>
            {res && <Box title="Sonuç · görsele tıklayınca sıradaki kareye geçer">
                <div className="text-[12px] text-slate-300 rounded-lg border border-slate-800 p-3 flex gap-2 items-start"><span className="flex-1">{res.caption}<br /><span className="text-[#A78BFA]">{tags(res.hashtags)}</span></span>
                    <Btn tone="g" onClick={() => S.copy(`${res.caption}\n${tags(res.hashtags)}`)}>Kopyala</Btn></div>
                <Gallery S={S} items={res.ids.map((id: string, i: number) => ({ label: `Kare ${i + 1}`, a: S.A(id) }))}
                    extra={(a: any) => { const i = res.ids.indexOf(a.id); return <>
                        <Btn tone="g" disabled={S.busy(`inf.s${i}`)} onClick={() => regen(i)}>Yeniden üret</Btn>
                        <input value={fixes[a.id] || ''} onChange={e => setFixes((f: any) => ({ ...f, [a.id]: e.target.value }))} placeholder="Düzeltme notu (örn: yüzü kimlik sayfasına benzet)" className="min-w-[200px] flex-1 bg-[#16181E] border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-[#8B5CF6]" />
                        <Btn tone="g" disabled={!(fixes[a.id] || '').trim() || S.busy(`repair.${a.id}`)} onClick={() => fixIt(i, a)}>Düzelt</Btn></>; }} />
            </Box>}
        </div>
    );
};

const PROFILE_KEYS = ['niche', 'personality', 'city', 'contentPillars', 'visualIdentity'];

const CastManager = ({ S }: any) => {
    const upd = (id: string, patch: any) => S.setChars((cs: any[]) => cs.map(c => c.id === id ? { ...c, ...patch } : c));
    return (
        <div className="fixed inset-0 z-[65] bg-black/80 flex items-start justify-center p-4 overflow-y-auto" onClick={() => S.setCastOpen(false)}>
            <div className="w-full max-w-4xl bg-[#0D0F14] border border-slate-800 rounded-2xl p-4 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between"><h3 className="text-[14px] font-bold text-white">Kadro Yönetimi</h3>
                    <div className="flex gap-2"><Btn onClick={() => { const id = `c_${Date.now()}`; S.setChars((cs: any[]) => [...cs, { id, ad: 'Yeni Karakter', yas: 25, sex: 'female', genderLock: LOCK.female, dna: '', outfit: '', img: '', identitySheet: '' }]); S.setSel((s: string[]) => [...s, id]); }}>+ Karakter</Btn><Btn tone="g" onClick={() => S.setCastOpen(false)}>Kapat</Btn></div></div>
                {S.chars.map((c: any) => (
                    <div key={c.id} className="rounded-xl border border-slate-800 p-3 grid gap-2 md:grid-cols-2">
                        <div className="md:col-span-2 flex flex-wrap items-center gap-2 text-[12px]">
                            <input type="checkbox" checked={S.sel.includes(c.id)} onChange={() => S.setSel((s: string[]) => s.includes(c.id) ? s.filter(x => x !== c.id) : [...s, c.id])} />
                            <input value={c.ad} onChange={e => upd(c.id, { ad: e.target.value })} className="bg-[#16181E] border border-slate-800 rounded-lg px-2 py-1 font-semibold text-white" />
                            <input type="number" value={c.yas || ''} onChange={e => upd(c.id, { yas: Number(e.target.value) })} className="w-16 bg-[#16181E] border border-slate-800 rounded-lg px-2 py-1" />
                            <select value={c.sex} onChange={e => upd(c.id, { sex: e.target.value, genderLock: LOCK[e.target.value] })} className="bg-[#16181E] border border-slate-800 rounded-lg px-2 py-1"><option value="female">Kadın</option><option value="male">Erkek</option></select>
                            <span className="ml-auto"><Btn tone="r" disabled={S.chars.length < 2} onClick={() => { S.setChars((cs: any[]) => cs.filter(x => x.id !== c.id)); S.setSel((s: string[]) => s.filter(x => x !== c.id)); }}>Sil</Btn></span>
                        </div>
                        <Area label="Cinsiyet kilidi" value={c.genderLock || ''} onChange={(v: string) => upd(c.id, { genderLock: v })} rows={2} />
                        <Area label="Fiziksel DNA (İngilizce)" value={c.dna || ''} onChange={(v: string) => upd(c.id, { dna: v })} rows={2} />
                        <Area label="Varsayılan kıyafet" value={c.outfit || ''} onChange={(v: string) => upd(c.id, { outfit: v })} rows={2} />
                        <div className="grid gap-2"><Inp label="Profil fotoğrafı URL" value={c.img || ''} onChange={(v: string) => upd(c.id, { img: v })} /><Inp label="360° kimlik sayfası URL (öncelikli referans)" value={c.identitySheet || ''} onChange={(v: string) => upd(c.id, { identitySheet: v })} /></div>
                        <details className="md:col-span-2"><summary className="text-[11px] text-slate-400 cursor-pointer">Influencer profili</summary>
                            <div className="grid md:grid-cols-2 gap-2 mt-2">{PROFILE_KEYS.map(k => <Inp key={k} label={k} value={S.profiles[c.id]?.[k] || ''} onChange={(v: string) => S.setProfiles((p: any) => ({ ...p, [c.id]: { ...(p[c.id] || {}), [k]: v } }))} />)}</div></details>
                    </div>))}
                <Area label="Global trend defteri (planlayıcı, master prompt ve influencer kullanır)" value={S.trends} onChange={S.setTrends} rows={4} />
            </div>
        </div>
    );
};

const ProjectBar = ({ S }: any) => {
    const b = S.bible, master = S.A(b.masterAssetId), score = master?.verdict?.score;
    const chip = (ok: boolean, t: string) => <span key={t} className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${ok ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/5' : 'border-slate-800 text-slate-600'}`}>{ok ? '✓' : '○'} {t}</span>;
    return (
        <div className="border-b border-white/5 bg-[#0B0D12]">
            <div className="max-w-[1400px] mx-auto px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-[10px] uppercase tracking-widest text-slate-500">Kadro</span>
                {S.chars.map((c: any) => {
                    const on = S.sel.includes(c.id);
                    return <button key={c.id} title={String(c.dna || '').slice(0, 160)} onClick={() => S.setSel((s: string[]) => on ? s.filter(x => x !== c.id) : [...s, c.id])} className={`flex items-center gap-1.5 rounded-full border pl-1 pr-3 py-0.5 text-[11px] transition-colors ${on ? 'border-[#8B5CF6] bg-[#8B5CF6]/15 text-white' : 'border-slate-800 text-slate-500 hover:text-slate-300'}`}>
                        {c.img ? <img src={c.img} alt="" className="w-5 h-5 rounded-full object-cover" /> : <span className="w-5 h-5 rounded-full bg-slate-700" />}{c.ad}</button>;
                })}
                <Btn tone="g" onClick={() => S.setCastOpen(true)}>Kadro yönet</Btn>
                <span className="hidden md:block h-4 w-px bg-slate-800" />
                <span className="text-[10px] uppercase tracking-widest text-slate-500">Sahne</span>
                <select value={S.activeId} onChange={e => S.setActiveId(e.target.value)} className="bg-[#16181E] border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-200 max-w-[190px]">{S.scenes.map((s: any) => <option key={s.id} value={s.id}>{s.title}</option>)}</select>
                <Btn tone="g" onClick={() => S.newSceneWith({})}><span className="inline-flex items-center gap-1"><Icons.Plus />Yeni</span></Btn>
                <Btn tone="g" onClick={() => S.newSceneWith({ ...S.bible, id: undefined, title: `${S.bible.title} (kopya)` })}>Çoğalt</Btn>
                <Btn tone="r" disabled={S.scenes.length < 2} onClick={() => S.delScene(S.activeId)}>Sahneyi sil</Btn>
                <span className="ml-auto flex flex-wrap items-center gap-1">
                    {chip(!!b.wardrobeText, 'Kıyafet kilidi')}{chip(!!b.blocking, 'Blocking')}{chip(!!b.sceneMap, 'Sahne haritası')}{chip(!!b.continuityManifest, 'Manifest')}{chip(!!master, 'Master')}
                    {hasScore(master?.verdict) && <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${Number(score) >= 80 ? 'text-emerald-300' : 'text-amber-300'}`}>Süreklilik %{score}</span>}
                </span>
            </div>
        </div>
    );
};

const JobBar = ({ S }: any) => S.jobs.length ? (
    <div className="border-b border-white/5 bg-[#0D0F14]">
        <div className="max-w-[1400px] mx-auto px-4 py-1.5 flex flex-wrap items-center gap-2 text-[11px]">
            {S.jobs.map((j: any) => (
                <span key={j.id} className={`flex items-center gap-2 rounded-lg border px-2 py-1 ${j.status === 'error' ? 'border-rose-500/40 text-rose-300' : j.status === 'cancelled' ? 'border-slate-700 text-slate-500' : j.status === 'done' ? 'border-emerald-500/30 text-emerald-300' : 'border-[#8B5CF6]/40 text-slate-200'}`}>
                    <b>{j.label}</b><span className="text-slate-400">{j.status === 'queued' ? 'sırada' : j.status === 'running' ? `${Math.round((j.progress || 0) * 100)}%${j.text ? ' · ' + j.text : ''}` : j.status === 'error' ? j.text : j.status === 'done' ? 'bitti' : 'iptal'}</span>
                    {(j.status === 'queued' || j.status === 'running') && <button className="text-rose-300 hover:text-rose-200" onClick={() => S.cancel(j.id)}>✕</button>}
                </span>))}
            <Btn tone="r" onClick={S.stopAll}>Tümünü durdur</Btn>
        </div>
    </div>) : null;

const Dock = ({ S }: any) => {
    const [scope, setScope] = usePersist('dock.scope', 'scene'); const [type, setType] = usePersist('dock.type', 'all'); const [fav, setFav] = useState(false);
    const list = S.assets.filter((a: any) => (scope === 'all' || a.sceneId === S.activeId) && (type === 'all' || a.type === type) && (!fav || a.fav));
    const here = XFER.find(x => x[0] === S.tab)?.[1];
    return (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-[#0B0D11]/95 backdrop-blur border-t border-white/10">
            <div className="max-w-[1400px] mx-auto flex flex-wrap items-center gap-2 px-3 py-1.5">
                <b className="text-[12px] text-white">Film şeridi</b><span className="text-[11px] text-slate-500">{list.length} görsel</span>
                <div className="flex gap-1">{[['scene', 'Aktif sahne'], ['all', 'Tüm sahneler']].map(([id, t]) => <Btn key={id} tone={scope === id ? 'a' : 'g'} onClick={() => setScope(id)}>{t}</Btn>)}</div>
                <div className="flex flex-wrap gap-1">{TYPES.map(([id, t]) => <button key={id} onClick={() => setType(id)} className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${type === id ? 'bg-[#8B5CF6]/25 text-[#C4B5FD]' : 'text-slate-500 hover:text-white'}`}>{t}</button>)}</div>
                <Btn tone={fav ? 'a' : 'g'} onClick={() => setFav(!fav)}>★ Favoriler</Btn>
                <span className="ml-auto"><Btn tone="g" onClick={() => S.setDockOpen(!S.dockOpen)}>{S.dockOpen ? 'Küçült ▾' : 'Aç ▴'}</Btn></span>
            </div>
            {S.dockOpen && <div className="max-w-[1400px] mx-auto flex gap-2 overflow-x-auto sc px-3 pb-3">
                {!list.length && <p className="text-[11px] text-slate-600 py-6 px-2">Bu filtrede görsel yok.</p>}
                {list.map((a: any, i: number) => (
                    <div key={a.id} className="flex-none w-40 rounded-xl border border-slate-800 bg-[#0D0F14] p-1.5 flex flex-col gap-1">
                        <div className="relative h-24 bg-black rounded-lg overflow-hidden">
                            <img src={a.url} alt="" onClick={() => S.inspect(list, i)} className="w-full h-full object-contain cursor-zoom-in" />
                            {a.verdict && <div className="absolute top-1 left-1"><Badge v={a.verdict} /></div>}
                            <button title="Favori" onClick={() => S.patchAsset(a.id, { fav: !a.fav })} className={`absolute top-1 right-1 text-[14px] ${a.fav ? 'text-amber-300' : 'text-white/50 hover:text-white'}`}>★</button>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">{a.tag} · {a.name}</div>
                        <div className="flex items-center gap-1">
                            <Btn tone="a" disabled={!here} onClick={() => S.loadHere(a)}>⤓ Yükle</Btn>
                            <Xfer a={a} S={S} />
                            <button title="Google Drive için görsel indir" className="text-[10px] text-sky-300 hover:text-sky-100 px-1" onClick={() => { void downloadForDrive(a).then(() => S.notify('Görsel indirildi. Drive’a yüklemek için Ayarlar → Google Drive Gallery bölümünü açın.')).catch((e: any) => S.notify(e.message, 'error')); }}>Drive ↓</button><button title="Google Drive’a yükle" className="text-[10px] text-emerald-300 hover:text-emerald-100 px-1" onClick={() => { void uploadImageToDrive(a).then(() => S.notify('Görsel Drive’a kaydedildi.')).catch((e: any) => S.notify(e.message, 'error')); }}>Drive ↑</button>
                            <button title="Sil" className="ml-auto text-rose-300 hover:text-rose-200 px-1" onClick={() => S.delAsset(a.id)}><Icons.Trash /></button>
                        </div>
                    </div>))}
            </div>}
        </div>
    );
};

const SettingsModal = ({ S }: any) => {
    const [sure, setSure] = useState(false); const [txt, setTxt] = useState('');
    const [memoryText, setMemoryText] = useState(''); const [memoryConfirm, setMemoryConfirm] = useState(false);
    const [keyInput, setKeyInput] = useState(() => getSavedApiKey());
    const [driveClientId, setDriveClientId] = useState(() => { try { return localStorage.getItem('aifotofilm_drive_client_id') || ''; } catch { return ''; } });
    const [driveStatus, setDriveStatus] = useState(driveConnected());
    const [driveBusy, setDriveBusy] = useState(false);
    const saveKey = () => {
        try {
            localStorage.setItem('ai_fotofilm_gemini_api_key', keyInput.trim());
            S.notify('Gemini API Anahtarı güncellendi.');
        } catch {
            S.notify('Anahtar kaydedilemedi.', 'error');
        }
    };

    return (
        <div className="fixed inset-0 z-[65] bg-black/80 flex items-start justify-center p-4 overflow-y-auto fx-pop" onClick={() => S.setSettingsOpen(false)}>
            <div className="w-full max-w-lg bg-[#0D0F14] border border-slate-800 rounded-2xl p-5 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between"><h3 className="text-[14px] font-bold text-white">Ayarlar ve API Yönetimi</h3><Btn tone="g" onClick={() => S.setSettingsOpen(false)}>Kapat</Btn></div>
                
                <div className="rounded-xl border border-[#8B5CF6]/30 bg-[#8B5CF6]/5 p-3 flex flex-col gap-2">
                    <b className="text-[12px] text-[#C4B5FD] flex items-center gap-1.5"><Icons.Key /> Gemini API Anahtarı</b>
                    <p className="text-[11px] text-slate-400 leading-relaxed">Görsel ve metin üretimlerinin doğrudan Google Generative Language API üzerinden çalışabilmesi için anahtarınızı girin.</p>
                    <div className="flex gap-2">
                        <input type="password" value={keyInput} onChange={e => setKeyInput(e.target.value)} placeholder="AIzaSy..." className="flex-1 bg-[#16181E] border border-slate-800 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-200 outline-none focus:border-[#8B5CF6]" />
                        <Btn onClick={saveKey}>Kaydet</Btn>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="flex items-start gap-2 text-[12px] text-slate-300"><input type="checkbox" className="accent-[#8B5CF6] mt-0.5" checked={S.engine} onChange={e => S.setEngine(e.target.checked)} /><span><b className="text-white">Tutarlılık motoru</b><br /><span className="text-slate-500">Üretimden önce prompt, sonra görsel denetlenir. Kapatınca üretim daha hızlıdır.</span></span></label>
                    <label className="flex items-start gap-2 text-[12px] text-slate-300"><input type="checkbox" className="accent-[#8B5CF6] mt-0.5" checked={S.autoFix} onChange={e => S.setAutoFix(e.target.checked)} /><span><b className="text-white">Otomatik düzelt</b><br /><span className="text-slate-500">Denetim puanı düşükse kare, önerilen düzeltmeyle otomatik yeniden üretilir ve daha iyisi tutulur.</span></span></label>
                    <label className="flex items-start gap-2 text-[12px] text-slate-300"><input type="checkbox" className="accent-[#8B5CF6] mt-0.5" checked={S.showP} onChange={e => S.setShowP(e.target.checked)} /><span><b className="text-white">Promptları göster</b><br /><span className="text-slate-500">Görsel kartlarında kullanılan prompt görünür.</span></span></label>
                </div>
                <div className="rounded-xl border border-slate-800 p-3 flex flex-col gap-2">
                    <b className="text-[12px] text-white">Arayüzü varsayılana sıfırla</b>
                    <p className="text-[11px] text-slate-500">Sekme girdileri, bağlantı anahtarları, film şeridi filtreleri ve görünüm tercihleri varsayılana döner. Karakterler, sahneler ve görselleriniz korunur.</p>
                    <div><Btn tone="a" onClick={S.resetUI}><span className="inline-flex items-center gap-1"><Icons.RotateCcw />Arayüzü sıfırla</span></Btn></div>
                </div>
                <div className="rounded-xl border border-slate-800 p-3 flex flex-col gap-2">
                    <b className="text-[12px] text-white">Proje yedeği (dışa / içe aktar)</b>
                    <p className="text-[11px] text-slate-500">Karakterler, sahneler ve görselleri JSON olarak cihazınıza yedekleyin.</p>
                    <div className="flex flex-wrap gap-2"><Btn onClick={() => setTxt(S.exportProject())}>Dışa aktar</Btn>
                        {txt && <><Btn tone="g" onClick={() => S.copy(txt)}>JSON'u kopyala</Btn><Btn tone="g" onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = `aifotofilm_proje_${Date.now()}.json`; a.click(); }}>Dosya olarak indir</Btn></>}
                        <label className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-[#16181E] border border-slate-800 text-slate-300 cursor-pointer">Dosyadan içe aktar<input type="file" accept=".json,application/json" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (f) S.importProject(await f.text()); e.target.value = ''; }} /></label></div>
                    <Area label="JSON (içe aktarmak için buraya yapıştırın)" value={txt} onChange={setTxt} rows={3} />
                    <div><Btn tone="g" disabled={!txt.trim()} onClick={() => S.importProject(txt)}>Yapıştırılan JSON'u içe aktar</Btn></div>
                </div>
                <div className="rounded-xl border border-[#8B5CF6]/30 p-3 flex flex-col gap-2">
                    <b className="text-[12px] text-[#C4B5FD]">Production Memory · V20.3+</b>
                    <p className="text-[11px] text-slate-400">Karakter DNA ve kimlik kilitleri, kıyafetler, sahneler, süreklilik manifestoları, prompt kütüphanesi ve görsel indeksini taşınabilir JSON olarak saklar. API anahtarı ve görselin base64 verisi dahil değildir. Bu işlem Google Drive’a otomatik kayıt yapmaz.</p>
                    <div className="flex flex-wrap gap-2">
                        <Btn onClick={() => S.downloadMemory()}>Production Memory indir</Btn>
                        <label className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-[#16181E] border border-slate-800 text-slate-300 cursor-pointer">Memory dosyası seç<input type="file" accept=".json,application/json" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (f) { try { if (f.size > 15_000_000) throw new Error('Dosya 15 MB sınırını aşıyor.'); const t = await f.text(); parseProductionMemory(t); setMemoryText(t); setMemoryConfirm(false); S.notify('Memory doğrulandı; geri yükleme için onay verin.'); } catch (err: any) { S.notify(err.message, 'error'); } } e.target.value = ''; }} /></label>
                    </div>
                    {memoryText && <div className="flex flex-col gap-2 rounded-lg border border-amber-500/30 p-2">
                        <p className="text-[11px] text-amber-200">İçe aktarma mevcut karakter, sahne ve prompt kütüphanesini değiştirir. Mevcut görseller korunur; Memory içindeki görsel indeksi görsel dosyalarını geri yüklemez. Önce tam proje yedeği indirin.</p>
                        {!memoryConfirm ? <Btn tone="g" onClick={() => setMemoryConfirm(true)}>Geri yüklemeyi onayla…</Btn> : <div className="flex gap-2"><Btn onClick={() => { S.importMemory(memoryText); setMemoryText(''); setMemoryConfirm(false); }}>Evet, Memory'yi yükle</Btn><Btn tone="g" onClick={() => setMemoryConfirm(false)}>Vazgeç</Btn></div>}
                    </div>}
                </div>
                <div className="rounded-xl border border-sky-500/30 p-3 flex flex-col gap-2">
                    <b className="text-[12px] text-sky-300">Google Drive Gallery · V20.5.1</b>
                    <p className="text-[11px] text-slate-400">Google OAuth Web Client ID ile güvenli bağlantı kurun. Google Drive erişim belirteci yalnızca bellekte tutulur. Drive API kapsamı: drive.file (uygulamanın oluşturduğu/seçtiği dosyalar). Canvas iframe ortamında popup veya CORS engellenirse manuel indirme çalışmaya devam eder.</p>
                    <input value={driveClientId} onChange={e => setDriveClientId(e.target.value)} placeholder="Google OAuth Web Client ID (...apps.googleusercontent.com)" className="w-full bg-[#16181E] border border-slate-800 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-200" />
                    <div className="flex flex-wrap gap-2">
                        <Btn disabled={driveBusy} onClick={() => { try { localStorage.setItem('aifotofilm_drive_client_id', driveClientId.trim()); } catch {} setDriveBusy(true); void connectGoogleDrive(driveClientId).then(() => { setDriveStatus(true); S.notify('Google Drive bağlandı.'); }).catch((e: any) => S.notify(e.message, 'error')).finally(() => setDriveBusy(false)); }}>{driveBusy ? 'Bağlanıyor…' : driveStatus && driveConnected() ? 'Yeniden bağlan' : 'Google hesabına bağlan'}</Btn>
                        <Btn tone="g" onClick={() => { driveToken = null; driveFolderId = null; setDriveStatus(false); S.notify('Drive oturumu bu uygulamadan kapatıldı.'); }}>Bağlantıyı kes</Btn>
                        <Btn tone="g" onClick={openGoogleDrive}>Google Drive'ı aç ↗</Btn>
                    </div>
                    <p className="text-[10px] text-slate-500">Durum: {driveStatus && driveConnected() ? 'Bağlı' : 'Bağlı değil'} · Hedef klasör: AiFotofilm Pro. Google parolası, OAuth client secret veya access token buraya girilmez. Web Client ID gizli değildir. Yetkili JavaScript origin, Canvas'ın gerçek origin'i ile eşleşmelidir.</p>
                </div>
                <div className="rounded-xl border border-rose-500/30 p-3 flex flex-col gap-2">
                    <b className="text-[12px] text-rose-300">Projeyi tamamen sıfırla</b>
                    <p className="text-[11px] text-slate-500">Karakterler, sahneler, görseller, promptlar ve tüm ayarlar silinir.</p>
                    <div className="flex flex-wrap gap-2">{!sure
                        ? <Btn tone="r" onClick={() => setSure(true)}>Tüm projeyi sıfırla…</Btn>
                        : <><Btn tone="r" onClick={() => { S.resetAll(); setSure(false); }}>Evet, her şeyi sil</Btn><Btn tone="g" onClick={() => setSure(false)}>Vazgeç</Btn></>}
                        </div>
                </div>
            </div>
        </div>
    );
};

export default function App() {
    const [tab, setTab] = useState('studio');
    const [chars, setChars] = useState<any[]>(() => LS('ai_fotofilm_chars_v16', INITIAL_CHARACTERS));
    const [sel, setSel] = useState<string[]>(() => LS('ai_fotofilm_sel_v18', [INITIAL_CHARACTERS[0].id]));
    const [profiles, setProfiles] = useState<any>(() => ({ ...DEFAULT_INFLUENCER_PROFILES, ...LS('ai_fotofilm_profiles_v16', {}) }));
    const [trends, setTrends] = useState<string>(() => { try { return localStorage.getItem('ai_fotofilm_trends_v16') || ''; } catch (e) { return ''; } });
    const [scenes, setScenes] = usePersist('scenes', [newScene('Sahne 1')]);
    const [activeId0, setActiveId] = usePersist('active', null);
    const [assets, setAssets] = useState<any[]>(() => LS(PFX + 'assets', []));
    const [library, setLibrary] = usePersist('lib', []);
    const [link, setLink] = usePersist('link', {});
    const [engine, setEngine] = usePersist('engine', true); 
    const [showP, setShowP] = usePersist('showP', false); 
    const [autoFix, setAutoFix] = usePersist('autofix', true);
    const [jobs, setJobs] = useState<any[]>([]); 
    const [pkt, setPkt] = useState<any>({}); 
    const [note, setNote] = useState<any>(null);
    const [insp, setInsp] = useState<any>(null); 
    const [castOpen, setCastOpen] = useState(false); 
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [epoch, setEpoch] = useState(0); 
    const [dockOpen, setDockOpen] = usePersist('dock.open', true);
    const Q = useRef<any>({ running: 0, wait: [], ctl: {} }); 
    const cache = useRef<any>({}); 
    const jobsRef = useRef<any[]>([]); 
    jobsRef.current = jobs;

    const bible = scenes.find((s: any) => s.id === activeId0) || scenes[0];
    const aid = bible.id;
    const cast = chars.filter(c => sel.includes(c.id));

    useEffect(() => SAVE('ai_fotofilm_chars_v16', chars), [chars]);
    useEffect(() => SAVE('ai_fotofilm_sel_v18', sel), [sel]);
    useEffect(() => SAVE('ai_fotofilm_profiles_v16', profiles), [profiles]);
    useEffect(() => { try { localStorage.setItem('ai_fotofilm_trends_v16', trends); } catch (e) { /* yoksay */ } }, [trends]);
    useEffect(() => { const t = setTimeout(() => SAVE(PFX + 'assets', assets.slice(0, 15)), 1500); return () => clearTimeout(t); }, [assets]);

    const A = (id: any) => id ? assets.find(a => a.id === id) : undefined;
    const patchScene = (patch: any, id: string = aid) => setScenes((s: any[]) => s.map(x => x.id === id ? { ...x, ...patch } : x));
    const newSceneWith = (patch: any) => { const s = { ...newScene(`Sahne ${scenes.length + 1}`), ...patch, id: uid() }; setScenes((x: any[]) => [...x, s]); setActiveId(s.id); notify(`Yeni sahne: ${s.title}`); };
    const delScene = (id: string) => { setScenes((x: any[]) => x.filter(s => s.id !== id)); if (id === aid) setActiveId(scenes.find((s: any) => s.id !== id)?.id || null); };
    const patchAsset = (id: string, patch: any) => setAssets(x => x.map(a => a.id === id ? { ...a, ...patch } : a));
    const delAsset = (id: string) => {
        const gone = assets.find(a => a.id === id); if (!gone) return;
        setAssets(x => x.filter(a => a.id !== id));
        setScenes((sc: any[]) => sc.map(x => x.masterAssetId === id ? { ...x, masterAssetId: null } : x));
        notify('Görsel silindi.', 'ok', { label: 'Geri al', fn: () => { setAssets(x => x.some(a => a.id === gone.id) ? x : [gone, ...x]); setNote(null); } });
    };
    const addAsset = (a: any) => { setAssets(x => [a, ...x].slice(0, 120)); return a; };
    const notify = (message: string, type = 'ok', action?: any) => { setNote({ message, type, action }); setTimeout(() => setNote(null), action ? 7000 : 4500); };
    const copy = (t: string) => { try { navigator.clipboard.writeText(t); } catch (e) { /* yoksay */ } notify('Kopyalandı.'); };
    const pushLib = (title: string, prompt: string) => setLibrary((l: any[]) => [{ id: Date.now(), title, prompt, time: new Date().toLocaleTimeString('tr-TR') }, ...l].slice(0, 30));
    const castOf = (a: any) => { const l = a?.castIds?.length ? chars.filter(c => a.castIds.includes(c.id)) : []; return l.length ? l : cast; };
    const lockText = () => bible.wardrobeText || cast.map(c => `${c.ad.toUpperCase()} is EXACTLY wearing: ${c.outfit}.`).join(' ');
    const castInfo = (list: any[] = cast) => list.map(c => `[NAME: ${c.ad.toUpperCase()}, SEX: ${c.sex}, GENDER LOCK: ${c.genderLock}, DNA: ${c.dna}]`).join('\n');
    const castPayload = () => cast.map(c => ({ id: c.id, name: c.ad, sex: c.sex, genderLock: c.genderLock, dna: c.dna, defaultOutfit: c.outfit, profile: profiles[c.id] }));
    const makeAsset = (p: any) => ({ id: uid(), ts: new Date().toLocaleTimeString('tr-TR'), sceneId: aid, scenario: bible.scenario || '', castIds: sel, characters: cast.map(c => c.ad), wardrobe: lockText(), blocking: bible.blocking, sceneMap: bible.sceneMap, continuityManifest: bible.continuityManifest, storyState: bible.storyState, ...p });

    const isActive = (j: any) => j.status === 'running' || j.status === 'queued';
    const matchKey = (j: any, k: string) => k.endsWith('*') ? String(j.key).startsWith(k.slice(0, -1)) : j.key === k;
    const updJob = (id: string, p: any) => setJobs(j => j.map(x => x.id === id ? { ...x, ...p } : x));
    const dropLater = (id: string) => setTimeout(() => setJobs(j => j.filter(x => x.id !== id)), 3500);
    const pump = () => { while (Q.current.running < 2 && Q.current.wait.length) Q.current.wait.shift().start(); };

    const run = (key: string, jtab: string, label: string, fn: (sig: AbortSignal, prog: (n: number, t?: string) => void) => Promise<any>) => new Promise<any>(resolve => {
        const id = uid(), ctl = new AbortController(); Q.current.ctl[id] = ctl;
        setJobs(j => [...j, { id, key, tab: jtab, label, status: 'queued', progress: 0, text: '' }]);
        const start = async () => {
            Q.current.running++; updJob(id, { status: 'running' });
            try {
                chk(ctl.signal);
                const r = await fn(ctl.signal, (progress: number, text?: string) => updJob(id, { progress, ...(text ? { text } : {}) }));
                updJob(id, { status: 'done', progress: 1 }); resolve(r);
            } catch (e: any) {
                if (isAbort(e)) updJob(id, { status: 'cancelled' });
                else { updJob(id, { status: 'error', text: String(e?.message || e) }); notify(`${label}: ${e?.message || e}`, 'error'); }
                resolve(undefined);
            } finally { Q.current.running--; delete Q.current.ctl[id]; dropLater(id); pump(); }
        };
        Q.current.wait.push({ id, start, drop: () => { updJob(id, { status: 'cancelled' }); dropLater(id); resolve(undefined); } });
        pump();
    });

    const cancel = (id: string) => {
        const w = Q.current.wait.findIndex((x: any) => x.id === id);
        if (w >= 0) { const [e] = Q.current.wait.splice(w, 1); e.drop(); } else Q.current.ctl[id]?.abort();
    };

    const busy = (k: string) => jobs.some(j => isActive(j) && matchKey(j, k));
    const jobOf = (k: string) => jobs.find(j => isActive(j) && matchKey(j, k));
    const stopKey = (k: string) => jobsRef.current.filter(j => isActive(j) && matchKey(j, k)).forEach(j => cancel(j.id));
    const stopAll = () => { Q.current.wait.splice(0).forEach((e: any) => e.drop()); Object.values(Q.current.ctl).forEach((c: any) => c.abort()); };

    const refsOf = async (list: any[], sig: AbortSignal) => {
        const out: any[] = [];
        for (const c of list) {
            const u = (c.identitySheet || c.img || '').trim(); if (!u) continue;
            try {
                if (!cache.current[u]) cache.current[u] = await toB64(u, sig);
                out.push({ ...cache.current[u], label: `${String(c.ad).toUpperCase()} 360° CHARACTER IDENTITY SHEET`, genderLock: c.genderLock });
            } catch (e: any) { if (isAbort(e)) throw e; }
        }
        return out;
    };

    const bibleCtx = () => ({ title: bible.title, scenario: bible.scenario, location: bible.plan?.location, time: bible.plan?.time, weather: bible.plan?.weather, storyState: bible.storyState, blocking: bible.blocking, sceneMap: bible.sceneMap, continuityManifest: bible.continuityManifest, manifest: bible.manifest });
    const cfg = useRef<any>({}); cfg.current = { engine, autoFix };
    const auditPrompt = async (prompt: string, sig: any, outfits?: string) => normV(await auditPromptService(prompt, castInfo(), outfits || lockText(), bibleCtx(), sig), true);
    const auditImage = async (url: string, prompt: string, sig: any, refUrl: string | null = null, list: any[] = cast, lock = '') =>
        normV(await auditImageService(url, prompt, castInfo(list), lock || lockText(), sig, refUrl));

    const dropAsset = (id: string) => {
        setAssets(x => x.filter(a => a.id !== id));
        setScenes((sc: any[]) => sc.map(x => x.masterAssetId === id ? { ...x, masterAssetId: null } : x));
    };

    const batchAudit = async (list: any[], master: any, sig: any) => {
        const rep = new Map<string, any>();
        if (!list.length || !master) return rep;
        try {
            const imgs = [await toB64(master.url, sig)]; for (const a of list) imgs.push(await toB64(a.url, sig));
            const r = await callGeminiWithImages(`Image 1 is the MASTER/REFERENCE. Images 2..${list.length + 1} are shots S1..S${list.length}, in order.\nOUTFIT LOCK: ${master.wardrobe || lockText()}`, imgs, true, SYS.batch, sig);
            (r.shots || []).forEach((x: any) => {
                const a = list[Number(String(x.id).replace(/\D/g, '')) - 1];
                if (a) {
                    const v = normV({ score: x.score, status: x.status, issues_tr: x.issue_tr ? [x.issue_tr] : [], fix_prompt_en: x.fix_en });
                    patchAsset(a.id, { verdict: v }); a.verdict = v;
                }
            });
        } catch (e: any) {
            if (isAbort(e)) throw e;
            notify(`Süreklilik denetimi: ${e?.message || e}`, 'error'); return rep;
        }
        if (cfg.current.autoFix) {
            const bad = list.filter(a => a.verdict && a.verdict.status !== 'audit_error' && !verdictOk(a.verdict) && a.verdict.fix_prompt_en).slice(0, 3);
            for (const a of bad) {
                chk(sig);
                try {
                    const n = await repairCore(a, a.verdict.fix_prompt_en, sig);
                    const better = hasScore(n.verdict) && (!hasScore(a.verdict) || Number(n.verdict.score) >= Number(a.verdict.score));
                    if (better) { dropAsset(a.id); rep.set(a.id, n); } else dropAsset(n.id);
                } catch (e: any) { if (isAbort(e)) throw e; }
            }
            if (rep.size) notify(`${rep.size} kare süreklilik denetimine göre otomatik düzeltildi.`);
        }
        return rep;
    };

    const produce = async (o: any) => {
        const { sig, type, name, tag, ratio, seed, base = null, refs = [], parentId, scenario, audit = true, pre = false, auditRefId = null, extra = {}, castList = cast, noFix = false } = o;
        const lock = extra.wardrobe || lockText();
        let prompt = o.prompt, preV: any = null;
        if (cfg.current.engine && pre) {
            chk(sig);
            try { preV = await auditPrompt(prompt, sig); if (preV?.fixed_prompt && preV.status !== 'ready') prompt = preV.fixed_prompt; } catch (e: any) { if (isAbort(e)) throw e; }
        }
        const build = async (pr: string) => {
            chk(sig);
            const url = await generateImage(pr, ratio, seed, sig, base?.data || null, base?.mimeType || null, refs);
            const x = addAsset(makeAsset({ type, name, tag, url, prompt: pr, ratio, seed: seed ?? 'AUTO', parentId, preVerdict: preV, ...(scenario !== undefined ? { scenario } : {}), ...extra }));
            if (cfg.current.engine && audit) {
                try {
                    chk(sig);
                    const v = await auditImage(url, pr, sig, auditRefId ? A(auditRefId)?.url ?? null : null, castList, lock);
                    patchAsset(x.id, { verdict: v }); x.verdict = v;
                } catch (e: any) {
                    if (isAbort(e)) throw e;
                    const ev = { score: null, status: 'audit_error', issues_tr: [e?.message || 'Görsel denetimi başarısız.'], fix_prompt_en: '' };
                    patchAsset(x.id, { verdict: ev }); x.verdict = ev;
                }
            }
            return x;
        };
        let a = await build(prompt);
        const v = a.verdict;
        if (cfg.current.engine && audit && cfg.current.autoFix && !noFix && v && v.status !== 'audit_error' && v.fix_prompt_en && !verdictOk(v)) {
            try {
                chk(sig);
                const np = `[STRICT CONTINUITY LOCK] ${await callGemini(`USER CHANGE: ${v.fix_prompt_en}\nOUTFIT LOCK: ${lock}\nCURRENT PROMPT: ${prompt}`, false, SYS.refine, sig)}`;
                const b = await build(np);
                if (hasScore(b.verdict) && (!hasScore(v) || Number(b.verdict.score) >= Number(v.score))) { dropAsset(a.id); a = b; notify('Otomatik düzeltme uygulandı.'); }
                else dropAsset(b.id);
            } catch (e: any) { if (isAbort(e)) throw e; }
        }
        return a;
    };

    const auditAsset = (a: any) => run(`audit.${a.id}`, tab, 'Görsel denetimi', async (sig: any) => {
        const v = await auditImage(a.url, a.prompt || '', sig, A(a.parentId)?.url ?? null, castOf(a), a.wardrobe || ''); 
        patchAsset(a.id, { verdict: v });
    });

    const repairCore = async (a: any, fx: string, sig: any) => {
        need(fx, 'Düzeltme talebi yok.');
        const np = `[STRICT CONTINUITY LOCK] ${await callGemini(`USER CHANGE: ${fx}\nOUTFIT LOCK: ${a.wardrobe || lockText()}\nCURRENT PROMPT: ${a.prompt}`, false, SYS.refine, sig)}`;
        const base = await toB64(a.url, sig), refs = await refsOf(castOf(a), sig), ratio = a.ratio && a.ratio !== 'any' ? a.ratio : await detectClosestAspectRatio(a.url);
        return produce({ sig, type: a.type === 'upload' ? 'studio' : a.type, name: `${a.name} · Düzeltme`, tag: 'REFINE', prompt: np, ratio, seed: typeof a.seed === 'number' ? a.seed : undefined, base, refs, parentId: a.id, scenario: a.scenario, castList: castOf(a), noFix: true, extra: { shotId: a.shotId, wardrobe: a.wardrobe, ...(a.castIds ? { castIds: a.castIds, characters: a.characters } : {}) } });
    };

    const repairAsset = (a: any, fixText?: string) => run(`repair.${a.id}`, tab, 'Kilitli düzeltme', async (sig: any) => {
        const n = await repairCore(a, fixText || a.verdict?.fix_prompt_en, sig);
        notify('Düzeltme uygulandı.'); 
        return n;
    });

    const transfer = (a: any, target: string) => {
        if (!a?.url) return notify('Aktarılacak görsel yok.', 'error');
        if (a.sceneId && a.sceneId !== aid && scenes.some((s: any) => s.id === a.sceneId) && (target === 'studio' || link[target] !== false)) setActiveId(a.sceneId);
        const ids = (a.castIds || []).filter((id: string) => chars.some(c => c.id === id)); if (ids.length) setSel(ids);
        setPkt((p: any) => ({ ...p, [target]: { asset: a, scene: scenes.find((x:any)=>x.id===a.sceneId) || bible, package: { scenario:a.scenario, prompt:a.prompt, seed:a.seed, ratio:a.ratio, castIds:a.castIds, wardrobe:a.wardrobe, blocking:a.blocking, sceneMap:a.sceneMap, continuityManifest:a.continuityManifest, storyState:a.storyState, parentId:a.parentId }, n: Date.now() } }));
        setTab(target); notify(`Senaryosu ve referansıyla aktarıldı → ${XFER.find(x => x[0] === target)?.[1]}`);
    };

    const loadHere = (a: any) => {
        if (XFER.some(x => x[0] === tab)) return transfer(a, tab);
        notify('Bu sekme görsel yüklemeyi desteklemiyor; “Aktar…” menüsünü kullanın.', 'error');
    };

    const uploadFile = (file: File) => new Promise<any>(res => {
        const r = new FileReader();
        r.onload = async () => {
            const url = String(r.result); let ratio = '16:9'; try { ratio = await detectClosestAspectRatio(url); } catch (e) { /* yoksay */ }
            res(addAsset(makeAsset({ type: 'upload', name: file.name || 'Yüklenen görsel', tag: 'UPLOAD', url, prompt: '', ratio, seed: 'AUTO', scenario: '' })));
        };
        r.onerror = () => { notify('Dosya okunamadı.', 'error'); res(null); };
        r.readAsDataURL(file);
    });

    const exportProject = () => JSON.stringify({ v: '20.5', chars, sel, profiles, trends, scenes, activeId: aid, assets, library });
    const exportMemoryText = () => JSON.stringify(createProductionMemory({ chars, sel, profiles, trends, scenes, aid, library, assets }), null, 2);
    const downloadMemory = () => {
        try {
            const data = createProductionMemory({ chars, sel, profiles, trends, scenes, aid, library, assets });
            downloadJson(JSON.stringify(data, null, 2), `aifotofilm_production_memory_${new Date().toISOString().slice(0, 10)}.json`);
            notify('Production Memory dosyası indirildi.');
        } catch (e: any) { notify(`Memory dışa aktarma hatası: ${e.message}`, 'error'); }
    };
    const importMemory = (text: string) => {
        try {
            const p = parseProductionMemory(text);
            setChars(p.characters); setSel(p.selectedCharacterIds); setProfiles(p.influencerProfiles);
            setTrends(p.trends); setScenes(p.scenes); setActiveId(p.activeSceneId);
            setLibrary(p.promptLibrary);
            notify('Production Memory geri yüklendi. Görsel dosyaları değiştirilmedi.');
        } catch (e: any) { notify(`Memory içe aktarma hatası: ${e.message}`, 'error'); }
    };
    const importProject = (txt: string) => {
        try {
            const d = JSON.parse(txt);
            if (!d || !Array.isArray(d.chars) || !d.chars.length || !Array.isArray(d.scenes) || !d.scenes.length || !d.scenes.every((x: any) => x && typeof x.id === 'string')) throw new Error('Geçerli AiFotofilm proje yedeği değil.');
            if (d.chars) setChars(d.chars); if (d.sel) setSel(d.sel); if (d.profiles) setProfiles(d.profiles); if (typeof d.trends === 'string') setTrends(d.trends);
            if (d.scenes?.length) { setScenes(d.scenes); setActiveId(d.activeId || d.scenes[0].id); } if (d.assets) setAssets(d.assets); if (d.library) setLibrary(d.library);
            notify('Proje içe aktarıldı.');
        } catch (e: any) { notify(`İçe aktarma hatası: ${e.message}`, 'error'); }
    };

    const lineage = (a: any) => { const out = [a]; let c = a, n = 0; while (c?.parentId && n++ < 8) { const p = A(c.parentId); if (!p || out.includes(p)) break; out.unshift(p); c = p; } return out; };
    const prodCtx = () => {
        const bl = bible.blocking || {}, sm = bible.sceneMap || {}, m = bible.continuityManifest || {};
        const chars = (bl.characters || []).map((x: any) => `${String(x.id || '').toUpperCase()}: ${[x.frame_position, x.depth, x.body_orientation, x.eyeline && `eyeline ${x.eyeline}`, x.action].filter(Boolean).join(', ')}`).filter(Boolean);
        const props = (sm.props || []).map((x: any) => `${x.name}${x.position ? ` at ${x.position}` : ''}${x.owner ? ` (${x.owner})` : ''}`).filter(Boolean).join(', ');
        const anchors = (sm.environment_anchors || []).map((x: any) => `${x.name}${x.position ? ` at ${x.position}` : ''}`).filter(Boolean).join(', ');
        const blk = [...chars, bl.action_axis && `action axis ${bl.action_axis}`, bl.camera_side && `camera side ${bl.camera_side}`, bl.screen_direction && `screen direction ${bl.screen_direction}`].filter(Boolean).join('; ');
        return [blk && `Blocking: ${blk}`, props && `Props: ${props}`, anchors && `Environment anchors: ${anchors}`, sm.light_direction && `Light direction: ${sm.light_direction}`, m.time && `Time: ${m.time}`, m.weather && `Weather: ${m.weather}`, m.lighting && `Lighting: ${m.lighting}`].filter(Boolean).join('. ');
    };

    const wipeKeys = (all: boolean) => {
        try {
            const ks: string[] = [], keep = ['scenes', 'active', 'assets', 'lib'].map(n => PFX + n);
            for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && (all ? (k.startsWith(PFX) || k.startsWith('ai_fotofilm_')) : (k.startsWith(PFX) && !keep.includes(k)))) ks.push(k); }
            ks.forEach(k => localStorage.removeItem(k));
        } catch (e) { /* yoksay */ }
    };

    const resetUI = () => {
        wipeKeys(false);
        setLink({}); setEngine(true); setAutoFix(true); setShowP(false); setDockOpen(true); setInsp(null); setCastOpen(false); setSettingsOpen(false); setPkt({});
        setTab('studio'); setEpoch(e => e + 1); notify('Arayüz varsayılana sıfırlandı; projeniz korundu.');
    };

    const resetAll = () => {
        wipeKeys(true);
        const sc = newScene('Sahne 1');
        setChars(INITIAL_CHARACTERS); setSel([INITIAL_CHARACTERS[0].id]); setProfiles({ ...DEFAULT_INFLUENCER_PROFILES }); setTrends('');
        setScenes([sc]); setActiveId(sc.id); setAssets([]); setLibrary([]); resetUI(); notify('Proje tamamen sıfırlandı.');
    };

    const S: any = {
        tab, setTab, chars, setChars, sel, setSel, cast, profiles, setProfiles, trends, setTrends, scenes, bible, activeId: aid, setActiveId, patchScene, newSceneWith, delScene,
        assets, A, patchAsset, delAsset, library, pushLib, link, setLink, engine, setEngine, autoFix, setAutoFix, showP, setShowP, dockOpen, setDockOpen, setSettingsOpen, lineage, prodCtx, resetUI, resetAll, jobs, pkt, clearPkt: (t: string) => setPkt((p: any) => { const n = { ...p }; delete n[t]; return n; }),
        run, cancel, busy, jobOf, stopKey, stopAll, notify, copy, castOf, lockText, castInfo, castPayload, refsOf, auditPrompt, batchAudit, produce, auditAsset, repairAsset,
        transfer, loadHere, uploadFile, inspect: (items: any[], start = 0) => setInsp({ items, start }), setCastOpen, exportProject, importProject, downloadMemory, importMemory, exportMemoryText
    };

    const VIEW: any = { studio: StudioTab, reji: RejiTab, lab: LabTab, next: NextTab, story: StoryTab, video: VideoTab, influencer: InfluencerTab };

    return (
        <div className="min-h-screen bg-[#090A0D] text-slate-200 font-sans flex flex-col selection:bg-[#8B5CF6]/30">
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes fxFade { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
                .fx-fade { animation: fxFade .24s ease-out both; } .fx-pop { animation: fxFade .16s ease-out both; }
                .sc::-webkit-scrollbar { height: 6px; width: 6px; } .sc::-webkit-scrollbar-thumb { background: #334155; border-radius: 8px; }
            ` }} />
            <div className="sticky top-0 z-50 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
                <header className="bg-[#0D0F14]/95 backdrop-blur border-b border-white/5">
                    <div className="max-w-[1400px] mx-auto px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                        <div className="font-extrabold text-white text-[15px] flex items-center gap-2"><span className="text-[#A78BFA]"><Icons.Clapperboard /></span>AiFotofilm<span className="text-[10px] font-bold text-[#8B5CF6] border border-slate-800 bg-[#16181E] px-1.5 py-0.5 rounded">V20.5 · DRIVE GALLERY</span></div>
                        <nav className="flex flex-wrap gap-1">{TABS.map(([id, t]) => {
                            const busyTab = jobs.some(j => isActive(j) && j.tab === id);
                            return <button key={id} onClick={() => setTab(id)} className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${tab === id ? 'bg-[#8B5CF6]/20 text-[#A78BFA] border border-[#8B5CF6]/30' : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>{t}{busyTab ? ' ●' : ''}</button>;
                        })}</nav>
                        <div className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
                            <label className="flex items-center gap-1.5 cursor-pointer" title="Her üretimde prompt ön denetimi ve görsel denetimi"><input type="checkbox" className="accent-[#8B5CF6]" checked={engine} onChange={e => setEngine(e.target.checked)} />Tutarlılık motoru</label>
                            <label className="flex items-center gap-1.5 cursor-pointer" title="Süreklilik puanı düşükse kareyi otomatik yeniden üretir"><input type="checkbox" className="accent-[#8B5CF6]" checked={autoFix} onChange={e => setAutoFix(e.target.checked)} />Otomatik düzelt</label>
                            <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" className="accent-[#8B5CF6]" checked={showP} onChange={e => setShowP(e.target.checked)} />Promptlar</label>
                            <Btn tone="g" onClick={() => setSettingsOpen(true)}>⚙ Ayarlar</Btn>
                        </div>
                    </div>
                </header>
                <ProjectBar S={S} />
                <JobBar S={S} />
            </div>
            <main className={`flex-1 w-full max-w-[1400px] mx-auto p-4 ${dockOpen ? 'pb-64' : 'pb-24'}`}>
                {TABS.map(([id]) => { const V = VIEW[id]; return <div key={`${id}-${epoch}`} className={tab === id ? 'fx-fade' : 'hidden'}><V S={S} /></div>; })}
            </main>
            <Dock key={epoch} S={S} />
            {insp && <Inspector items={insp.items} start={insp.start} onClose={() => setInsp(null)} S={S} />}
            {castOpen && <CastManager S={S} />}
            {settingsOpen && <SettingsModal S={S} />}
            {note && (
                <div className={`fixed ${dockOpen ? 'bottom-64' : 'bottom-20'} left-1/2 -translate-x-1/2 z-[80] px-4 py-2 rounded-xl text-[12px] font-semibold shadow-2xl fx-pop flex items-center gap-3 ${note.type === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
                    <span>{note.message}</span>{note.action && <button className="underline font-bold" onClick={note.action.fn}>{note.action.label}</button>}
                </div>
            )}
        </div>
    );
}