/** AiFotofilm V20.2 modular extraction; canonical source lines 1150-1237. */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { normalizeSeed, callGemini, callGeminiWithImages, detectClosestAspectRatio } from '../engine/gemini-api';
import { LIGHT_TIMES, LIGHT_STYLES, MAGIC_LIGHTS } from '../config/production-presets';
import { SYS, normV } from '../engine/continuity';
import { usePersist, split64, toB64, opt, has, need, isAbort, LOCK, RATIOS, Btn, ActBtn, Sel, Inp, Area, Box, AssetActions, Flip, RefSlot } from '../core/shared';

export const LabTab = ({ S }: any) => {
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

export const pad = (n: number) => String(n).padStart(2, '0');

