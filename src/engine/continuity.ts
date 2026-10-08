/** AiFotofilm V20.2 modular extraction; canonical source lines 375-472. */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { callGemini, callGeminiWithImages, fetchImageAsBase64 } from './gemini-api';
import { split64, toB64, LOCK } from '../core/shared';

// ═══════════════════════════════════════════════════════════════════════════
// 7. YÖNETMEN VE SÜREKLİLİK MOTORU SİSTEM KOMUTLARI (SYSTEM PROMPTS)
// ═══════════════════════════════════════════════════════════════════════════

export const J = 'Return JSON only.';
export const SC = 'score MUST be an integer from 0 to 100 (100 = perfect continuity, 80+ = consistent). Never use a 0-10 or 0-1 scale.';

export const SYS = {
    plan: `Sen AiFotofilm V19 Hikâye İlham ve Anlık Sahne Yönetmenisin. Yalnızca geçerli JSON döndür. Karakter kimliğini, cinsiyet kilidini ve kıyafet sürekliliğini koru. JSON: {"title":"","scene_summary_tr":"","action_tr":"","location":"","time":"","weather":"","camera_setup":"any","camera_angle":"any","aspect_ratio":"16:9","director_intent_tr":"","continuity_notes_tr":"","wardrobe_state":{"characterId":{"state_id":"","outfit_en":"","hair_makeup_en":"","props_en":""}},"story_state":{"previous_action":"","current_action":"","active_props":[]}}`,
    
    pre: `You are AiFotofilm Continuity Preflight Analyst. Audit the image prompt BEFORE rendering against the cast sex locks, DNA, the OUTFIT LOCK and the scene bible: find contradictions, missing locks, outfit drift, impossible light/time/weather. If repair is required, return a corrected COMPLETE but CONCISE English render prompt. Preserve every essential identity, gender, wardrobe, blocking, prop, environment, time, lighting, camera-side, action-axis and screen-direction lock, but NEVER append raw AI BLOCKING, SCENE MAP, CONTINUITY MANIFEST or other JSON objects to the render prompt. Avoid repeating the same fact in multiple sections. ${J} ${SC} {"score":0,"status":"ready|minor_drift","issues_tr":[""],"fixed_prompt":""}`,
    
    img: `Sen AiFotofilm Post-Render Continuity Director'sın. Üretilen görseli prompt, kadro, OUTFIT LOCK ve (varsa) referans kare ile karşılaştır: yüz/kimlik, cinsiyet kilidi, kıyafet, mekan, ışık, el/anatomi. Kamera açısı/kadraj/poz farkı beklenen bir durumdur, ceza verme; yalnızca gerçek kimlik, cinsiyet, kıyafet ve anatomi hatalarını puanla. ${J} ${SC} {"score":0,"status":"consistent|minor_drift","issues_tr":[""],"fix_prompt_en":""}`,
    
    batch: `You are AiFotofilm Multi-Shot Continuity Auditor. Compare every shot with the MASTER (image 1). Judge ONLY: face/identity, sex/gender, outfit, hair and overall art style / light mood. Different camera angle, framing, pose, composition, story progression and location changes that follow the story are EXPECTED and must NOT be penalised. Give fix_en only for real identity / outfit / anatomy errors, otherwise leave it empty. ${J} ${SC} {"shots":[{"id":"S1","score":0,"status":"consistent|minor_drift","issue_tr":"","fix_en":""}]}`,
    
    refine: `You are AiFotofilm Locked Refinement Director. Apply only the requested change; keep cast, outfits (OUTFIT LOCK), location, light and composition identical. Return only the complete corrected English image prompt.`,
    
    cont: `You are AiFotofilm Multi-Cam Continuity Planner. ${J} {"blocking_tr":"","action_axis_tr":"","continuity_lock_en":""}`,
    
    edit: `You are AiFotofilm Image Lab Edit Compiler. Convert the user's edit (any language) into ONE English edit prompt for the attached image; preserve identity, outfits and composition except what is explicitly changed. Return only the English edit prompt.`,
    
    analyze: `Analyze the supplied image and reconstruct a detailed English photographic MASTER PROMPT (cast, outfit, location, camera, lens, light). Return only the prompt.`,
    
    cut: `You are AiFotofilm Master Retouch Director. Study the image and choose the single most valuable cinematic improvement (light, grade, skin realism, background, composition) without changing identity. ${J} {"critique_tr":"","edit_prompt_en":""}`,
    
    labCrit: `Sen Image Lab Continuity Analyst'sin. Image 1 = ÖNCE, image 2 = SONRA. Kimlik, kıyafet ve istenmeyen değişiklikleri kontrol et. ${J} ${SC} {"score":0,"status":"consistent|minor_drift","issues_tr":[""],"fix_prompt_en":""}`,
    
    next: `You are AiFotofilm Continuity Director. From the attached previous frame, the scenario, the next action and camera motion, write ONE English image prompt for the next frame: same people, same outfits (respect OUTFIT LOCK exactly), same location and light; advance the action naturally. Return only the prompt.`,
    
    story: `You are a Professional Storyboard Director with a continuity engine. Plan consecutive shots as a real STORY progression across time: each shot is a DIFFERENT moment with its own action and MUST use a clearly different shot size, camera angle, lens and composition from the previous shot (never repeat the same framing). Location may change when the story moves on. Keep identities, outfits, art style and light mood continuous. Create ONE continuity manifest (outfits, location, light, props) that every shot must obey. ${J} {"estimated_duration":"18 sec","manifest_en":"","shots":[{"order":1,"title":"","story_beat":"","action":"","shot_size":"","angle":"","lens":"","movement":"","duration":2.5,"image_prompt_en":"self-contained detailed prompt with cast DNA, outfit, location, light"}]}`,
    
    nextAct: `You are AiFotofilm Story Director. Look at the attached frame and the scenario and propose the single most natural NEXT action beat (what happens in the next few seconds) as ONE short Turkish sentence. Keep the same people and setting. Return only the sentence.`,
    video: `You are AiFotofilm Video Preparation Director. Write ONE English image-to-video prompt for a video platform: subject action, camera movement, physics and continuity; with two frames, move from the first to the second. Return only the prompt.`,
    
    inf: `You are a Social Media Director for an AI influencer. Respect the profile (niche, personality, city, visual identity) and trend notes. If several characters are given they appear together in every shot (duo/group content) and every shot prompt must name all of them with their own look. ${J} {"caption":"","hashtags":[""],"shots":[{"title":"","prompt":""}]}`,
    
    ideas: `You are a Social Media Strategist. Propose 5 fresh, specific content topics (Turkish) for this influencer. ${J} {"ideas":[""]}`,
    
    scn: `Summarize the image prompt as a short Turkish scene summary (scenario) of 2-3 sentences. Return only the summary.`,
    
    core: `You are AiFotofilm Production Continuity Architect. Convert the scene plan into structured production state. Never change character identity, sex/gender, wardrobe facts or story intent. ${J} {"blocking":{"summary_tr":"","characters":[{"id":"","frame_position":"","depth":"","body_orientation":"","eyeline":"","action":""}],"action_axis":"","camera_side":"","screen_direction":""},"scene_map":{"people_count":0,"foreground":[],"midground":[],"background":[],"props":[{"name":"","position":"","owner":""}],"environment_anchors":[{"name":"","position":""}],"light_direction":"","action_axis":"","camera_side":""},"continuity_manifest":{"cast":[],"identity":{},"wardrobe":{},"hair":{},"props":{},"environment":"","time":"","weather":"","lighting":"","blocking":{},"action_axis":"","screen_direction":"","story_state":{}}}`
};

