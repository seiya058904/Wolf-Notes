# 最终视觉复审总览图合成（Pillow）
# 用法：python scripts/build-visual-review-final.py
# 输入：.visual-review/ 下 01..09 最终复审截图；输出 visual-review-v3-contact-sheet.png + overview
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..', '.visual-review')
OUT_CONTACT = os.path.join(ROOT, 'visual-review-v3-contact-sheet.png')
OUT_OVERVIEW = os.path.join(ROOT, 'visual-review-v3-overview.png')

SHOTS = [
    ('01-v3-setup-step1-desktop.png', '开局设置 第1步·基础信息', '1440x900', 'desktop'),
    ('02-v3-setup-step2-desktop.png', '开局设置 第2步·已知信息', '1440x900', 'desktop'),
    ('03-v3-board-light-desktop.png', '记录台·浅色·快捷输入展开', '1440x900', 'desktop'),
    ('04-v3-dark-prompt-desktop.png', '深色 AI 提示词弹窗', '1440x900', 'desktop'),
    ('05-v3-dark-template-menu.png', '深色快捷输入菜单', '1440x900', 'desktop'),
    ('09-v3-prompt-after-role-switch.png', '身份切换后提示词（狼→预）', '1440x900', 'desktop'),
    ('06-v3-board-mobile-top.png', '移动端记录台第一屏', '390x844', 'mobile'),
    ('07-v3-board-mobile-notes.png', '移动端记录台下部·非公开信息', '390x844', 'mobile'),
    ('08-v3-setup-witch-mobile.png', '移动端女巫开局·第2步', '390x844', 'mobile'),
]

DESKTOP_WIDTH = 1440
MOBILE_WIDTH = 500
TITLE_H = 56
SECTION_H = 46
HEADER_H = 64
GAP = 26
PAD = 36
BG = (238, 238, 238)
BAR = (29, 29, 31)
TEXT = (255, 255, 255)
SECTION_BAR = (70, 70, 74)
HEADER_BAR = (90, 84, 217)

FONT_CANDIDATES = [
    r'C:\Windows\Fonts\msyh.ttc', r'C:\Windows\Fonts\msyhbd.ttc', r'C:\Windows\Fonts\simhei.ttf',
    r'C:\Windows\Fonts\simsun.ttc', '/System/Library/Fonts/PingFang.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
]

def load_font(size):
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()

def fit(img, width):
    if img.width == width:
        return img
    return img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)

def draw_title(draw, x, y, w, h, text, bg, fg, font):
    draw.rectangle([x, y, x + w, y + h], fill=bg)
    draw.text((x + 14, y + (h - font.size) // 2 - 2), text, font=font, fill=fg)

def build():
    font = load_font(26)
    font_section = load_font(28)
    font_header = load_font(34)

    desktop = [fit(Image.open(os.path.join(ROOT, f)).convert('RGB'), DESKTOP_WIDTH) for f, _, _, g in SHOTS if g == 'desktop']
    mobile = [fit(Image.open(os.path.join(ROOT, f)).convert('RGB'), MOBILE_WIDTH) for f, _, _, g in SHOTS if g == 'mobile']
    meta = {f[:2]: (name, vp) for f, name, vp, g in SHOTS}

    d_cols = 3
    d_rows = (len(desktop) + d_cols - 1) // d_cols  # 2
    m_cols = 3
    m_rows = (len(mobile) + m_cols - 1) // m_cols    # 1
    d_width = d_cols * DESKTOP_WIDTH + (d_cols - 1) * GAP
    m_width = m_cols * MOBILE_WIDTH + (m_cols - 1) * GAP
    canvas_w = max(d_width, m_width) + PAD * 2
    d_row_h = int(DESKTOP_WIDTH * (900 / 1440) + TITLE_H)
    m_row_h = int(MOBILE_WIDTH * (844 / 390) + TITLE_H)
    canvas_h = int(PAD + HEADER_H + GAP + SECTION_H + GAP + d_rows * (d_row_h + GAP) + SECTION_H + GAP + m_rows * (m_row_h + GAP) + PAD)

    canvas = Image.new('RGB', (canvas_w, canvas_h), BG)
    draw = ImageDraw.Draw(canvas)
    y = PAD
    draw.rectangle([PAD, y, canvas_w - PAD, y + HEADER_H], fill=HEADER_BAR)
    draw.text((PAD + 16, y + (HEADER_H - font_header.size) // 2 - 2), '最终视觉复审 · v3', font=font_header, fill=TEXT)
    y += HEADER_H + GAP

    draw.rectangle([PAD, y, canvas_w - PAD, y + SECTION_H], fill=SECTION_BAR)
    draw.text((PAD + 14, y + (SECTION_H - font_section.size) // 2 - 2), '桌面端 1440×900', font=font_section, fill=TEXT)
    y += SECTION_H + GAP
    for i, img in enumerate(desktop):
        col = i % d_cols
        row = i // d_cols
        x = PAD + col * (DESKTOP_WIDTH + GAP)
        ty = y + row * (d_row_h + GAP)
        num = SHOTS[i][0][:2]
        name, vp = meta[num]
        draw_title(draw, x, ty, DESKTOP_WIDTH, TITLE_H, f'{num}  {name}  {vp}', BAR, TEXT, font)
        canvas.paste(img, (x, ty + TITLE_H))
    y += d_rows * (d_row_h + GAP)

    draw.rectangle([PAD, y, canvas_w - PAD, y + SECTION_H], fill=SECTION_BAR)
    draw.text((PAD + 14, y + (SECTION_H - font_section.size) // 2 - 2), '移动端 390×844', font=font_section, fill=TEXT)
    y += SECTION_H + GAP
    for i, img in enumerate(mobile):
        col = i % m_cols
        x = PAD + col * (MOBILE_WIDTH + GAP)
        ty = y
        num = SHOTS[len(desktop) + i][0][:2]
        name, vp = meta[num]
        draw_title(draw, x, ty, MOBILE_WIDTH, TITLE_H, f'{num}  {name}  {vp}', BAR, TEXT, font)
        canvas.paste(img, (x, ty + TITLE_H))
    y += m_rows * (m_row_h + GAP)

    canvas.save(OUT_CONTACT)
    print(f'contact-sheet: {OUT_CONTACT} ({canvas.width}x{canvas.height})')
    ov_w = 1600
    ov_h = round(canvas.height * ov_w / canvas.width)
    canvas.resize((ov_w, ov_h), Image.LANCZOS).save(OUT_OVERVIEW)
    print(f'overview: {OUT_OVERVIEW} ({ov_w}x{ov_h})')

if __name__ == '__main__':
    build()
