/** AiFotofilm V20.2 modular extraction; canonical source lines 949-1076. */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { normalizeSeed, callGemini } from '../engine/gemini-api';
import { ASPECT_RATIOS, STYLE_PRESETS, CAMERA_SETUPS, CAMERA_ANGLES, SEASONS, WEATHERS, LIGHT_TIMES, LIGHT_STYLES, DIVERSE_THEME_PROMPTS } from '../config/production-presets';
import { J, SYS } from '../engine/continuity';
import { usePersist, opt, has, rnd, chk, need, isAbort, LOCK, RATIOS, OPTS, wardrobeFromState, Btn, ActBtn, Sel, Inp, Area, Box, Verdict, AssetCard } from '../core/shared';

export const StudioTab = ({ S }: any) => {
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

