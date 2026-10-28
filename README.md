# okey-engine

Türk Okeyi (klasik okey, 4 kişilik) için kural motoru ve bilgisayar oyuncusu. Ücretsizdir ve MIT lisansıyla dağıtılır. Başka hiçbir pakete ihtiyaç duymaz. Düz JavaScript ile yazıldığı için tarayıcıda da Node.js'te de derlemeden çalışır.

Motor şunları yapar:

- 106 taşı karıştırır, göstergeyi açar, okeyi belirler ve taşları dağıtır (başlayana 15, ötekilere 14).
- Sırayı yürütür: desteden ya da soldaki oyuncunun attığı taştan çek, bir taş at.
- Eli bitirmeyi denetler: seri, per, joker olarak okey, okeyin yerine geçen sahte okey, çift gitme.
- Bitiren oyuncunun elini serilere ve perlere kendisi ayırır, kaç puan getirdiğini hesaplar (okeyle bitirme, çiftle bitirme, elden bitirme çarpanları).
- Kurala aykırı bir hamleyi reddeder ve oyunun durumunu değiştirmez.
- Oyunu maç boyunca sürdürür; kaydedilip sonra kaldığı yerden sürdürülebilir.
- Çevrim içi oyunda sunucuda hakem olarak çalışabilir.
- Üç seviyede bilgisayar oyuncusu içerir: kolay, normal ve zor.

Masadan masaya değişen her kural ayardan seçilebilir (aşağıda "Ayarlar" bölümüne bakın).

