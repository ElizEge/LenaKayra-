# AiFotofilm V20.2 — Güvenli Modülerleştirme Planı

Durum: Aşama 2 başlangıcı — yalnızca geliştirme dalında hazırlık.
Ana kaynak: `aifotofilm_v20_production_bible.tsx`
Korunan dallar: `main` (çalışan kaynak), `backup/v20-baseline` (yedek).
Çalışma dalı: `development`.

## Değiştirilmeyecek davranışlar
- Gemini API sabitleri, API anahtarı çözümlemesi, endpoint oluşturma, retry, metin/görsel üretimi, gerçek görsel doğrulama ve hata işleme, mevcut sürümle eşdeğer kalacak.
- Gerçek üretim başarısızlığında sahte görsel, sahte puan veya başarılı görünüm üretilmeyecek.
- Studio, Reji, Image Lab, Next Frame, Storyboard, Video Prep ve Influencer işlevleri korunacak.
- Lena/Kayra/Metin kimlik referansları, karakter ve kıyafet sürekliliği korunacak.

## Sıralı geçiş
1. Kaynak kodun bileşen, yardımcı fonksiyon ve state bağımlılık haritasını çıkar.
2. Mevcut tek TSX dosyasını yerinde tut; önce modüler kopyayı ayrı `src/` ağacında oluştur.
3. `src/engine/gemini-api.ts` bloğunu kaynakla bire bir karşılaştır; yalnızca gerekli import/export düzenlemeleri yap.
4. Ortak tipler, UI bileşenleri ve modülleri küçük, doğrulanabilir adımlarla ayır.
5. TypeScript derleme, import çözümleme ve regresyon kontrolü ekle.
6. Modüler derlemenin davranışı doğrulanmadan tek dosyalık Canvas sürümünü değiştirme.
7. Production Memory okuma, yazma ve çatışma yönetimini Gemini API'den bağımsız geliştir.

## Önerilen dizin
```text
src/
  App.tsx
  engine/           # Gemini API, prompt compiler, continuity
  bible/            # Character, scene, production bible
  modules/          # Studio, Reji, ImageLab, NextFrame, Storyboard, VideoPrep, Influencer
  memory/           # Github sync, local cache, versioned schema
  components/       # Shared UI
production-memory/   # Yalnızca güvenli ve paylaşılabilir JSON verileri
```

## Güvenlik
- Bu depo public: özel prodüksiyon verilerini, kişisel bilgileri ve erişim anahtarlarını burada saklama.
- GitHub yazma yetkisi için tarayıcıya gömülü PAT kullanma; gerekirse ayrı güvenli servis kullan.
- GitHub hafızasına büyük base64 görselleri yazma; yalnızca varlık kimliği, sürüm ve referans bağlantıları sakla.
- `main` dalına doğrudan commit yapma; `development` üzerinde geliştir, testten sonra PR ile birleştir.

## Kabul kriterleri
- Orijinal V20 TSX dosyasının SHA değeri değişmemiş olmalı.
- API davranışını etkileyen farklar açıkça incelenmiş olmalı.
- Tüm sekmeler açılmalı, referans görseller çalışmalı, gerçek görsel üretimi canlı ortamda ayrıca test edilmeli.
- Hafıza bağlantısı başarısız olursa yerel çalışmanın verileri sessizce silinmemeli.

Bu dosya bir hazırlık planıdır; modülerleştirme veya canlı üretim testlerinin tamamlandığını iddia etmez.
