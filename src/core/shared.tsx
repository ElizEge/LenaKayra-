/** AiFotofilm V20.2 modular extraction; canonical source lines 696-948. */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { fetchImageAsBase64 } from '../engine/gemini-api';
import { ASPECT_RATIOS, STYLE_PRESETS, CAMERA_SETUPS, CAMERA_ANGLES, SEASONS, WEATHERS, LIGHT_TIMES, LIGHT_STYLES } from '../config/production-presets';
import { Icons } from '../components/Icons';

export const PFX = 'ai_fotofilm_v20_';
export const LS = (k: string, d: any) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
export const SAVE = (k: string, v: any) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* kotada yoksay */ } };
export const usePersist = (key: string, init: any): [any, (x: any) => void] => {
    const [v, setV] = useState<any>(() => LS(PFX + key, init));
    useEffect(() => SAVE(PFX + key, v), [v]);
    return [v, setV];
};
export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const split64 = (u: string) => { const m = /^data:([^;]+);base64,(.+)$/.exec(u || ''); return m ? { mimeType: m[1], data: m[2] } : null; };
export const toB64 = async (u: string, sig: AbortSignal | null = null) => split64(u) || fetchImageAsBase64(u, sig);
export const opt = (list: any[], id: string) => list.find(x => x.id === id)?.en || '';
export const has = (list: any[], id: string) => list.some(x => x.id === id);
export const rnd = () => Math.floor(Math.random() * 2147483647);
export const dl = (url: string, name: string) => { const a = document.createElement('a'); a.href = url; a.download = `${name}_${Date.now()}.png`; a.click(); };
export const cssRatio = (r: string) => /^\d+:\d+$/.test(r || '') ? r.replace(':', ' / ') : '16 / 9';
export const chk = (sig: any) => { if (sig?.aborted) throw Object.assign(new Error('İptal edildi'), { name: 'AbortError' }); };
export const need = (v: any, m: string) => { if (!v || (Array.isArray(v) && !v.length) || (typeof v === 'string' && !v.trim())) throw new Error(m); };
export const isAbort = (e: any) => e?.name === 'AbortError';
export const LOCK: any = { female: 'ADULT WOMAN / FEMALE — never male, man or boy', male: 'ADULT MAN / MALE' };
export const RATIOS = ASPECT_RATIOS.filter((x: any) => x.id !== 'any');
export const OPTS: any[] = [['style', 'Stil', STYLE_PRESETS], ['setup', 'Lens', CAMERA_SETUPS], ['angle', 'Kamera açısı', CAMERA_ANGLES], ['ratio', 'Oran', ASPECT_RATIOS], ['time', 'Işık zamanı', LIGHT_TIMES], ['lightStyle', 'Işık stili', LIGHT_STYLES], ['weather', 'Hava', WEATHERS], ['season', 'Mevsim', SEASONS]];
export const TABS: any[] = [['studio', 'Studio'], ['reji', 'Reji Multi-Cam'], ['lab', 'Image Lab'], ['next', 'Next Frame'], ['story', 'Storyboard'], ['video', 'Video Prep'], ['influencer', 'Influencer']];
export const TYPES: any[] = [['all', 'Hepsi'], ['studio', 'Studio'], ['reji', 'Reji'], ['lab', 'Lab'], ['next', 'Next'], ['storyboard', 'Story'], ['influencer', 'Influencer'], ['upload', 'Yüklenen']];
export const XFER: any[] = [['studio', 'Studio'], ['reji', 'Reji referansı'], ['lab', 'Image Lab'], ['next', 'Next Frame'], ['story', 'Storyboard referansı'], ['video', 'Video Prep']];
export const VIDEO_MODES: any[] = [
    { id: 'se', tr: 'Başlangıç + Bitiş karesi', fields: ['Başlangıç karesi (First frame)', 'Bitiş karesi (Last frame)'] },
    { id: 'i2v', tr: 'Tek kare → video (Image-to-video)', fields: ['Başlangıç karesi (First frame)'] },
    { id: 'ref', tr: 'Karakter / mekan referanslı', fields: ['Referans 1 (karakter)', 'Referans 2 (sahne/mekan)', 'Referans 3 (opsiyonel)'] }
];
export const NEG_VIDEO = 'morphing face, identity drift, extra limbs, warped hands, flicker, outfit change, text, watermark, jump cut, camera shake artifacts';
export const newScene = (title = 'Sahne 1') => ({ id: uid(), title, scenario: '', plan: null, prompt: '', seed: '', ratio: 'any', recRatio: '16:9', style: 'any', setup: 'any', angle: 'any', time: 'any', lightStyle: 'any', weather: 'any', season: 'any', useOutfit: false, wardrobeText: '', storyState: {}, manifest: '', continuityManifest: null, blocking: null, sceneMap: null, masterAssetId: null, pre: null });
export const wardrobeFromState = (ws: any, chars: any[]) => Object.entries(ws || {}).map(([id, w]: any) => {
    const c = chars.find(x => x.id === id);
    return `${String(c?.ad || id).toUpperCase()} is EXACTLY wearing: ${[w?.outfit_en, w?.hair_makeup_en, w?.props_en].filter(Boolean).join('; ')}.`;
}).join(' ');