// ═══════════════════════════════════════════════════════════════════════════
// 8. SÜREKLİLİK MOTORU SERVİS KATMANI (AUDIT & REPAIR HANDLERS)
// ═══════════════════════════════════════════════════════════════════════════

export const normV = (v: any, keepStatus = false) => {
    if (!v || typeof v !== 'object') return v;
    let n = Number(v.score);
    if (!Number.isFinite(n)) return v;
    if (n > 0 && n <= 1) n *= 100; else if (n > 1 && n <= 10) n *= 10;
    n = Math.round(Math.max(0, Math.min(100, n)));
    return { ...v, score: n, ...(keepStatus ? {} : { status: n >= 80 ? 'consistent' : 'minor_drift' }) };
};

export const auditPromptService = async (
    prompt: string, 
    castInfoText: string, 
    lockText: string, 
    bibleContext: any, 
    sig: AbortSignal | null
) => {
    return callGemini(
        `CAST:\n${castInfoText}\nOUTFIT LOCK:\n${lockText}\nSCENE BIBLE: ${JSON.stringify(bibleContext)}\nPROMPT:\n${prompt}`, 
        true, 
        SYS.pre, 
        sig
    );
};

export const auditImageService = async (
    imageUrl: string, 
    prompt: string, 
    castInfoText: string, 
    lockText: string, 
    sig: AbortSignal | null, 
    refUrl: string | null = null
) => {
    const split64 = (u: string) => { 
        const m = /^data:([^;]+);base64,(.+)$/.exec(u || ''); 
        return m ? { mimeType: m[1], data: m[2] } : null; 
    };
    const toB64 = async (u: string, s: AbortSignal | null) => split64(u) || fetchImageAsBase64(u, s);

    const imgs = [await toB64(imageUrl, sig)];
    if (refUrl) imgs.unshift(await toB64(refUrl, sig));

    return callGeminiWithImages(
        `PROMPT:\n${prompt}\nCAST:\n${castInfoText}\nOUTFIT LOCK: ${lockText}\n${refUrl ? 'Image 1 = reference / previous frame, image 2 = the new frame.' : 'Single image to audit.'}`, 
        imgs, 
        true, 
        SYS.img, 
        sig
    );
};

