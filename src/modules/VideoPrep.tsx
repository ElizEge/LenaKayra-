/** AiFotofilm V20.2 modular extraction; canonical source lines 1404-1463. */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { callGeminiWithImages } from '../engine/gemini-api';
import { VIDEO_CAMERA_MOVEMENTS } from '../config/production-presets';
import { SYS } from '../engine/continuity';
import { usePersist, toB64, dl, cssRatio, LOCK, VIDEO_MODES, NEG_VIDEO, Btn, ActBtn, Sel, Area, Box } from '../core/shared';

export const VideoTab = ({ S }: any) => {
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

