# Değişiklik kaydı

## 1.2.0 — 28 Ekim 2026

- Yeni oyun türü **Eşli okey (2'ye 2)**: ayar `variant: 'esli'`. Koltuk 0+2 bir takım, 1+3 öteki takım; eş karşıda oturur. Oynanış klasik okeyle aynıdır (çekme, atma, bitirme, çift gitme; soldaki oyuncunun atığını alma kuralı değişmedi).
- Puanlama takım hesabıyla: bitiren oyuncu ve eşi puan kaybetmez, rakip takımın iki oyuncusu da (aynı çarpanlarla) puan kaybeder. Takım puanı iki oyuncunun puanlarının toplamıdır (başlangıçta 40); bir takım `teamEndScore` (varsayılan 0) puana ya da altına inince maç biter, toplamı yüksek olan takım kazanır.
- Yeni: `match.teamScores`, `match.teams` (takım sıralaması), `match.winnerTeam`, `match.winners`; `view(koltuk)` içinde `team`, `partner`, `teams`. `teamOf`, `partnerOf`, `TEAM_SEATS` dışa açıldı. Eşin eli, klasikteki gizlilik kuralıyla, hiçbir görünümde yer almaz.
- Bilgisayar (kolay, normal, zor) eşli oynar; zor, rakiplerin atıktan aldığı ve elinde tuttuğu taşları ortada olmayan taşlar sayar. Klasik oyun etkilenmez.
- Yeni ayar: `teamEndScore`. 101 okey (`101`) hâlâ oynanamaz.

## 1.1.0 — 28 Ekim 2026

- **Zor bilgisayar güçlendirildi:** artık bir adım ileriye bakıyor; atacağı taşı seçerken, ortada görülmeyen taşlardan hangisinin gelme olasılığı ne kadar ve gelirse eli ne kadar iyileşir diye hesaplıyor. Atıktan almak mı desteden çekmek mi daha iyi, aynı hesapla karar veriyor. Hamle başına süre yaklaşık 150 ms (en kötü durumda 1-3 sn).
- Normal bilgisayar bilerek biraz zayıflatıldı (zaman zaman ikinci en iyi taşı atar) ki seviyeler arasında fark olsun. Kural değişikliği yok.

## 1.0.0 — 28 Ekim 2026

- İlk sürüm: **klasik okey** (4 kişi, herkes kendi başına). 106 taş, gösterge ve okey, sahte okey, 15/14 taşlık dağıtım, desteden ya da soldaki atıktan çekme, taş atma.
- Bitirme denetimi: seri (12-13-1 dahil), per, joker olarak okey, çift gitme. Bitirenin eli serilere ve perlere ayrılarak sonuca yazılır.
- Puanlama: okeyle bitirme, çiftle bitirme, elden bitirme çarpanları; maç (20 puandan başlar, 0'a inen oyunu bitirir); tüm kurallar `settings` ile ayarlanır.
- Çevrim içi oyun için `act`, hamle numarası (`seq`), `expects`, `view`, `botAction`; güvenli karıştırma; kaydet/yükle ve kayıt tutarlılık denetimi.
- Üç seviyede bilgisayar oyuncusu (kolay, normal, zor).
- Eşli okey (`esli`) ve 101 okey (`101`) için yalnızca genişleme noktası var; seçilirse motor "oynanamaz" hatası verir.
