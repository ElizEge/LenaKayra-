import { Icons } from '../components/Icons';
/** V20.2 extraction candidate. Original presets remain active in Canvas. Only exports added. */
export const INITIAL_CHARACTERS = [
    { id: "lena", ad: "Lena", yas: 22, sex: "female", genderLock: "ADULT WOMAN / FEMALE — never male, man or boy", dna: "A 22-year-old elegant female model, porcelain skin, oval face, hazel eyes, natural wavy espresso brown hair", img: "https://raw.githubusercontent.com/ElizEge/LenaKayra-/main/LENA.png", identitySheet: "https://raw.githubusercontent.com/ElizEge/LenaKayra-/main/LENA%20CHARACTER%20IDENTITY%20SHEET.png", identityLocked: true, outfit: "white crop top, light blue denim mini skirt, white sneakers" },
    { id: "kayra", ad: "Kayra", yas: 21, sex: "female", genderLock: "ADULT WOMAN / FEMALE — Kayra must NEVER be rendered as male, man, boy or masculine-presenting male", dna: "A 21-year-old energetic ADULT FEMALE model / young woman, slim athletic feminine build, light skin, bright blue eyes, high bob pastel pink hair", img: "https://raw.githubusercontent.com/ElizEge/LenaKayra-/main/KAYRA.png", identitySheet: "https://raw.githubusercontent.com/ElizEge/LenaKayra-/main/KAYRA%20CHARACTER%20IDENTITY%20SHEET.png", identityLocked: true, outfit: "black crop top, white leather mini skirt, black boots" },
    { id: "metin", ad: "Metin", yas: 40, sex: "male", genderLock: "ADULT MAN / MALE", dna: "A 40-year-old witty male model, solid athletic build, light brown skin, brown eyes, short neat black hair, defined jawline", img: "https://raw.githubusercontent.com/ElizEge/LenaKayra-/main/MET%C4%B0N.png", identitySheet: "https://raw.githubusercontent.com/ElizEge/LenaKayra-/main/MET%C4%B0N%20CHARACTER%20IDENTITY%20SHEET.png", identityLocked: true, outfit: "dark green tactical shirt, black cargo pants" }
];

export const DEFAULT_INFLUENCER_PROFILES: Record<string, any> = {
    lena: { niche: 'Fashion & Lifestyle', personality: 'Elegant, natural, confident', city: 'İstanbul', contentPillars: 'Fashion 30%, Lifestyle 30%, Travel 15%, Beauty 15%, Personal 10%', visualIdentity: 'Elegant candid editorial, premium but believable social media photography', captionVoice: 'Minimal, elegant, warm; short Turkish/English mix when natural', postingFrequency: 3, favoriteLocations: 'city streets, tasteful cafés, hotels, waterfront, boutiques', wardrobeCapsule: 'refined contemporary fashion, neutral layers, occasional statement piece', avoid: 'same café, same outfit, repetitive mirror selfies, over-polished artificial poses' },
    kayra: { niche: 'Street Fashion & Youth Lifestyle', personality: 'Energetic, playful, colorful', city: 'İstanbul', contentPillars: 'Street Style 30%, Lifestyle 25%, Travel 15%, Café 15%, Beauty & Fun 15%', visualIdentity: 'Youthful candid street photography, playful direct flash, colorful everyday moments', captionVoice: 'Playful, concise, emoji-friendly, Turkish with occasional English phrases', postingFrequency: 3, favoriteLocations: 'street corners, cafés, concerts, airports, colorful interiors', wardrobeCapsule: 'streetwear, crop silhouettes, playful accessories, bold color accents', avoid: 'stiff luxury posing, repeated locations, identical framing, overly serious captions' },
    metin: { niche: 'Photography & Urban Lifestyle', personality: 'Witty, cinematic, grounded', city: 'Trabzon', contentPillars: 'Photography 30%, Urban Life 25%, Travel 20%, Coffee 15%, Behind the Scenes 10%', visualIdentity: 'Cinematic documentary realism, authentic urban moments, photographer lifestyle', captionVoice: 'Short, witty, grounded Turkish; occasional cinematic observation', postingFrequency: 3, favoriteLocations: 'city streets, viewpoints, cafés, coast, behind-the-scenes locations', wardrobeCapsule: 'smart casual, practical dark layers, photographer-friendly outfits', avoid: 'repetitive tactical styling, fake luxury, same camera pose, generic motivational captions' }
};

