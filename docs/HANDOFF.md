# HANDOFF — devam kaydı

## 28 Ekim 2026 — Depo açıldı (1.0.0)

- Kullanıcı kararı: okey98 için kendi motorumuz yazılır (hazır motorlar Kotlin / lisanssız / GPL olduğu için elendi), batak-engine gibi ayrı depoda yayımlanır. Ad `okey-engine`, MIT, herkese açık.
- Sürüm 1 (klasik okey) bitti: kurallar `docs/KURALLAR.md`, API `README.md`. Mimari baştan üç türe göre kuruldu: ortak parçalar `tiles.js` (taşlar), `groups.js` (per/seri/çift çözücü), `scoring.js`, `bot.js`; tur ve maç sınıfları `hand.js` ve `match.js`; türler `settings.js` içindeki `VARIANTS` ile açılıp kapanır.
- Genişleme noktaları: `variant: 'esli'` (sürüm 2, 0+2 ile 1+3 eş) ve `variant: '101'` (sürüm 3). İkisi de `VARIANTS` içinde `playable: false`; `OkeyHand`/`OkeyMatch` oluşturulurken `assertPlayable` hata verir. Yapılırken `playable: true` yapılır, tür kuralları `hand.js` ve `scoring.js`'e eklenir.
- Henüz yok (bilerek): bkz. `docs/KURALLAR.md` sonundaki "Bilinçli olarak motorda olmayanlar".
- Bilgisayar ölçümü (1.0.0, birbirine karşı oynatıp 3 rakibe 1 oyuncu): normal, 3 kolay oyuncuya karşı yaklaşık %57 turu aldı (eşit güçte olsa %25). Kolay, 3 normal oyuncuya karşı yaklaşık %4 aldı. **Zor, normalden ölçülebilir biçimde güçlü değil** (120 turda %27, eşit güçte %25; ek denemelerde görülen taşları saymanın ağırlığını artırmak daha da kötüleştirdi). Zor yalnızca görülen taşları sayıp sonraki oyuncunun aldığı taşlara yarayacak taş atmaktan kaçınıyor. Sıradaki iyileştirme (istenirse): zor için gerçek bir arama (olasılıkla örnekleme) ya da rakip elini tahmin eden bir model; şimdilik yapılmadı.
