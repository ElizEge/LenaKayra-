# Production Memory — V20.2 hazırlığı

Bu dizindeki modüller henüz Canvas uygulamasına bağlanmamıştır.

- `schema.ts`: sürümlenmiş, metadata odaklı proje hafızası veri yapısı ve doğrulama.
- `local-cache.ts`: hata raporlayan yerel önbellek ve JSON içe/dışa aktarma.
- **Henüz GitHub'a otomatik yazma yoktur.** Tarayıcı içinde GitHub token saklanmayacak.
- `localStorage` kalıcı yedek değildir; Canvas sandbox erişimi ve kota kısıtları nedeniyle veri kaybolabilir.
- Büyük base64 görseller hafıza JSON'una eklenmemelidir.
- Public depoya gizli proje verisi yüklenmemelidir.
- Mevcut V20 uygulaması ve API motoru bu aşamada değişmedi.

Sıradaki iş: mevcut state modelleriyle alan eşlemesi, birim testleri, güvenli GitHub senkronizasyonu, ardından UI entegrasyonu.
