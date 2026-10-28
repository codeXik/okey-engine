# Değişiklik kaydı

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
