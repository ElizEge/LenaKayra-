/** AiFotofilm V20.2 modular extraction; canonical source lines 1238-1314. */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { callGeminiWithImages, detectClosestAspectRatio } from '../engine/gemini-api';
import { STORY_CAMERA_SHOTS } from '../config/production-presets';
import { SYS } from '../engine/continuity';
import { usePersist, toB64, chk, need, LOCK, Btn, ActBtn, Sel, Area, Box, LinkToggle, AssetActions, Pane, RefSlot, useScenario } from '../core/shared';

export const NextTab = ({ S }: any) => {
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

