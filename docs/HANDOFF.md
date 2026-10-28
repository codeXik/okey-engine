# HANDOFF — devam kaydı

## 28 Ekim 2026 — 101 okey (1.3.0)

- `variant: '101'` oynanabilir. Yeni dosyalar: `src/meld.js` (grup denetimi `checkGroup`, en iyi açılış `bestGroups`/`bestPairs`), `src/hand101.js` (`Okey101Hand`, `newHand`, `loadHand`, `bestOpening`), 101 puanlaması `scoring.js` içinde `scoreRound101`, bilgisayar `bot.js` sonunda (`botAction101`). `OkeyHand` 101'i kendisi oynamaz (`Okey101Hand` kullanılır); `OkeyMatch` türe göre doğru sınıfı seçer.
- Kural varsayımları (resmî kural kitabı yok, bkz. `docs/KURALLAR.md`): açma 101 puan ya da 5 çift, atığı alan o taşla açar, çiftle açan yalnız çift açar, açmayan 101 ceza, elde kalan okey 101, 1 taşı 1 (12-13-1 sonunda 14), 11 tur, en az ceza kazanır, deste bitince herkes elindekinin cezasını alır.
- Ölçüm: 101'de bilgisayar hamle başına ortalama ~4 ms, en kötü ~120 ms. Normal, kolayı açıkça yeniyor; zor ile normal arasında 101'de ölçülebilir fark yok (400 turda ceza 38,5 ve 41,2). Not: karşılaştırma yaparken oyuncuyu dağıtıcıya göre sabit koltuğa koymayın, koltuk sırası sonucu çarpıtıyor.
- Henüz yok: eşli 101, çevrim içi süre kuralları, 101'de bitirene eksi puan.

## 28 Ekim 2026 — Eşli okey (1.2.0)

- `variant: 'esli'` oynanabilir (`VARIANTS.esli.playable = true`). Yeni: `src/teams.js`; takım puanı `OkeyMatch.teamScores/teams/winnerTeam/winners`; `view` içinde `team/partner/teams`; puanlama `scoring.js` içinde (bitiren takım kaybetmez, rakip iki oyuncu kaybeder). Yeni ayar `teamEndScore`.
- Eş işbirliği bilerek basit: kurallara göre eşe taş verilemez (atığını rakip alır), bu yüzden bilgisayarın eşliye özel tek davranışı, başkalarının atıktan alıp tuttuğu taşları ortada olmayan saymasıdır.
- Sıradaki: 101 okey (sürüm 3).

## 28 Ekim 2026 — Depo açıldı (1.0.0)

- Kullanıcı kararı: okey98 için kendi motorumuz yazılır (hazır motorlar Kotlin / lisanssız / GPL olduğu için elendi), batak-engine gibi ayrı depoda yayımlanır. Ad `okey-engine`, MIT, herkese açık.
- Sürüm 1 (klasik okey) bitti: kurallar `docs/KURALLAR.md`, API `README.md`. Mimari baştan üç türe göre kuruldu: ortak parçalar `tiles.js` (taşlar), `groups.js` (per/seri/çift çözücü), `scoring.js`, `bot.js`; tur ve maç sınıfları `hand.js` ve `match.js`; türler `settings.js` içindeki `VARIANTS` ile açılıp kapanır.
- Genişleme noktaları: `variant: 'esli'` (sürüm 2, 0+2 ile 1+3 eş) ve `variant: '101'` (sürüm 3). İkisi de `VARIANTS` içinde `playable: false`; `OkeyHand`/`OkeyMatch` oluşturulurken `assertPlayable` hata verir. Yapılırken `playable: true` yapılır, tür kuralları `hand.js` ve `scoring.js`'e eklenir.
- Henüz yok (bilerek): bkz. `docs/KURALLAR.md` sonundaki "Bilinçli olarak motorda olmayanlar".
- Bilgisayar ölçümü (1.0.0, birbirine karşı oynatıp 3 rakibe 1 oyuncu): normal, 3 kolay oyuncuya karşı yaklaşık %57 turu aldı (eşit güçte olsa %25). Kolay, 3 normal oyuncuya karşı yaklaşık %4 aldı. **Zor, normalden ölçülebilir biçimde güçlü değil** (120 turda %27, eşit güçte %25; ek denemelerde görülen taşları saymanın ağırlığını artırmak daha da kötüleştirdi). Zor yalnızca görülen taşları sayıp sonraki oyuncunun aldığı taşlara yarayacak taş atmaktan kaçınıyor. Sıradaki iyileştirme (istenirse): zor için gerçek bir arama (olasılıkla örnekleme) ya da rakip elini tahmin eden bir model; şimdilik yapılmadı.

## 28 Ekim 2026 — Zor bilgisayar güçlendirildi (1.1.0)

- Zor, bir adım ileriye bakıyor (`makeLookahead` in `src/bot.js`). Ölçüm: zor, 3 normale karşı 800 turda yaklaşık %31 (100 turluk altı parçada %24-%40; eşit güç %25; yaklaşık 3,9 standart sapma üstü). Süre hamle başına ~150 ms tek başına, 4 süreç paralelken ~250-290 ms, en kötü ~3 sn. Normal bilerek zayıflatıldı (%22 ikinci en iyi taşı atar). Kolay-normal farkı sürüyor (normal 3 kolaya karşı %65).
- Daha fazlası istenirse: aday sayısını (`LOOKAHEAD_CANDIDATES`, 4) artırmak ya da rakip elini tahmin eden örnekleme; ikisi de süreyi artırır.
