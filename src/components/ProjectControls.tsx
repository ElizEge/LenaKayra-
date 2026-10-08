/** AiFotofilm V20.2 modular extraction; canonical source lines 1537-1697. */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getSavedApiKey } from '../engine/gemini-api';
import { Icons } from 'Icons';
import { usePersist, LOCK, TYPES, XFER, Btn, Inp, Area, hasScore, Badge, Xfer } from '../core/shared';
import { PROFILE_KEYS } from '../modules/Influencer';

export const CastManager = ({ S }: any) => {
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

export const ProjectBar = ({ S }: any) => {
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

export const JobBar = ({ S }: any) => S.jobs.length ? (
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

export const Dock = ({ S }: any) => {
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
                            <Xfer a={a} S={S} /><button title="Sil" className="ml-auto text-rose-300 hover:text-rose-200 px-1" onClick={() => S.delAsset(a.id)}><Icons.Trash /></button>
                        </div>
                    </div>))}
            </div>}
        </div>
    );
};

export const SettingsModal = ({ S }: any) => {
    const [sure, setSure] = useState(false); const [txt, setTxt] = useState('');
    const [keyInput, setKeyInput] = useState(() => getSavedApiKey());

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