**Sürüm durumu:** klasik okey hazır (1.0.0). Eşli okey (2'ye 2) ve 101 okey sırada; motor bunlara göre kuruldu ama henüz oynanamaz.

## Hızlı başlangıç

Dört bilgisayarın birlikte bir tur oynaması:

```js
import { OkeyHand, botStep } from './src/index.js';

const el = new OkeyHand({ dealer: 0 });      // başlayana 15, ötekilere 14 taş dağıtır
while (!el.over) {
  botStep(el, { level: 'zor' });             // sırası gelen bilgisayar hamlesini yapar
}
console.log(el.result.winner, el.result.mode, el.scores);
```

Oyuncular 0, 1, 2 ve 3 numaralı koltuklarda oturur. Sıra, koltuk numarası artacak yönde ilerler; bu, masada saat yönünün tersidir. Başlayan, dağıtıcıdan sonraki koltuktur: `(dealer + 1) % 4`. Bir oyuncu, kendinden önceki koltuğun (soldaki oyuncunun) attığı taşı alabilir.

## Taşların yazılışı

Her taş, önce rengin harfi, sonra sayısı, sonra hangi kopya olduğu (`a` ya da `b`) yazılarak gösterilir. Örneğin `Y5a` sarı 5, `K13b` siyah 13'tür.

| Renk | Harf |
| --- | --- |
| Sarı | `Y` |
| Mavi | `B` |
| Siyah | `K` |
| Kırmızı | `R` |

İki sahte okey `Fa` ve `Fb` olarak yazılır. `el.indicator` göstergeyi, `el.okey` (`{ color, number }`) okeyi verir. Okey olan iki taş joker, sahte okeyler ise okeyin kendisi yerine geçer.

## Bir turun oynanışı

Hangi aşamada olunduğu `el.phase` ile, sıranın kimde olduğu `el.turn` ile öğrenilir:

- `draw`: sıradaki oyuncu çekecek
- `discard`: sıradaki oyuncu taş atacak (ya da bitirecek)
- `done`: tur bitti

Başlayan oyuncu oyuna `discard` aşamasında, 15 taşla başlar.

| Aşama | Yapılan iş | Kullanılacak komut |
| --- | --- | --- |
| Çekme | Nereden çekilebileceğini öğrenmek | `el.drawOptions()` (örneğin `['deck', 'discard']`) |
| Çekme | Desteden ya da soldaki atıktan çekmek | `el.draw(koltuk, 'deck')` ya da `el.draw(koltuk, 'discard')` |
| Atma | Atılabilecek taşlar | `el.hands[koltuk]` (elindeki bütün taşlar) |
| Atma | Taş atmak | `el.discard(koltuk, 'Y5a')` |
| Bitirme | Hangi taşı atarak bitebileceğini öğrenmek | `el.finishOptions()` |
| Bitirme | Bitirmek (son taşı kapalı atar) | `el.finish(koltuk, 'Y5a')` ya da `el.finish(koltuk, 'Y5a', 'cift')` |

Kurala aykırı bir hamle motor tarafından reddedilir (hata fırlatır) ve oyunun durumu değişmez. Sırası gelmeyen oyuncunun hamlesi, elde olmayan bir taş, boş olan bir atığı almak ya da bitmeyen bir elle bitirmek buna örnektir.

Tur bittiğinde şu bilgiler hazırdır:

- `el.result.reason`: `finish` (biri bitirdi) ya da `deckOut` (deste bitti, tur berabere)
- `el.result.winner`, `el.result.mode` (`per` ya da `cift`), `el.result.okeyFinish`, `el.result.pair`, `el.result.fromHand`
- `el.result.groups`: bitirenin elinin serilere ve perlere ayrılmış hâli (jokerlerin neyin yerine geçtiği dahil) ya da `el.result.pairs` (çift gidildiyse)
- `el.scores`: her koltuğun bu turdaki puanı (kaybedenler eksi, bitiren 0)

Ekranda göstermek için oyunun geçmişi de tutulur:

| Bilgi | Nerede bulunur |
| --- | --- |
| Her koltuğun attığı taşlar (üstteki sonuncusu) | `el.discards` |
| Sırayla yapılan hamleler | `el.log` (desteden çekilen taş gizli kalır) |
| Destede kalan taş sayısı | `el.deck.length` (oyuncuya `view` içinde `deckSize` olarak verilir) |

## Bütün oyun

`OkeyMatch`, oyunu bitiş puanına kadar tur tur sürdürür. Herkes 20 puanla başlar; bitiren oyuncu puan kaybetmez, ötekilerin her biri puan kaybeder. Biri 0 puana ya da altına inince oyun biter ve en yüksek puanlı kazanır. En yüksek puanda eşitlik varsa bir tur daha oynanır. Her turda dağıtıcı bir sonraki koltuğa geçer.

```js
import { OkeyMatch, botStep } from './src/index.js';

const oyun = new OkeyMatch({ settings: { startScore: 20 } });
while (!oyun.over) {
  const el = oyun.startRound();
  while (!el.over) botStep(el, { level: 'normal' });
  oyun.finishRound();   // puanları ekler ve oyunun bitip bitmediğine bakar
}
console.log(oyun.winner, oyun.scores);
```

`oyun.standings` oyuncuların sıralamasını verir: `[{ seat, score, place }]`. `oyun.rounds` her turun özetini tutar.

## Kaydetme ve yükleme

Oyun istenen her an kaydedilip daha sonra kaldığı yerden sürdürülebilir. Örneğin eklentinin penceresi kapanıp yeniden açıldığında oyun kaybolmaz:

```js
const kayit = JSON.stringify(oyun);                    // OkeyMatch ya da OkeyHand
const oyun2 = OkeyMatch.fromJSON(JSON.parse(kayit));   // tek bir tur için OkeyHand.fromJSON
```

Bozuk ya da tutarsız bir kayıt yüklenmez; motor hata verir. Aynı taşın iki yerde görünmesi, el sayılarının tutmaması ya da kayıt biçiminin tanınmaması buna örnektir.

## Oyuncunun görebildikleri

`el.view(koltuk)` yalnızca o koltuktaki oyuncunun görmesi gereken bilgileri verir: kendi taşları, diğer oyuncuların elinde kaç taş olduğu, gösterge ve okey, herkesin attığı taşlar, destede kalan taş sayısı, hamle geçmişi, sırası geldiyse çekebileceği yerler ve hangi taşı atarak bitirebileceği. Rakiplerin taşları ve destenin içi bu bilgilerin içinde yer almaz; arayüz bunu kullandığında rakip taşları yanlışlıkla görünmez. Bütün oyun için `oyun.view(koltuk)` kullanılır.

## Çevrim içi oyun

Çevrim içi oyunda motor sunucuda çalışır ve oyunun tek hakemi odur. Oyuncular yalnızca hamlelerini gönderir. Sunucu her hamleyi `el.act` ile işler ve her oyuncuya kendi görebileceği bilgileri `view(koltuk)` ile gönderir.

```js
const sonuc = el.act(koltuk, { type: 'draw', value: 'deck', seq: 12 });
// başarılıysa { ok: true, seq: 13, tile: 'K7a' }, değilse örneğin { ok: false, error: 'notYourTurn' }
```

| Hamle | Gönderiliş biçimi |
| --- | --- |
| Çekme | `{ type: 'draw', value: 'deck' }` ya da `{ type: 'draw', value: 'discard' }` |
| Atma | `{ type: 'discard', value: 'Y5a' }` |
| Bitirme | `{ type: 'finish', value: 'Y5a' }` (son atılan taş; istenirse `mode: 'per'` ya da `'cift'`) |

- `act` hiçbir durumda çökmez; her zaman bir sonuç döndürür. Olası hata kodları şunlardır: `badAction` (mesaj bozuk), `stale` (hamle eski bir duruma göre gönderilmiş), `gameOver` (tur bitmiş), `notYourTurn` (sıra o oyuncuda değil), `wrongPhase` (bu aşamada bu hamle yapılamaz), `illegal` (kurala aykırı).
- Desteden çekilen taş yalnızca çeken oyuncuya, `act` sonucundaki `tile` alanında döner. Herkese giden `log` ve `lastAction` içinde yer almaz.
- **Hamle numarası:** `el.seq` her hamlede bir artar. Oyuncu hamlesiyle birlikte gördüğü numarayı da gönderirse geç kalan ya da iki kez gönderilen hamle `stale` koduyla reddedilir.
- `el.expects(koltuk)` o koltuktan hangi hamlenin beklendiğini söyler: `'draw'`, `'discard'` (bitirme de bu aşamadadır) ya da hiçbiri için `null`.
- **Güvenli karıştırma:** Taşlar, tarayıcının ya da Node.js'in (19 ve üstü) şifrelemede kullanılan rastgele sayı üreticisiyle karıştırılır. Böylece dağıtım önceden tahmin edilemez. Aynı üretici `secureRandom` adıyla da kullanılabilir. Testlerde her seferinde aynı dağıtımı elde etmek için kendi `rng` işlevinizi verebilirsiniz.
- **Bağlantısı kopan oyuncu:** `botAction(el, { level })` bilgisayarın yapacağı hamleyi, hamleyi yapmadan döndürür. Sunucu, süresi dolan oyuncunun yerine bu hamleyi `act` ile oynatabilir. Aynı yolla bilgisayar bir Web Worker'da düşünüp hamlesini ana sayfaya gönderebilir.

Bilinmeyen ya da sınır dışı bir ayar, aynı taşın iki yerde olması ya da geçersiz bir taş verilirse motor hata verir.

## Kurallar

Kuralların tamamı [docs/KURALLAR.md](docs/KURALLAR.md) dosyasındadır. Kısaca:

- 106 taşla oynanır: dört renk, 1'den 13'e, ikişer kopya, ayrıca iki sahte okey. Gösterge açılır; göstergenin bir fazlası okeydir ve joker olarak kullanılır. Sahte okey okeyin taşı yerine geçer.
- Başlayan oyuncu 15, ötekiler 14 taş alır. Başlayan bir taş atarak oyunu açar. Sonra herkes sırayla desteden ya da soldaki oyuncunun attığı taştan çeker ve bir taş atar.
- Bitirmek için 14 taşın hepsi aynı renkten ardışık serilere (en az 3 taş) ya da aynı sayıdan farklı renkli perlere (3 ya da 4 taş) ayrılmalıdır. Yedi çift de bitirir (çift gitme).
- Bitiren kalan son taşı kapalı atar. Okeyi son taş olarak atmak, çiftle bitirmek ve ilk 15 taşla (hiç çekmeden) bitirmek puanı ikiye katlar; çarpanlar birbiriyle çarpılır.
- Herkes 20 puanla başlar. Bitirene karşı kaybeden her oyuncu 2 puan (çarpanlarla daha fazla) kaybeder. Biri 0'a inince oyun biter.

### Ayarlar

Ayarlar `new OkeyHand({ settings: { … } })` ya da `new OkeyMatch({ settings: { … } })` ile verilir. Varsayılan değerler [src/settings.js](src/settings.js) dosyasındadır.

| Ayar | Varsayılan | Anlamı |
| --- | --- | --- |
| `variant` | `'klasik'` | Oyun türü (`'esli'` ve `'101'` henüz oynanamaz) |
| `aceHigh` | açık | 13'ten sonra 1 gelebilir (12-13-1 serisi) |
| `allowPairs` | açık | Yedi çiftle bitmek (çift gitme) serbest |
| `startScore` | 20 | Oyuna başlangıç puanı |
| `lossNormal` | 2 | Bitirene karşı her kaybedenin kaybettiği puan |
| `okeyFinishMultiplier` | 2 | Son taşı okey atarak bitirmenin çarpanı |
| `pairMultiplier` | 2 | Çiftle bitirmenin çarpanı |
| `handMultiplier` | 2 | İlk 15 taşla, çekmeden bitirmenin (elden bitirme) çarpanı |
| `winnerTakes` | kapalı | Bitiren, kaybedilen puanların toplamını kazanır |
| `endScore` | 0 | Biri bu puana ya da altına inince oyun biter |
| `maxRounds` | 0 | En çok kaç tur oynanacağı (0 = sınır yok) |

## Bilgisayar oyuncusu

`botStep(el, { level })`, sırası gelen koltuk için bir hamle yapar: çekme, taş atma ya da bitirme. Hamleyi yapmadan görmek için `botAction`, tek tek sormak için `botDraw` ve `botDiscard` kullanılır.

- **Kolay:** Acemi bir oyuncu gibi oynar; ara sıra rastgele taş atar, bitirme fırsatını kaçırabilir ve çoğunlukla desteden çeker.
- **Normal:** Elini seri ve perlere göre değerlendirir; attığı taşla en iyi eli korur, atığı alınca eli iyileşiyorsa alır, ele yedi çift çok yaklaşmışsa çift peşine düşer. Bitebilecekse her zaman biter.
- **Zor:** Normal gibi, ama zayıflatılmamış oynar ve bir adım ileriye bakar: ortada görülen taşları sayıp hangi taşın gelme olasılığını bilir, atacağı taşı ve atıktan alıp almayacağını eli en çok iyileştirecek şekilde seçer; bir sonraki oyuncunun atıktan aldığı taşlara yarayacak taş atmaktan kaçınır. Ölçüm: 3 normal bilgisayara karşı 800 turun yaklaşık %31'ini aldı (eşit güçte %25 olurdu).

Bilgisayar yalnızca kendi eliyle ve açık bilgilerle (atıklar, gösterge) oynar; rakiplerin taşlarına bakmaz. Hamle başına süre (bir işlemci çekirdeğinde ölçüldü): kolay ~2 ms, normal ~5 ms, zor ~150-250 ms (en kötü durumda 1-3 sn). Sunucuda çok oda varsa zor hamleleri sırayla ve süre sınırı koyarak hesaplatın; tarayıcıda bir Web Worker içinde çalıştırın.

## Test

```
npm test
```

Testler taşları ve dağıtımı, per/seri/çift çözücüyü (rastgele kurulmuş yüzlerce eli çözdürerek), hamle denetimini, bitirme ve puanlamayı, kaydetme ve yüklemeyi, rastgele oynanan yüzlerce tam turu, üç seviyedeki bilgisayarı ve bütün maçları sınar.

## Lisans

MIT lisansı, © 2026 Skynon Labs Ltd. Motoru kullanan uygulamaların motorun adını (örneğin "Hakkında" ekranında) anması rica edilir; zorunlu değildir.

---

*English:* A dependency-free rules engine and computer player for Turkish Okey (a 4-player tile game with an indicator tile, a wild okey and false jokers). Written in plain JavaScript modules, it runs in browsers and in Node.js. MIT licensed. See the code examples above.
