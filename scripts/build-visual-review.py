# 视觉修正后总览图合成脚本（Pillow，可重复运行）
# 用法：python scripts/build-visual-review.py
# 输入：.visual-review/ 下 7 张回归截图；输出：visual-review-v2-contact-sheet.png + visual-review-v2-overview.png
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..', '.visual-review')
OUT_CONTACT = os.path.join(ROOT, 'visual-review-v2-contact-sheet.png')
OUT_OVERVIEW = os.path.join(ROOT, 'visual-review-v2-overview.png')

# (文件名, 场景名, 视口标注, 组别)
SHOTS = [
    ('01-home-hierarchy.png', '首页主次层级', '1440x900', 'desktop'),
    ('02-setup-desktop-two-step.png', '桌面两步开局页', '1440x900', 'desktop'),
    ('04-board-desktop.png', '桌面记录台', '1440x900', 'desktop'),
    ('06-prompt-after-role-switch.png', '身份切换后提示词（狼→预）', '1440x900', 'desktop'),
    ('07-board-dark.png', '深色主题记录台', '1440x900', 'desktop'),
    ('03-setup-mobile-witch.png', '移动端女巫开局页', '390x844', 'mobile'),
    ('05-board-mobile-top.png', '移动端记录台第一屏', '390x844', 'mobile'),
]

DESKTOP_WIDTH = 1440  # 桌面截图保持原始宽度（不缩放）
MOBILE_WIDTH = 500     # 移动截图等比放大到该宽度
TITLE_H = 56
SECTION_H = 46
HEADER_H = 64          # 画布顶部总标题
GAP = 26
PAD = 36
BG = (238, 238, 238)
BAR = (29, 29, 31)
TEXT = (255, 255, 255)
SECTION_BAR = (70, 70, 74)
HEADER_BAR = (90, 84, 217)  # 主色标题条

FONT_CANDIDATES = [
    r'C:\Windows\Fonts\msyh.ttc',
    r'C:\Windows\Fonts\msyhbd.ttc',
    r'C:\Windows\Fonts\simhei.ttf',
    r'C:\Windows\Fonts\simsun.ttc',
    '/System/Library/Fonts/PingFang.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
]

def load_font(size):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()

def fit(img, width):
    if img.width == width:
        return img
    h = round(img.height * width / img.width)
    return img.resize((width, h), Image.LANCZOS)

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

    d_width = len(desktop) * DESKTOP_WIDTH + (len(desktop) - 1) * GAP
    m_width = len(mobile) * MOBILE_WIDTH + (len(mobile) - 1) * GAP
    canvas_w = max(d_width, m_width) + PAD * 2

    d_row_h = int(DESKTOP_WIDTH * (900 / 1440) + TITLE_H)
    m_row_h = int(MOBILE_WIDTH * (844 / 390) + TITLE_H)
    canvas_h = int(PAD + HEADER_H + GAP + SECTION_H + GAP + d_row_h + GAP + SECTION_H + GAP + m_row_h + GAP + PAD)

    canvas = Image.new('RGB', (canvas_w, canvas_h), BG)
    draw = ImageDraw.Draw(canvas)
    y = PAD

    # 顶部总标题：视觉修正后
    draw.rectangle([PAD, y, canvas_w - PAD, y + HEADER_H], fill=HEADER_BAR)
    draw.text((PAD + 16, y + (HEADER_H - font_header.size) // 2 - 2), '视觉修正后 · 回归验收截图', font=font_header, fill=TEXT)
    y += HEADER_H + GAP

    # 桌面分区
    draw.rectangle([PAD, y, canvas_w - PAD, y + SECTION_H], fill=SECTION_BAR)
    draw.text((PAD + 14, y + (SECTION_H - font_section.size) // 2 - 2), '桌面端 1440×900', font=font_section, fill=TEXT)
    y += SECTION_H + GAP
    for i, img in enumerate(desktop):
        x = PAD + i * (DESKTOP_WIDTH + GAP)
        num = SHOTS[i][0][:2]
        name, vp = meta[num]
        draw_title(draw, x, y, DESKTOP_WIDTH, TITLE_H, f'{num}  {name}  {vp}', BAR, TEXT, font)
        canvas.paste(img, (x, y + TITLE_H))
    y += d_row_h + GAP

    # 移动分区
    draw.rectangle([PAD, y, canvas_w - PAD, y + SECTION_H], fill=SECTION_BAR)
    draw.text((PAD + 14, y + (SECTION_H - font_section.size) // 2 - 2), '移动端 390×844', font=font_section, fill=TEXT)
    y += SECTION_H + GAP
    for i, img in enumerate(mobile):
        x = PAD + i * (MOBILE_WIDTH + GAP)
        num = SHOTS[len(desktop) + i][0][:2]
        name, vp = meta[num]
        draw_title(draw, x, y, MOBILE_WIDTH, TITLE_H, f'{num}  {name}  {vp}', BAR, TEXT, font)
        canvas.paste(img, (x, y + TITLE_H))
    y += m_row_h + GAP

    canvas.save(OUT_CONTACT)
    print(f'contact-sheet 已生成: {OUT_CONTACT} ({canvas.width}x{canvas.height})')

    ov_w = 1600
    ov_h = round(canvas.height * ov_w / canvas.width)
    canvas.resize((ov_w, ov_h), Image.LANCZOS).save(OUT_OVERVIEW)
    print(f'overview 已生成: {OUT_OVERVIEW} ({ov_w}x{ov_h})')

if __name__ == '__main__':
    build()