export const ASPECT_RATIOS = [
    { id: 'any', label: 'Otomatik (AI Karar Verir)' },
    { id: '16:9', label: '16:9 (Yatay)' },
    { id: '9:16', label: '9:16 (Dikey)' },
    { id: '1:1', label: '1:1 (Kare)' },
    { id: '4:5', label: '4:5 (Portre)' },
    { id: '21:9', label: '21:9 (Sinema)' }
];

export const STYLE_PRESETS = [
    { id: 'any', tr: 'Otomatik', en: '' },
    { id: 'neutral', tr: 'Sinematik Doğal', en: 'Cinematic authentic photorealism, balanced colors, natural contrast' },
    { id: 'pastel', tr: 'Simetrik Pastel', en: 'Perfectly symmetrical composition, refined pastel palette, controlled production design' },
    { id: 'neo_noir', tr: 'Neo-Noir Gerilim', en: 'Cold cyan and warm practical split toning, low-key lighting, deep controlled shadows' },
    { id: 'gritty35', tr: 'Kumlu 35mm Suç', en: 'Gritty 35mm film texture, punchy contrast, warm practical highlights, documentary tension' },
    { id: 'luxury', tr: 'Lüks Editoryal', en: 'High-end fashion editorial polish, elegant tonal separation, premium magazine aesthetic' },
    { id: 'dreamy', tr: 'Rüya Gibi Altın Sinema', en: 'Soft cinematic bloom, luminous highlights, subtle film halation, romantic atmospheric depth' },
    { id: 'bleach', tr: 'Bleach Bypass', en: 'Desaturated cinematic palette, silvery highlights, strong micro contrast, restrained color' },
    { id: 'tealamber', tr: 'Teal & Amber', en: 'Controlled teal shadows and amber highlights, cinematic color separation, realistic skin tones' }
];

export const CAMERA_SETUPS = [
    { id: 'any', tr: 'Otomatik', en: '' },
    { id: '14mm_ext_wide', tr: '14mm (Ultra Geniş)', en: '14mm lens, extreme wide shot, deep focus' },
    { id: '24mm_wide', tr: '24mm (Geniş Çekim)', en: '24mm lens, wide shot, full environment context' },
    { id: '35mm_full', tr: '35mm (Tam Boy)', en: '35mm lens, full shot, full body framing' },
    { id: '50mm_medium', tr: '50mm (Orta Çekim)', en: '50mm lens, medium shot, waist-up framing' },
    { id: '85mm_med_close', tr: '85mm (Portre)', en: '85mm lens, medium close-up, chest-up portrait framing, shallow depth of field' },
    { id: '105mm_close', tr: '105mm (Yakın Çekim)', en: '105mm lens, close-up, tight facial framing' },
    { id: '200mm_ext_close', tr: '200mm (Detay)', en: '200mm lens, extreme close-up detail framing' }
];

export const CAMERA_ANGLES = [
    { id: 'any', tr: 'Otomatik', en: '' },
    { id: 'eye', tr: 'Göz Hizasında', en: 'eye-level camera angle' },
    { id: 'low', tr: 'Aşağıdan (Low)', en: 'low-angle camera position' },
    { id: 'high', tr: 'Yukarıdan (High)', en: 'high-angle camera position' },
    { id: 'dutch', tr: 'Eğik (Dutch)', en: 'subtle dutch angle' },
    { id: 'ots', tr: 'Omuz Üstü (OTS)', en: 'over-the-shoulder camera position' },
    { id: 'top', tr: 'Kuşbakışı', en: 'top-down camera angle' },
    { id: 'ground', tr: 'Zemin Seviyesi', en: 'ground-level camera position' }
];

