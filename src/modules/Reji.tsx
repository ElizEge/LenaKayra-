/** AiFotofilm V20.2 modular extraction; canonical source lines 1077-1149. */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { normalizeSeed, callGemini } from '../engine/gemini-api';
import { STYLE_PRESETS, CAMERA_SETUPS, REJI_CAMERA_SHOTS } from '../config/production-presets';
import { SYS } from '../engine/continuity';
import { usePersist, toB64, opt, has, chk, need, LOCK, RATIOS, Btn, ActBtn, Sel, Inp, Area, Box, LinkToggle, Gallery, RefSlot, useScenario } from '../core/shared';

export const RejiTab = ({ S }: any) => {
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