export const Btn = ({ children, onClick, disabled, tone = 'v' }: any) => (
    <button onClick={onClick} disabled={disabled} className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-40 transition-colors whitespace-nowrap ${tone === 'v' ? 'bg-[#8B5CF6] hover:bg-violet-500 text-white' : tone === 'r' ? 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25' : tone === 'a' ? 'bg-[#8B5CF6]/20 text-[#A78BFA]' : 'bg-[#16181E] border border-slate-800 text-slate-300 hover:text-white'}`}>{children}</button>
);
export const ActBtn = ({ S, k, label, run, disabled, tone = 'v' }: any) => S.busy(k)
    ? <Btn tone="r" onClick={() => S.stopKey(k)}>Durdur ✕</Btn>
    : <Btn tone={tone} disabled={disabled} onClick={run}>{label}</Btn>;
export const Sel = ({ label, value, onChange, list }: any) => (
    <label className="flex flex-col gap-1 text-[11px] text-slate-400">{label}
        <select value={value} onChange={e => onChange(e.target.value)} className="bg-[#16181E] border border-slate-800 rounded-lg px-2 py-1.5 text-[12px] text-slate-200 outline-none focus:border-[#8B5CF6]">
            {list.map((x: any) => <option key={x.id} value={x.id}>{x.tr || x.label || x.name}</option>)}
        </select>
    </label>
);
export const Inp = ({ label, value, onChange, ph = '' }: any) => (
    <label className="flex flex-col gap-1 text-[11px] text-slate-400">{label}
        <input value={value} placeholder={ph} onChange={e => onChange(e.target.value)} className="bg-[#16181E] border border-slate-800 rounded-lg px-2 py-1.5 text-[12px] text-slate-200 outline-none focus:border-[#8B5CF6]" />
    </label>
);
export const Area = ({ label, value, onChange, rows = 3, ph = '' }: any) => (
    <label className="flex flex-col gap-1 text-[11px] text-slate-400">{label}
        <textarea rows={rows} value={value} placeholder={ph} onChange={e => onChange(e.target.value)} className="bg-[#16181E] border border-slate-800 rounded-lg p-2 text-[12px] text-slate-200 outline-none focus:border-[#8B5CF6] resize-y" />
    </label>
);
export const Box = ({ title, children, right }: any) => (
    <section className="rounded-2xl border border-slate-800 bg-[#0D0F14] p-4 flex flex-col gap-3">
        {title && <div className="flex items-center justify-between gap-2 flex-wrap"><h3 className="text-[13px] font-bold text-white">{title}</h3>{right}</div>}{children}
    </section>
);

export const verdictOk = (v: any) => !!v && (v.status === 'consistent' || v.status === 'ready' || Number(v.score) >= 80);
export const hasScore = (v: any) => !!v && v.score !== null && v.score !== undefined && v.score !== '' && Number.isFinite(Number(v.score));
export const Badge = ({ v }: any) => {
    if (!v) return null;
    const sc = Number(v.score);
    const cls = v.status === 'audit_error' ? 'bg-slate-600 text-white' : verdictOk(v) ? 'bg-emerald-500 text-black' : hasScore(v) && sc >= 60 ? 'bg-amber-400 text-black' : 'bg-rose-500 text-white';
    return <span title={(v.issues_tr || []).join(' · ')} className={`px-2 py-0.5 rounded-md text-[10px] font-bold shadow ${cls}`}>{hasScore(v) ? sc : verdictOk(v) ? '✓' : '!'}</span>;
};
export const Verdict = ({ v, title = 'Tutarlılık' }: any) => v ? (
    <div className={`text-[12px] rounded-lg border px-3 py-2 ${v.status === 'audit_error' ? 'border-slate-700 text-slate-400 bg-slate-800/30' : verdictOk(v) ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/5' : 'border-amber-500/30 text-amber-300 bg-amber-500/5'}`}>
        <b>{title}: {v.status}</b>{hasScore(v) ? ` · ${v.score}` : ''} — {(v.issues_tr || []).join(' · ') || 'Sorun bulunmadı.'}
    </div>) : null;
export const LinkToggle = ({ S, tab }: any) => (
    <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none" title="Bağlıyken senaryo tüm bağlı sekmelerle ortaktır">
        <input type="checkbox" className="accent-[#8B5CF6]" checked={S.link[tab] !== false} onChange={e => S.setLink({ ...S.link, [tab]: e.target.checked })} />
        <span>{S.link[tab] !== false ? '🔗 Sahne Kitabına bağlı' : '⛓ Bağımsız'}</span>
    </label>
);
export const Xfer = ({ a, S }: any) => (
    <select value="" onChange={e => { if (e.target.value) S.transfer(a, e.target.value); }} className="bg-[#16181E] border border-slate-800 rounded-lg px-1.5 py-1 text-[11px] text-slate-300">
        <option value="">Aktar…</option>{XFER.map(([id, t]) => <option key={id} value={id}>{t}</option>)}
    </select>
);
export const PromptView = ({ text, S }: any) => (S.showP && text) ? (
    <div className="rounded-lg bg-black/40 border border-slate-800 p-2 text-[10.5px] leading-relaxed text-slate-400 max-h-32 overflow-y-auto sc">
        {String(text)}<div className="mt-1"><button className="underline text-slate-500 hover:text-white" onClick={() => S.copy(String(text))}>kopyala</button></div>
    </div>) : null;

export const AssetActions = ({ a, S, extra, plain }: any) => {
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
                <Btn tone="r" onClick={() => S.delAsset(a.id)}><span className="inline-flex items-center gap-1"><Icons.Trash />Sil</span></Btn>
            </div>
        </div>
    );
};

export const Flip = ({ items, index, onIndex, S }: any) => {
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

export const Gallery = ({ items, S, extra, plain }: any) => {
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

export const Pane = ({ a, list, S }: any) => a ? (
    <div className="relative bg-black rounded-xl overflow-hidden border border-slate-800 cursor-zoom-in" style={{ aspectRatio: cssRatio(a.ratio) }}
        onClick={() => S.inspect(list, Math.max(0, list.findIndex((x: any) => x.id === a.id)))}>
        <img src={a.url} alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain" />
        {a.verdict && <div className="absolute top-2 left-2"><Badge v={a.verdict} /></div>}
    </div>) : null;

export const AssetCard = ({ a, S, extra, plain, group }: any) => {
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

export const RefSlot = ({ title, a, onClear, onPick, S, hint }: any) => {
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

export const Inspector = ({ items, start, onClose, S }: any) => {
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
                    <Btn tone="g" onClick={() => dl(it.url, it.type)}>İndir</Btn><Btn tone="r" onClick={del}>Sil</Btn><Btn tone="g" onClick={onClose}>Kapat</Btn>
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

export const useScenario = (S: any, tab: string): [string, (v: string) => void] => {
    const [local, setLocal] = usePersist(`${tab}.scenario`, '');
    const linked = S.link[tab] !== false;
    return [linked ? (S.bible.scenario || '') : local, (v: string) => linked ? S.patchScene({ scenario: v }) : setLocal(v)];
};