export const SEASONS = [
    { id: 'any', tr: 'Otomatik', en: '' },
    { id: 'spring', tr: 'İlkbahar', en: 'spring season, blooming, fresh' },
    { id: 'summer', tr: 'Yaz', en: 'summer season, lush green, vibrant' },
    { id: 'autumn', tr: 'Sonbahar', en: 'autumn season, falling leaves, orange and brown tones' },
    { id: 'winter', tr: 'Kış', en: 'winter season, cold, snowy landscape' }
];

export const WEATHERS = [
    { id: 'any', tr: 'Otomatik', en: '' },
    { id: 'clear', tr: 'Açık / Güneşli', en: 'clear weather, sunny sky' },
    { id: 'overcast', tr: 'Bulutlu', en: 'overcast, cloudy sky, soft diffused light' },
    { id: 'rain', tr: 'Yağmurlu', en: 'rainy weather, wet surfaces, water reflections' },
    { id: 'snow', tr: 'Karlı', en: 'snowing, snow-covered environment' },
    { id: 'fog', tr: 'Sisli', en: 'thick fog, atmospheric haze, mysterious' }
];

export const LIGHT_TIMES = [
    { id: 'any', tr: 'Otomatik', en: '' },
    { id: 'sunrise', tr: 'Gün Doğumu', en: 'sunrise light' },
    { id: 'day', tr: 'Gün Işığı', en: 'daylight' },
    { id: 'golden', tr: 'Altın Saat', en: 'golden hour' },
    { id: 'blue', tr: 'Mavi Saat', en: 'blue hour' },
    { id: 'night', tr: 'Gece', en: 'nighttime' }
];

export const LIGHT_STYLES = [
    { id: 'any', tr: 'Otomatik', en: '' },
    { id: 'soft', tr: 'Yumuşak', en: 'soft diffused lighting' },
    { id: 'hard', tr: 'Sert (Hard)', en: 'hard directional lighting' },
    { id: 'rembrandt', tr: 'Rembrandt', en: 'Rembrandt portrait lighting' },
    { id: 'rim', tr: 'Kenar Işığı', en: 'defined rim lighting' },
    { id: 'backlight', tr: 'Ters Işık', en: 'cinematic backlighting' },
    { id: 'highkey', tr: 'Aydınlık (High Key)', en: 'high-key lighting' },
    { id: 'lowkey', tr: 'Karanlık (Low Key)', en: 'low-key dramatic lighting' }
];

export const MAGIC_LIGHTS = [
    { id: 'morning', label: 'Sabah', prompt: 'Cinematic morning light, soft dawn illumination, subtle warm tones, fresh atmosphere', icon: Icons.Sunrise },
    { id: 'golden', label: 'Altın Saat', prompt: 'Golden hour lighting, long warm directional shadows, cinematic sunset glow', icon: Icons.Sun },
    { id: 'blue', label: 'Mavi Saat', prompt: 'Blue hour cinematic lighting, cool deep blue ambient light with contrasting warm practical lights', icon: Icons.Sun },
    { id: 'night', label: 'Gece', prompt: 'Cinematic night time lighting, dark atmosphere, motivated practical lights or street lights', icon: Icons.Moon }
];

export const DIVERSE_THEME_PROMPTS = [
    "Cyberpunk neon street at twilight, reflective rain puddles, high-contrast atmospheric backlighting",
    "Moody vintage jazz bar interior with warm ambient tungsten lighting, deep velvet shadows",
    "Windy high-rise rooftop golden hour fashion editorial, dynamic hair motion, low sun flare",
    "Atmospheric misty autumn mountain highway overlook, overcast diffused soft daylight",
    "Minimalist modern art gallery with concrete textures, geometric shadow patterns",
    "Late-night retro diner booth with practical neon reflections on glossy table",
    "Lush Mediterranean seaside villa terrace at blue hour, warm terrace lanterns",
    "Dramatic rainstorm under European historic archway, glossy wet cobblestones",
    "Old bookstore or vinyl record shop aisle, soft golden dust motes, rich warm tones",
    "High-speed urban subway platform passing train motion blur, sharp focus on subject"
];

