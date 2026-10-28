# Okey kural belgesi (28 Ekim 2026)

Kaynaklar: Türkiye'de masalarda ve çevrim içi salonlarda en yaygın oynanan klasik okey kuralları; proje sahibinin kararlarıyla birleştirildi. Resmî kural kitabı yoktur; ayrıntılar masadan masaya değiştiği için **masadan masaya değişen her kural ayardan seçilir** ve varsayılanlar en yaygın oynanışa göre konmuştur. Ayarlar `src/settings.js` içindedir.

## Sürümler ve oyun türleri

| Tür | Ayar (`variant`) | Durum |
| --- | --- | --- |
| Klasik okey (4 kişi, herkes kendi başına) | `klasik` | **Sürüm 1: hazır** |
| Eşli okey (2'ye 2; 0+2 ile 1+3 eş) | `esli` | Sürüm 2: yapılmadı, yalnızca genişleme noktası var |
| 101 okey | `101` | Sürüm 3: yapılmadı, yalnızca genişleme noktası var |

Hazır olmayan bir tür seçilirse motor hata verir (`Variant not playable yet`). Üç türün ortak parçaları (taşlar, per/seri denetimi, çözücü, kayıt, bilgisayarın el değerlendirmesi) ayrı modüllerdedir; yeni tür bunların üstüne kural ekler.

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

## Ayarlar

| Ayar | Varsayılan | Anlamı |
| --- | --- | --- |
| `variant` | `'klasik'` | Oyun türü (`esli` ve `101` henüz oynanamaz) |
| `aceHigh` | açık | 13'ten sonra 1 gelebilir (12-13-1) |
| `allowPairs` | açık | Çift gitmek serbest |
| `startScore` | 20 | Maça başlangıç puanı |
| `lossNormal` | 2 | Her kaybedenin kaybettiği temel puan |
| `okeyFinishMultiplier` | 2 | Okey atarak bitirme çarpanı |
| `pairMultiplier` | 2 | Çift ile bitirme çarpanı |
| `handMultiplier` | 2 | Elden bitirme çarpanı |
| `winnerTakes` | kapalı | Bitiren kaybedilen puanları kazanır |
| `endScore` | 0 | Bu puana inen olursa maç biter |
| `maxRounds` | 0 | Tur sınırı (0 = yok) |

## Bilinçli olarak motorda olmayanlar

Masadan masaya değişen ve varsayılan oyunda **uygulanmayan** kurallar; istenirse sonra ayar olarak eklenir:

- Atılan okeyin alınmasının yasaklanması, aldığı taşı hemen geri atma yasağı.
- Bitmeyen elde kalan taşlar için ek ceza (elde okey kalan oyuncuya fazladan puan vb.).
- Gösterge ve okey taşıyla ek bonuslar, "açma" (101'e özgü) ve eşli türün puanlaması: bunlar sürüm 2 ve 3'tedir.
- Zaman sınırı ve bağlantısı kopan oyuncunun yerine hamle: sunucu `botAction` ile bunu yapar (README'de anlatılır).
