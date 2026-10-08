/** AiFotofilm V20.2 modular extraction; canonical source lines 1698-2016. */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import './platform/canvas-compat';
import { callGemini, callGeminiWithImages, detectClosestAspectRatio, generateImage } from 'engine/gemini-api';
import { INITIAL_CHARACTERS, DEFAULT_INFLUENCER_PROFILES } from 'config/production-presets';
import { SYS, normV, auditPromptService, auditImageService } from 'engine/continuity';
import { Icons } from 'components/Icons';
import { PFX, LS, SAVE, usePersist, uid, toB64, chk, need, isAbort, LOCK, TABS, XFER, newScene, Btn, verdictOk, hasScore, Inspector } from 'core/shared';
import { StudioTab } from 'modules/Studio';
import { RejiTab } from 'modules/Reji';
import { LabTab } from 'modules/ImageLab';
import { NextTab } from 'modules/NextFrame';
import { StoryTab } from 'modules/Storyboard';
import { VideoTab } from 'modules/VideoPrep';
import { InfluencerTab } from 'modules/Influencer';
import { CastManager, ProjectBar, JobBar, Dock, SettingsModal } from 'components/ProjectControls';

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

    const exportProject = () => JSON.stringify({ v: '20.0', chars, sel, profiles, trends, scenes, activeId: aid, assets, library });
    const importProject = (txt: string) => {
        try {
            const d = JSON.parse(txt);
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
        transfer, loadHere, uploadFile, inspect: (items: any[], start = 0) => setInsp({ items, start }), setCastOpen, exportProject, importProject
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
                        <div className="font-extrabold text-white text-[15px] flex items-center gap-2"><span className="text-[#A78BFA]"><Icons.Clapperboard /></span>AiFotofilm<span className="text-[10px] font-bold text-[#8B5CF6] border border-slate-800 bg-[#16181E] px-1.5 py-0.5 rounded">V20 · PRODUCTION BIBLE</span></div>
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
