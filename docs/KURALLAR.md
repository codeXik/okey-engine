# Okey kural belgesi (28 Ekim 2026)

Kaynaklar: Türkiye'de masalarda ve çevrim içi salonlarda en yaygın oynanan klasik okey kuralları; proje sahibinin kararlarıyla birleştirildi. Resmî kural kitabı yoktur; ayrıntılar masadan masaya değiştiği için **masadan masaya değişen her kural ayardan seçilir** ve varsayılanlar en yaygın oynanışa göre konmuştur. Ayarlar `src/settings.js` içindedir.

## Sürümler ve oyun türleri

| Tür | Ayar (`variant`) | Durum |
| --- | --- | --- |
| Klasik okey (4 kişi, herkes kendi başına) | `klasik` | **Sürüm 1: hazır** |
| Eşli okey (2'ye 2; 0+2 ile 1+3 eş) | `esli` | **Sürüm 2: hazır** |
| 101 okey (4 kişi, tek tek) | `101` | **Sürüm 3: hazır** (eşli 101 yok) |

Hazır olmayan bir tür seçilirse motor hata verir (`Variant not playable yet`); şu an üç türün üçü de oynanabilir. Üç türün ortak parçaları (taşlar, per/seri denetimi, çözücü, kayıt, bilgisayarın el değerlendirmesi) ayrı modüllerdedir; yeni tür bunların üstüne kural ekler.

## Taşlar ve dağıtım

- 106 taş: 4 renk (sarı `Y`, mavi `B`, siyah `K`, kırmızı `R`) × 1'den 13'e kadar sayı × 2 kopya = 104 taş, artı **2 sahte okey**. Taşın yazılışı: renk harfi + sayı + kopya (`Y5a`, `K13b`). Sahte okeyler `Fa` ve `Fb`.
- **Gösterge:** karıştırılan taşlardan biri açılır. Sahte okey gösterge olamaz; gelirse bir sonraki taş açılır. Gösterge oyundan çıkar (yerde açık durur).
- **Okey:** göstergenin aynı renkte bir fazlası; 13 göstergesinin okeyi 1 olur. Bu taşların iki kopyası da **joker**dir (her taşın yerine geçer).
- **Sahte okey**, joker değildir: okeyin kendisinin (renk ve sayısının) yerine geçer. Yani okey Kırmızı 9 ise sahte okey "Kırmızı 9" gibi kullanılır.
- Dağıtım: dağıtıcının sonraki koltuğu (`(dealer + 1) % 4`) **başlayan** olur ve 15 taş alır; diğerleri 14 taş. Kalan 48 taş desteyi oluşturur.
- Koltuk numarası arttıkça oyun sırası ilerler (masada saat yönünün tersi).

## Sıra

1. **Başlayan** ilk hamlesinde taş çekmez; elindeki 15 taştan birini atar (ya da elden biter, aşağıya bakın).
2. Sonraki her oyuncu sırası gelince **çeker**: ya desteden bir taş (kapalı, kimse görmez) ya da **kendinden önceki koltuğun** (soldaki oyuncunun) attığı son taşı alır. Taşı aldıktan sonra elinde 15 taş olur.
3. Ardından bir taş **atar** (her oyuncunun attığı taşlar önünde açık durur, üstteki sonuncusudur) ya da **biter**.
4. Sıra bir sonraki koltuğa geçer.

Deste bittiğinde (son taş atıldıktan sonra deste boşsa) tur **berabere** biter ve kimse puan kaybetmez.

## Per ve seri (elin açılması)

El 14 taşla bitirilir: 15 taşlı elden biri atılır, kalan 14 taşın **hepsi** aşağıdaki gruplara ayrılmış olmalıdır:

- **Seri:** aynı renkten ardışık en az 3 sayı (`Y4 Y5 Y6`). En fazla 13 taş. `aceHigh` açıkken (varsayılan) **12-13-1** de seridir; fakat 13'ü aşıp 1-2'ye geçilmez (**13-1-2 olmaz**). Kapalıyken 1 yalnızca serinin başında kullanılır.
- **Per (takım):** aynı sayıdan, **farklı renklerde** 3 ya da 4 taş (`Y7 B7 K7`). Aynı renk iki kez kullanılamaz.
- **Joker (okey):** serinin ya da perin herhangi bir boşluğunu doldurur; seri veya perin ucuna da eklenebilir. Bir elde en fazla iki joker olabilir.
- **Sahte okey:** yukarıdaki gibi okeyin taşı gibi sayılır.
- 3 taşlık bir grup, 4 ve 5 taşlıklarla birlikte tüm elin 14 taşı olabilir (3+3+4+4, 3+3+3+5, 4+5+5, 3+3+8 vb. hepsi geçerli).

Motor, kalan 14 taşın dizilişini kendisi bulur (`solveGroups`); oyuncunun taşları rafta nasıl dizdiği motoru ilgilendirmez.

## Çift gitme

`allowPairs` açıkken (varsayılan) el, **yedi çiftten** de oluşabilir: 14 taşın 7 çifti, her çift aynı renk ve aynı sayıdan iki taş. Joker tek kalmış herhangi bir taşla çift olur; iki joker birbiriyle de çift olur. Sahte okey, okey taşının kendisi olarak çift yapar.

Hem per hem çift olarak bitebilen bir el çok nadirdir; böyle olursa fazla puan getiren seçilir (ya da hamlede `mode` ile belirtilir).

## Bitirme

Bitiren oyuncu, 15 taşından birini **kapalı olarak ortaya atar** (`finish`); kalan 14 taş yukarıdaki kurallara göre bitmelidir. Her hamlede hangi taş atılarak bitilebileceği `finishOptions` ile öğrenilir.

- **Okey atarak bitirme:** son atılan taş okey (joker) ise puan iki katı.
- **Çift ile bitirme:** yedi çiftle bitirmek puanı iki katına çıkarır.
- **Elden bitirme:** başlayan oyuncu daha hiç taş çekmeden ilk 15 taşıyla bitirirse (`fromHand`) puan iki katı.
- Çarpanlar birbiriyle çarpılır (okeyle bitirilen çift: ×4; elden okeyle çiftle: ×8).

## Puanlama

Her oyuncu maça `startScore` (varsayılan **20**) puanla başlar. Bir tur biterken:

- Bitiren puan kaybetmez; diğer üç oyuncunun her biri `lossNormal` (varsayılan **2**) × çarpanlar kadar puan kaybeder.
- Normal bitiş: −2. Okeyle bitiş: −4. Çiftle bitiş: −4. Okeyle çift: −8. Elden bitiş: −4.
- `winnerTakes` açılırsa bitiren, kaybedilen puanların toplamını kazanır (varsayılan kapalı).
- Deste bitip tur berabere kalırsa kimse puan kaybetmez.

**Maçın bitişi:** biri `endScore` (varsayılan **0**) puana ya da altına inince maç biter; en yüksek puanlı kazanır. En yüksek puanda eşitlik varsa bir tur daha oynanır. `maxRounds` sıfırdan büyükse o kadar turdan sonra maç biter (varsayılan sınırsız). Her tur dağıtıcı bir sonraki koltuğa geçer.

## Eşli okey (2'ye 2)

`variant: 'esli'` ile oynanır. Oynanış (dağıtım, çekme, atma, per ve seri, çift gitme, bitirme) **klasik okeyle birebir aynıdır**; yalnızca takımlar ve puanlama farklıdır.

- **Takımlar:** 0 ve 2 numaralı koltuklar bir takım (takım 0), 1 ve 3 numaralılar öteki takım (takım 1). Eş karşıda oturur. Sıra yine koltuk numarası arttıkça ilerler; masada sırayla bir takım, bir rakip oynar.
- **Atıktan çekme:** Klasikteki gibi, her oyuncu yalnızca kendinden önceki koltuğun attığı taşı alabilir. Bu koltuk her zaman bir rakiptir; yani eşin attığı taşı rakip alabilir, eşe taşı doğrudan vermenin yolu yoktur.
- **Kazanan:** Bitiren oyuncunun takımı turu kazanır.
- **Puanlama:** Bitiren oyuncu **ve eşi** puan kaybetmez; rakip takımın **iki oyuncusu da** `lossNormal` × çarpanlar kadar puan kaybeder (normal bitişte her biri −2, takım olarak −4; okeyle çift: her biri −8). Çarpanlar klasikteki gibidir. `winnerTakes` açılırsa bitiren takımın iki oyuncusu da kaybedilen kadar puan kazanır. Deste bitip tur berabere kalırsa kimse puan kaybetmez.
- **Takım puanı:** Takımın puanı, iki oyuncusunun puanının toplamıdır (herkes `startScore` ile başlar, yani takım 40 puanla başlar). Bir takımın toplamı `teamEndScore` (varsayılan **0**) puana ya da altına inince maç biter; toplamı yüksek olan takım kazanır. Toplamlar eşitse bir tur daha oynanır. `maxRounds` de geçerlidir; `endScore` eşlide kullanılmaz.
- **Gizlilik:** Hiçbir oyuncu eşinin elini de görmez; `view(koltuk)` yalnızca oyuncunun kendi taşlarını verir. Tur bittiğinde bütün eller açılır, klasikteki gibi.
- **Bilgisayar:** Üç seviye de eşli oynar. Zor seviye, başkalarının atıktan alıp elinde tuttuğu taşları ortada olmayan taşlar sayar. Başka bir eş işbirliği yoktur, çünkü kurallara göre eşe taş verilemez.

## 101 okey

`variant: '101'` ile oynanır. 4 kişi, herkes kendi başına. **101 okeyin resmî bir kural kitabı yoktur**; kurallar masadan masaya ve oyun sitesinden siteye değişir. Aşağıdakiler Türkiye'de en yaygın oynanışa göre seçilmiş varsayılanlardır; ayrılan her ayrıntı ayardır.

Taşlar, gösterge, okey, sahte okey, per ve seri tanımı klasik okeyle aynıdır (yukarıya bakın). Farklar:

- **Dağıtım:** Başlayan oyuncu (dağıtıcıdan sonraki koltuk) **22**, ötekiler **21** taş alır. Deste 20 taştır.
- **Sıra:** Klasikteki gibi: desteden ya da soldaki oyuncunun attığı taştan çek, bir taş at. Başlayan çekmeden başlar.
- **Elini açmak:** Bir oyuncu, çektikten sonra ve taş atmadan önce, elindeki **perleri ve serileri masaya açabilir** (`open`). Açılan grupların puan toplamı en az `openMin` (varsayılan **101**) olmalıdır. Yani 101, yeterli puanı olan eli açmanın şartıdır; bir kere açan oyuncu sonraki turlarda ve aynı turda istediği kadar geçerli grup açabilir (puan şartı aranmaz).
- **Grupların puanı:** Taşın üzerindeki sayı kadar. Joker (okey) yerine geçtiği taşın puanını taşır; sahte okey okey taşının puanını taşır. **1** taşı: düşük seride (1-2-3), perde ve elde kalınca `aceValue` (varsayılan **1**) puan; 12-13-1 serisinin sonundaki 1 `aceHighValue` (varsayılan **14**) puandır. (1'in kaç puan sayıldığı masadan masaya en çok değişen ayrıntıdır.)
- **Seriler:** Aynı renkten ardışık en az 3, en çok 13 taş; 12-13-1 serisi serbest (`aceHigh`), 13-1-2 olmaz. **Perler:** aynı sayıdan farklı renkli 3 ya da 4 taş.
- **Çiftle açmak:** Elinde en az `pairOpenMin` (varsayılan **5**) çift olan, bunları açabilir (`pairOpenMin: 0` ile kapatılır). Çiftle açan oyuncu **yalnızca** başka çiftler açabilir; gruplara taş işleyemez ve herkesin işleyemeyeceği çiftleri masaya bırakır. Çiftle açılmış bir elin bitirilmesi cezaları `pairMultiplier` ile katlar.
- **Atılan taşı alınca açmak zorunluluğu:** Elini henüz açmamış bir oyuncu soldakinin attığı taşı alırsa, **o turda o taşla birlikte elini açmak zorundadır** (`mustOpenWithTaken`, varsayılan açık). Motor, eli o taşla açamayan oyuncuya atığı almayı hiç sunmaz (`drawOptions`). Elini daha önce açmış oyuncu için böyle bir zorunluluk yoktur.
- **İşlemek:** Elini perlerle/serilerle açmış oyuncu, kendi turunda masadaki **herkesin** açtığı gruplara taş **işleyebilir** (`process`): bir serinin başına ya da sonuna uygun taş, 4 taşlı olmayan bir pere eksik renkten taş. Masadaki bir **joker yerine, onun temsil ettiği gerçek taşı koyup jokeri alabilir** (`replace`); alınan joker elde kalır ve hemen başka bir yere işlenebilir ya da yeni grup için kullanılabilir (aynı turda işlemek zorunlu değildir). Seriye joker de işlenebilir. Çiftle açan ya da henüz açmamış oyuncu işleyemez; çiftlere kimse taş işleyemez.
- **Bitirmek:** Eli boşalan oyuncu turu bitirir: ya **son taşı atarak** (elini açmış olması şarttır) ya da bütün taşlarını masaya açıp/işleyerek (elinde taş kalmaz). Son atılan taş okey ise `okeyFinishMultiplier` (varsayılan **×2**) katlar.
- **Deste bitince:** 20 taşlık deste biterse (son taş atıldıktan sonra) tur biter; `deckOutScores` açıkken (varsayılan) herkes elinde kalan taşın cezasını alır, çarpan yoktur.

### Ceza puanı (en az puan kazanır)

101 okeyde puan **ceza puanıdır**; herkes 0'dan başlar, en az ceza alan kazanır. Tur biterken bitiren **0 ceza** alır; ötekiler:

- **Elini hiç açmamış oyuncu:** `notOpenedPenalty` (varsayılan **101**).
- **Elini açmış ama bitiremeyen oyuncu:** elinde kalan taşların puanı toplamı; elinde kalan **okey** `okeyHandPenalty` (varsayılan **101**), sahte okey okeyin taşının puanı.
- Son taşı okey atarak bitirme cezaları **×2**, çiftle açıp bitirme **×2** yapar (ikisi birden ×4); çarpanlar çarpılır.

**Maçın bitişi:** `maxRounds` tur (101 okeyde varsayılan **11**) oynanır ya da `matchEndScore` (varsayılan kapalı) ceza puanına ulaşan olursa maç biter; en az ceza puanı toplamı olan kazanır. En düşük toplamda eşitlik varsa bir tur daha oynanır. Her tur dağıtıcı bir sonraki koltuğa geçer.

### Belirsiz ya da değişen ayrıntılar (hepsi ayar)

| Ayar | Varsayılan | Anlamı |
| --- | --- | --- |
| `openMin` | 101 | Açmak için grupların en az toplam puanı |
| `pairOpenMin` | 5 | Çiftle açmak için çift sayısı (0 = çiftle açılamaz) |
| `mustOpenWithTaken` | açık | Atığı alan, açmamışsa o taşla açmak zorunda |
| `notOpenedPenalty` | 101 | Açmamış oyuncunun cezası |
| `okeyHandPenalty` | 101 | Açmış oyuncunun elinde kalan okey cezası |
| `aceValue` | 1 | 1 taşının düşük seri / per / el puanı |
| `aceHighValue` | 14 | 12-13-1 serisindeki 1'in puanı |
| `deckOutScores` | açık | Deste bitince herkes elindekinin cezasını alır |
| `matchEndScore` | 0 (kapalı) | Bu cezaya ulaşan olursa maç biter |
| `maxRounds` | 11 (101'de) | Maçın tur sayısı |
| `okeyFinishMultiplier`, `pairMultiplier`, `aceHigh`, `allowPairs` | klasikteki gibi | Çarpanlar ve seri kuralı |

Eşli 101 yapılmadı; yalnız genişleme noktası vardır (`teams` bilgisi ve puanlamanın ayrı işlev olması).

## Ayarlar

| Ayar | Varsayılan | Anlamı |
| --- | --- | --- |
| `variant` | `'klasik'` | Oyun türü: `klasik`, `esli` ya da `101` |
| `aceHigh` | açık | 13'ten sonra 1 gelebilir (12-13-1) |
| `allowPairs` | açık | Çift gitmek serbest |
| `startScore` | 20 | Maça başlangıç puanı |
| `lossNormal` | 2 | Her kaybedenin kaybettiği temel puan |
| `okeyFinishMultiplier` | 2 | Okey atarak bitirme çarpanı |
| `pairMultiplier` | 2 | Çift ile bitirme çarpanı |
| `handMultiplier` | 2 | Elden bitirme çarpanı |
| `winnerTakes` | kapalı | Bitiren kaybedilen puanları kazanır |
| `endScore` | 0 | Bu puana inen olursa maç biter (klasik) |
| `teamEndScore` | 0 | Bir takımın toplamı bu puana inerse maç biter (eşli) |
| `maxRounds` | 0 | Tur sınırı (0 = yok) |

## Bilinçli olarak motorda olmayanlar

Masadan masaya değişen ve varsayılan oyunda **uygulanmayan** kurallar; istenirse sonra ayar olarak eklenir:

- Atılan okeyin alınmasının yasaklanması, aldığı taşı hemen geri atma yasağı.
- Bitmeyen elde kalan taşlar için ek ceza (elde okey kalan oyuncuya fazladan puan vb.).
- Gösterge ve okey taşıyla ek bonuslar, eşli 101, 101'de bitirene eksi puan (bonus) ve çevrim içi süre kuralları.
- Zaman sınırı ve bağlantısı kopan oyuncunun yerine hamle: sunucu `botAction` ile bunu yapar (README'de anlatılır).
