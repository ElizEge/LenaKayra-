/** AiFotofilm V20.2 modular extraction; canonical source lines 1315-1403. */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { callGemini } from '../engine/gemini-api';
import { SYS } from '../engine/continuity';
import { usePersist, toB64, chk, need, LOCK, RATIOS, Btn, ActBtn, Sel, Area, Box, LinkToggle, AssetCard, RefSlot, useScenario } from '../core/shared';
import { pad } from 'ImageLab';

export const StoryTab = ({ S }: any) => {
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
            const refs = await S.refsOf(S.cast, sig), made: any[] = [];
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