export const REJI_CAMERA_SHOTS = [
    { 
        id: 'master', 
        name: 'Master İkili Plan (A-Cam)', 
        tag: 'A-Cam',
        desc: 'İki karakterin mekansal konumunu ve 180° aks çizgisini kuran ana sahne planı',
        prompt: 'Master shot, cinematic two-shot spatial blocking establishing character interaction, environment depth and strict 180-degree axis line.' 
    },
    { 
        id: 'ots_reverse', 
        name: 'Omuz Üstü / Ters Açı (B-Cam)', 
        tag: 'B-Cam',
        desc: 'Ön planda omuz flusu ile 1. karaktere odaklanan sinematik ters açı',
        prompt: 'Professional Over-The-Shoulder (OTS) reverse angle shot, depth layering with foreground shoulder looking at the primary character, matching eyeline and spatial continuity.' 
    },
    { 
        id: 'ots_counter', 
        name: 'Karşı Omuz Üstü (B2-Cam)', 
        tag: 'B2-Cam',
        desc: 'Diğer karakterin açısından 2. karaktere bakan karşı omuz üstü açı',
        prompt: 'Professional counter Over-The-Shoulder (OTS) shot from the opposite perspective looking at the second partner, complementary depth layering and matched focal length.' 
    },
    { 
        id: 'reaction_c1', 
        name: '1. Karakter Yakın Plan (C1-Cam)', 
        tag: 'C1-Cam',
        desc: 'İlk karakterin yüz detaylarına, mimiklerine ve bakış doğrultusuna odaklanan sığ alan derinlikli yakın çekim',
        prompt: 'Cinematic tight close-up portrait of the first character / speaker, dramatic shallow depth of field, focused on their detailed facial geometry, micro-expressions, eyes and authentic optical bokeh.' 
    },
    { 
        id: 'reaction_c2', 
        name: '2. Karakter Karşı Yakın Plan (C2-Cam)', 
        tag: 'C2-Cam',
        desc: 'İkinci / karşı karakterin yüz detaylarına ve dinleme reaksiyonuna odaklanan eşlenik yakın çekim',
        prompt: 'Cinematic tight close-up portrait of the second / opposite character (the dialogue partner), dramatic shallow depth of field, reciprocal eyeline match, micro-expressions and authentic optical bokeh.' 
    },
    { 
        id: 'insert_detail', 
        name: 'Detay / İnsert Plan (D-Cam)', 
        tag: 'D-Cam',
        desc: 'Sahnedeki prop, el teması, kahve, çanta veya jest etkileşimine odaklanan detay planı',
        prompt: 'Cinematic insert shot / detail close-up focusing on character hands, tactile interaction with key props (cup, bag, accessories) or critical scene objects with cinematic macro lighting.' 
    },
    { 
        id: 'wide_env', 
        name: 'Geniş Çevre / Establishing (E-Cam)', 
        tag: 'E-Cam',
        desc: 'Sahnenin geçtiği atmosferik mekanı ve ortam derinliğini gösteren genel çevre planı',
        prompt: 'Atmospheric wide establishing shot, full environment context, environmental lighting and architectural mood while keeping character spatial positions intact.' 
    },
    { 
        id: 'low_dramatic', 
        name: 'Dramatik Alt Açı (F-Cam)', 
        tag: 'F-Cam',
        desc: 'Sahnedeki dinamizm ve güç dengesini hissettiren stilize düşük açı',
        prompt: 'Cinematic low-angle camera perspective looking slightly upward, dynamic framing emphasizing character presence and dramatic environmental scale.' 
    }
];

