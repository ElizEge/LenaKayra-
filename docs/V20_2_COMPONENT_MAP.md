# AiFotofilm V20 — Kaynak bileşen haritası

Referans: `aifotofilm_v20_production_bible.tsx` (2016 satır, development dalı).

| Kaynak satırı | Bileşen / sorumluluk | Hedef modül |
| --- | --- | --- |
| 1–78 | Canvas sandbox localStorage/clipboard uyumluluğu | `src/platform/canvas-compat.ts` |
| 79–374 | Gemini API, retry, multimodal, gerçek görsel kapısı | `src/engine/gemini-api.ts` |
| 375–472 | Sistem promptları ve süreklilik denetimi | `src/engine/continuity.ts` |
| 473–495 | SVG ikon bileşenleri | `src/components/Icons.tsx` |
| 496–695 | Karakter referansları ve çekim presetleri | `src/config/production-presets.ts` |
| 696–948 | Persist, yardımcılar, ortak UI, Inspector | `src/components/` ve `src/state/` |
| 949–1076 | Studio | `src/modules/Studio.tsx` |
| 1077–1149 | Reji | `src/modules/Reji.tsx` |
| 1150–1237 | Image Lab | `src/modules/ImageLab.tsx` |
| 1238–1314 | Next Frame | `src/modules/NextFrame.tsx` |
| 1315–1403 | Storyboard | `src/modules/Storyboard.tsx` |
| 1404–1463 | Video Prep | `src/modules/VideoPrep.tsx` |
| 1464–1534 | Influencer | `src/modules/Influencer.tsx` |
| 1535–1697 | Cast Manager, proje araçları ve Dock | `src/components/` |
| 1698–2016 | Ana App, iş kuyruğu ve state | `src/App.tsx` |

## Kritik bağımlılık
Sekmeler `S` adlı ortak uygulama bağlamını kullanıyor. Sekmeleri yalnızca metin keserek ayırmak güvenli değil: önce `S` arayüzünü ve yardımcı bağımlılıklarını tanımlamak, ardından TSX derlemesini doğrulamak gerekiyor.

## Yapılan işlemler
- API ve presetler ayrı aday modüllere kaynak metinleri değiştirilmeden çıkarıldı.
- Mevcut tek dosyalık Canvas giriş noktası hâlâ esas çalışan uygulama.
- Kaynak eşitliği kontrolü için GitHub Actions iş akışı eklendi.
- Canlı Gemini üretim testi henüz yapılmadı.
