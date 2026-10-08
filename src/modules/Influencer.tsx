/** AiFotofilm V20.2 modular extraction; canonical source lines 1464-1536. */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { callGemini } from '../engine/gemini-api';
import { SYS } from '../engine/continuity';
import { usePersist, chk, need, LOCK, Btn, ActBtn, Sel, Inp, Box, Gallery } from '../core/shared';

export const InfluencerTab = ({ S }: any) => {
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

export const PROFILE_KEYS = ['niche', 'personality', 'city', 'contentPillars', 'visualIdentity'];