export const STORY_CAMERA_SHOTS = [
    { id: 'follow', name: 'Takip Planı', tag: 'FLOW-A', desc: 'Karakterin doğal aksiyonunu takip eden hareketli plan', prompt: 'Smooth cinematic follow shot tracking the visible subject through the next natural beat of the action.' },
    { id: 'front_track', name: 'Önden Takip', tag: 'FLOW-B', desc: 'Kamera karakterin önünde kontrollü geri hareket eder', prompt: 'Controlled front tracking shot, camera moving backward ahead of the visible subject while maintaining eyeline and spatial continuity.' },
    { id: 'rear_track', name: 'Arkadan Takip', tag: 'FLOW-C', desc: 'Kamera karakteri arkadan takip eder', prompt: 'Cinematic rear follow shot tracking behind the visible subject, preserving screen direction and environment continuity.' },
    { id: 'side_track', name: 'Yandan Takip', tag: 'FLOW-D', desc: 'Kamera karakterle paralel ilerler', prompt: 'Smooth lateral tracking shot moving parallel with the visible subject, stable horizon and coherent background parallax.' },
    { id: 'push_action', name: 'Aksiyona Yaklaş', tag: 'FLOW-E', desc: 'Aksiyon ilerlerken kontrollü yaklaşma', prompt: 'Slow controlled dolly-in during the natural action progression, increasing emotional emphasis without changing cast or blocking arbitrarily.' },
    { id: 'pull_reveal', name: 'Çevreyi Aç', tag: 'FLOW-F', desc: 'Aksiyondan uzaklaşıp çevreyi açan plan', prompt: 'Smooth dolly-out / pull-away during action progression, gradually revealing more of the established environment.' },
    { id: 'orbit_action', name: 'Yörünge Takibi', tag: 'FLOW-G', desc: 'Aksiyon sırasında kontrollü çevresel kamera hareketi', prompt: 'Subtle controlled orbit during the action beat, only when spatial geometry supports it; preserve the established action axis.' },
    { id: 'crane_reveal', name: 'Vinç Açılımı', tag: 'FLOW-H', desc: 'Aksiyonu çevreyle birlikte açan yükselen plan', prompt: 'Smooth crane rise revealing the established environment as the action progresses, with physically plausible motion and stable continuity.' }
];

export const VIDEO_CAMERA_MOVEMENTS = [
    { id: 'auto', label: 'Otomatik · Yönetmen Seçimi', prompt: 'Analyze both frames and choose the most cinematic physically plausible camera movement. A locked-off camera is valid when movement would weaken the scene.' },
    { id: 'locked', label: 'Sabit Kamera', prompt: 'Locked-off tripod camera. No camera translation, pan, tilt, zoom or orbit.' },
    { id: 'dolly_in', label: 'Kamera Yaklaşma', prompt: 'Slow controlled cinematic dolly-in toward the subject.' },
    { id: 'dolly_out', label: 'Kamera Uzaklaşma', prompt: 'Slow controlled cinematic dolly-out away from the subject.' },
    { id: 'pan_left', label: 'Sola Çevirme', prompt: 'Smooth cinematic pan left while preserving horizon and subject continuity.' },
    { id: 'pan_right', label: 'Sağa Çevirme', prompt: 'Smooth cinematic pan right while preserving horizon and subject continuity.' },
    { id: 'tilt_up', label: 'Yukarı Çevirme', prompt: 'Smooth cinematic tilt up.' },
    { id: 'tilt_down', label: 'Aşağı Çevirme', prompt: 'Smooth cinematic tilt down.' },
    { id: 'track_left', label: 'Sola Takip', prompt: 'Smooth lateral tracking / truck left.' },
    { id: 'track_right', label: 'Sağa Takip', prompt: 'Smooth lateral tracking / truck right.' },
    { id: 'orbit', label: 'Yörünge Hareketi', prompt: 'Slow controlled cinematic orbit around the subject while preserving spatial continuity.' },
    { id: 'crane_up', label: 'Vinç Yükselme', prompt: 'Smooth cinematic crane / pedestal rise.' },
    { id: 'crane_down', label: 'Vinç Alçalma', prompt: 'Smooth cinematic crane / pedestal descent.' },
    { id: 'drone_in', label: 'Drone Yaklaşma', prompt: 'Cinematic aerial drone push-in: smoothly fly toward the subject while gently descending only if composition benefits.' },
    { id: 'drone_out', label: 'Drone Uzaklaşma', prompt: 'Cinematic aerial drone pull-away: smoothly fly backward and gradually reveal the wider environment, with a subtle rise when appropriate.' }
];

