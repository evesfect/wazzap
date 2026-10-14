//! Okunmamış sayısı için küçük ikonlar: görev çubuğu rozeti ve tepsi noktası.
//! Dış kütüphane kullanmadan RGBA piksellerine çiziyoruz.

const CHALK: [u8; 3] = [0xEC, 0x25, 0x00];

/// 3×5 piksel rakamlar; her satır 3 bit.
#[cfg_attr(not(windows), allow(dead_code))]
fn glyph(c: char) -> [u8; 5] {
    match c {
        '0' => [0b111, 0b101, 0b101, 0b101, 0b111],
        '1' => [0b010, 0b110, 0b010, 0b010, 0b111],
        '2' => [0b111, 0b001, 0b111, 0b100, 0b111],
        '3' => [0b111, 0b001, 0b111, 0b001, 0b111],
        '4' => [0b101, 0b101, 0b111, 0b001, 0b001],
        '5' => [0b111, 0b100, 0b111, 0b001, 0b111],
        '6' => [0b111, 0b100, 0b111, 0b101, 0b111],
        '7' => [0b111, 0b001, 0b001, 0b010, 0b010],
        '8' => [0b111, 0b101, 0b111, 0b101, 0b111],
        '9' => [0b111, 0b101, 0b111, 0b001, 0b111],
        '+' => [0b000, 0b010, 0b111, 0b010, 0b000],
        _ => [0; 5],
    }
}

fn blend(px: &mut [u8], rgb: [u8; 3], a: f32) {
    let a = a.clamp(0.0, 1.0);
    if a <= 0.0 {
        return;
    }
    let da = px[3] as f32 / 255.0;
    let oa = a + da * (1.0 - a);
    for i in 0..3 {
        let src = rgb[i] as f32;
        let dst = px[i] as f32;
        let v = if oa > 0.0 { (src * a + dst * da * (1.0 - a)) / oa } else { 0.0 };
        px[i] = v.round() as u8;
    }
    px[3] = (oa * 255.0).round() as u8;
}

fn circle(buf: &mut [u8], size: u32, cx: f32, cy: f32, r: f32, rgb: [u8; 3]) {
    for y in 0..size {
        for x in 0..size {
            // 4×4 alt örnekleme ile yumuşak kenar
            let mut cov = 0.0;
            for sy in 0..4 {
                for sx in 0..4 {
                    let px = x as f32 + (sx as f32 + 0.5) / 4.0;
                    let py = y as f32 + (sy as f32 + 0.5) / 4.0;
                    if (px - cx).powi(2) + (py - cy).powi(2) <= r * r {
                        cov += 1.0;
                    }
                }
            }
            if cov > 0.0 {
                let i = ((y * size + x) * 4) as usize;
                blend(&mut buf[i..i + 4], rgb, cov / 16.0);
            }
        }
    }
}

/// Görev çubuğu için 32×32 rozet: turuncu daire, beyaz sayı.
#[cfg_attr(not(windows), allow(dead_code))]
pub fn overlay(count: u32) -> (Vec<u8>, u32, u32) {
    let size = 32u32;
    let mut buf = vec![0u8; (size * size * 4) as usize];
    circle(&mut buf, size, 16.0, 16.0, 15.5, CHALK);
    let text = if count > 9 { "9+".to_string() } else { count.to_string() };
    let scale: u32 = if text.len() == 1 { 4 } else { 3 };
    let gw = 3 * scale;
    let gh = 5 * scale;
    let gap = scale;
    let total_w = gw * text.len() as u32 + gap * (text.len() as u32 - 1);
    let x0 = (size - total_w) / 2;
    let y0 = (size - gh) / 2;
    for (n, c) in text.chars().enumerate() {
        let g = glyph(c);
        let gx = x0 + n as u32 * (gw + gap);
        for (row, bits) in g.iter().enumerate() {
            for col in 0..3u32 {
                if bits & (0b100 >> col) != 0 {
                    for dy in 0..scale {
                        for dx in 0..scale {
                            let x = gx + col * scale + dx;
                            let y = y0 + row as u32 * scale + dy;
                            let i = ((y * size + x) * 4) as usize;
                            buf[i..i + 4].copy_from_slice(&[255, 255, 255, 255]);
                        }
                    }
                }
            }
        }
    }
    (buf, size, size)
}

/// Tepsi ikonuna sağ üstte turuncu nokta ekler.
pub fn with_dot(rgba: &[u8], w: u32, h: u32) -> Vec<u8> {
    let mut buf = rgba.to_vec();
    let r = w as f32 * 0.22;
    let cx = w as f32 - r - 0.5;
    let cy = r + 0.5;
    // ince siyah halka, sonra turuncu nokta: koyu ve açık tepsi zemininde okunur
    circle(&mut buf, w.min(h), cx, cy, r + w as f32 * 0.06, [0, 0, 0]);
    circle(&mut buf, w.min(h), cx, cy, r, CHALK);
    buf
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn overlay_sizes() {
        for n in [1, 7, 9, 10, 250] {
            let (b, w, h) = overlay(n);
            assert_eq!(b.len() as u32, w * h * 4);
        }
    }

    #[test]
    fn dot_keeps_size() {
        let base = vec![10u8; 32 * 32 * 4];
        assert_eq!(with_dot(&base, 32, 32).len(), base.len());
    }
}
