"""Renders the intro film: stills (Ken Burns), clips, animated charts, burned-in subtitles,
cut on the voice-over. Run through build.sh.
Usage: render.py <workdir> <voice.mp3> <out.mp4> [--preview SECONDS...]"""
import csv, difflib, json, math, os, re, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

Image.MAX_IMAGE_PIXELS = None
W, H, FPS = 1920, 1080, 25
LEAD, TAIL, XF = 1.2, 4.5, 0.6  # black before the voice, Earth after it, crossfade
BG = (6, 18, 27)  # screen --bg, the film fades into the "today" screen
FG = (243, 235, 221)
MUTED = (147, 169, 181)
ACCENT = (240, 83, 58)
OCEAN = (60, 195, 211)
STRIPES = ['#08306b', '#08519c', '#2171b5', '#4292c6', '#6baed6', '#9ecae1', '#c6dbef',
           '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#99000d']

WORK, VOICE, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
PREVIEW = [float(x) for x in sys.argv[sys.argv.index('--preview') + 1:]] if '--preview' in sys.argv else None
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
FFMPEG = os.environ.get('FFMPEG', 'ffmpeg')
M = lambda f: os.path.join(WORK, 'media', f)
F = lambda f, s: ImageFont.truetype(os.path.join(WORK, 'fonts', f + '.ttf'), s)

# ---------- text: the subtitle column of docs/film/voix-off.md ----------
doc = open(os.path.join(REPO, 'docs/film/voix-off.md'), encoding='utf-8').read()
PARAS = [re.sub(r'(\d) (°C|000)', '\\1\u00a0\\2', m.group(2).strip()) for m in re.finditer(r'^\| (\d\d)\s+\| (.+?)\s+\|[^|]*\|$', doc, re.M)]
assert len(PARAS) == 15, len(PARAS)

# ---------- alignment: subtitle words ↔ whisper words ----------
norm = lambda w: re.sub(r"[^\w]", '', w.lower().replace('₂', '2').replace('°c', 'degres')
                        .replace('é', 'e').replace('è', 'e').replace('ê', 'e').replace('à', 'a'))
whisper = json.load(open(os.path.join(WORK, 'work/words.json')))
wt = [norm(x['w']) for x in whisper]
tokens = []  # (paragraph, word)
for i, p in enumerate(PARAS):
    tokens += [(i, w) for w in p.split(' ')]  # keeps no-break spaces (« 2 °C ») inside a word
st = [norm(w) for _, w in tokens]
start = [None] * len(tokens); end = [None] * len(tokens)
for a, b, n in difflib.SequenceMatcher(None, st, wt, autojunk=False).get_matching_blocks():
    for k in range(n):
        start[a + k] = whisper[b + k]['s']; end[a + k] = whisper[b + k]['e']
# Unmatched words: interpolate between matched neighbours.
known = [i for i in range(len(tokens)) if start[i] is not None]
for i in range(len(tokens)):
    if start[i] is None:
        lo = max([k for k in known if k < i], default=None); hi = min([k for k in known if k > i], default=None)
        t0 = end[lo] if lo is not None else 0.0; t1 = start[hi] if hi is not None else whisper[-1]['e']
        n0 = lo if lo is not None else -1; n1 = hi if hi is not None else len(tokens)
        f0 = (i - n0 - 1) / (n1 - n0 - 1); f1 = (i - n0) / (n1 - n0 - 1)
        start[i] = t0 + (t1 - t0) * f0; end[i] = t0 + (t1 - t0) * f1
start = [s + LEAD for s in start]; end = [e + LEAD for e in end]
print('matched', len(known), '/', len(tokens), 'words')

AUDIO_END = LEAD + whisper[-1]['e']
DURATION = AUDIO_END + TAIL
para_first = [next(k for k, (p, _) in enumerate(tokens) if p == i) for i in range(15)]
PARA_T = [0.0] + [start[k] - 0.25 for k in para_first[1:]]


def at(para, phrase):
    """Time the phrase (subtitle words) starts within paragraph `para`."""
    ws = [norm(w) for w in phrase.split()]
    for k in range(para_first[para], len(tokens)):
        if tokens[k][0] == para and st[k:k + len(ws)] == ws:
            return start[k] - 0.15
    raise KeyError((para, phrase))


# ---------- subtitles: one cue per sentence, split at a comma if longer than two lines ----------
SUB_FONT = F('onest-600', 50)
SUB_MAX_W = 1340


def width(font, s):
    return sum(font.getlength(seg) if not sub else font.getlength('2') * 0.62
               for seg, sub in rich(s))


def rich(s):
    """'CO₂' → [('CO', False), ('2', True)]: the subscript is drawn by hand (missing glyph)."""
    out = []
    for part in re.split('(₂)', s):
        if part == '₂': out.append(('2', True))
        elif part: out.append((part, False))
    return out


def wrap(font, words, max_w):
    """One line if it fits, else the most balanced two lines; None if two lines are not enough."""
    if width(font, ' '.join(words)) <= max_w: return [words]
    best = None
    for j in range(1, len(words)):
        w = max(width(font, ' '.join(words[:j])), width(font, ' '.join(words[j:])))
        cost = w - (220 if words[j - 1].endswith(',') else 0)  # prefer breaking after a comma
        if w <= max_w and (best is None or cost < best[0]): best = (cost, j)
    return None if best is None else [words[:best[1]], words[best[1]:]]


cues = []  # (t0, t1, [line, line])
for i in range(15):
    idx = [k for k, (p, _) in enumerate(tokens) if p == i]
    sentences, cur = [], []
    for k in idx:
        cur.append(k)
        if re.search(r'[.!?]$', tokens[k][1]): sentences.append(cur); cur = []
    if cur: sentences.append(cur)
    for sent in sentences:
        words = [tokens[k][1] for k in sent]
        if wrap(SUB_FONT, words, SUB_MAX_W) is None:  # split at the comma nearest the middle
            commas = [j for j, w in enumerate(words[:-1]) if w.endswith(',')]
            mid = min(commas, key=lambda j: abs(j - len(words) / 2))
            parts = [sent[:mid + 1], sent[mid + 1:]]
        else:
            parts = [sent]
        for part in parts:
            ws = [tokens[k][1] for k in part]
            lines = [' '.join(l) for l in wrap(SUB_FONT, ws, SUB_MAX_W)]
            cues.append([start[part[0]] - 0.12, end[part[-1]] + 0.35, lines])
for a, b in zip(cues, cues[1:]):  # no gap flicker between close cues
    if b[0] - a[1] < 0.5: a[1] = b[0]
    a[1] = min(a[1], b[0])


# ---------- drawing helpers ----------
def draw_rich(d, xy, s, font, fill):
    x, y = xy
    for seg, sub in rich(s):
        if sub:
            f2 = font.font_variant(size=int(font.size * 0.62))
            d.text((x, y + font.size * 0.42), seg, font=f2, fill=fill); x += f2.getlength(seg)
        else:
            d.text((x, y), seg, font=font, fill=fill); x += font.getlength(seg)


def subtitle_layer(lines):
    img = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(img)
    lh = 64; pad_x, pad_y = 34, 16
    y0 = H - 92 - lh * len(lines)
    for j, line in enumerate(lines):
        w = width(SUB_FONT, line); x = (W - w) / 2; y = y0 + j * lh
        d.rounded_rectangle((x - pad_x, y - pad_y + 4, x + w + pad_x, y + lh - pad_y + 14), 14,
                            fill=(6, 18, 27, 200))
    for j, line in enumerate(lines):
        w = width(SUB_FONT, line)
        draw_rich(d, ((W - w) / 2, y0 + j * lh), line, SUB_FONT, FG)
    return img


def shadowed_text(img, xy, text, font, fill, blur=10, anchor='la', shadow=200):
    sh = Image.new('RGBA', img.size)
    ImageDraw.Draw(sh).text(xy, text, font=font, fill=(0, 0, 0, shadow), anchor=anchor)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    img.alpha_composite(sh); ImageDraw.Draw(img).text(xy, text, font=font, fill=fill, anchor=anchor)


YEAR_FONT, LABEL_FONT = F('unbounded-800', 104), F('onest-600', 38)


def badge_layer(year, label):
    img = Image.new('RGBA', (W, H))
    if year: shadowed_text(img, (88, 64), year, YEAR_FONT, FG)
    if label: shadowed_text(img, (92, 64 + (150 if year else 0)), label, LABEL_FONT, FG, 6)
    return img


def vignette():
    v = Image.new('L', (W, H), 0); d = ImageDraw.Draw(v)
    for y in range(H):  # bottom and top gradients keep text readable on bright stills
        a = max(0, (y - H * 0.55) / (H * 0.45)) ** 1.6 * 170 + max(0, (H * 0.3 - y) / (H * 0.3)) ** 2 * 110
        d.line((0, y, W, y), fill=int(a))
    v = Image.merge('RGBA', (Image.new('L', (W, H), 0),) * 3 + (v,))
    return v


VIGNETTE = vignette()


def hexrgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def stripe_color(t):  # mirrors temperatureColor in apps/screen/src/stripes.ts
    x = min(1, max(0, (t + 1) / 3.5))
    return hexrgb(STRIPES[round(x * (len(STRIPES) - 1))])


# ---------- data ----------
gis = {}
for row in csv.reader(open(os.path.join(WORK, 'data/gistemp.csv'))):
    if row and row[0].isdigit() and row[13] != '***': gis[int(row[0])] = float(row[13])
base = sum(gis[y] for y in range(1880, 1901)) / 21  # pre-industrial proxy, like the game's anomaly
ANOM = {y: v - base for y, v in gis.items()}
keeling = [(float(r[2]), float(r[4])) for r in csv.reader(open(os.path.join(WORK, 'data/co2_mm_mlo.csv')))
           if r and r[0][:1].isdigit() and float(r[4]) > 0]
emis = sorted((int(r[2]), float(r[3]) / 1e9) for r in csv.reader(open(os.path.join(WORK, 'data/co2.csv')))
              if r[0] == 'World' and int(r[2]) >= 1900)


# ---------- visuals ----------
class Still:
    def __init__(self, f, z=(1.0, 1.12), c0=(0.5, 0.5), c1=None, tint=None):
        self.f, self.z, self.c0, self.c1 = f, z, c0, c1 or c0
        self.im = None

    def load(self):
        im = Image.open(M(self.f)).convert('RGB')
        zmax = max(self.z)
        s = max(W * zmax / im.width, H * zmax / im.height)
        self.im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)

    def frame(self, u, dur):
        if self.im is None: self.load()
        p = min(1, max(0, u / dur)); p = p * p * (3 - 2 * p) * 0.6 + p * 0.4  # gentle ease
        z = self.z[0] + (self.z[1] - self.z[0]) * p
        zmax = max(self.z)
        bw, bh = W * zmax / z, H * zmax / z  # visible box in source px (source covers W*zmax × H*zmax)
        bw = min(bw, self.im.width); bh = min(bh, self.im.height)
        cx = self.c0[0] + (self.c1[0] - self.c0[0]) * p; cy = self.c0[1] + (self.c1[1] - self.c0[1]) * p
        x0 = min(max(cx * self.im.width - bw / 2, 0), self.im.width - bw)
        y0 = min(max(cy * self.im.height - bh / 2, 0), self.im.height - bh)
        sx, sy = bw / W, bh / H
        return self.im.transform((W, H), Image.AFFINE, (sx, 0, x0, 0, sy, y0), Image.BILINEAR)

    def release(self): self.im = None


class Clip:
    def __init__(self, f, ss=0.0, speed=1.0):
        self.f, self.ss, self.speed, self.proc, self.last = f, ss, speed, None, None

    def frame(self, u, dur):
        if self.proc is None:
            vf = (f'setpts=PTS/{self.speed},fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase,'
                  f'crop={W}:{H}')
            self.proc = subprocess.Popen([FFMPEG, '-v', 'error', '-ss', str(self.ss), '-i', self.f, '-an',
                                          '-vf', vf, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                                         stdout=subprocess.PIPE)
        buf = self.proc.stdout.read(W * H * 3)
        if len(buf) == W * H * 3: self.last = Image.frombytes('RGB', (W, H), buf)
        return self.last.copy()

    def release(self):
        if self.proc: self.proc.kill(); self.proc = None


class Chart:
    """Line drawn left to right over the shot. series: [(x, y)]; marks: [(x, text)]."""

    def __init__(self, series, xr, yr, title, unit, color, marks=(), ticks_x=(), ticks_y=(), draw_s=0.75,
                 caption=None):
        self.s, self.xr, self.yr, self.title, self.unit, self.color = series, xr, yr, title, unit, color
        self.marks, self.tx, self.ty, self.draw_s, self.caption = marks, ticks_x, ticks_y, draw_s, caption
        self.box = (190, 250, W - 170, H - 250)
        self.base = None

    def xy(self, x, y):
        l, t, r, b = self.box
        return (l + (x - self.xr[0]) / (self.xr[1] - self.xr[0]) * (r - l),
                b - (y - self.yr[0]) / (self.yr[1] - self.yr[0]) * (b - t))

    def make_base(self):
        img = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(img)
        l, t, r, b = self.box
        tf, af = F('onest-600', 34), F('onest-500', 30)
        draw_rich(d, (l, 96), self.title, F('unbounded-700', 50), FG)
        if self.unit: draw_rich(d, (l, 168), self.unit, tf, MUTED)
        for y in self.ty:
            yy = self.xy(self.xr[0], y)[1]
            d.line((l, yy, r, yy), fill=(30, 52, 66), width=2)
            d.text((l - 20, yy), f'{y:g}', font=af, fill=MUTED, anchor='rm')
        for x in self.tx:
            xx = self.xy(x, self.yr[0])[0]
            d.text((xx, b + 26), str(x), font=af, fill=MUTED, anchor='mt')
        self.base = img

    def frame(self, u, dur):
        if self.base is None: self.make_base()
        img = self.base.copy(); d = ImageDraw.Draw(img)
        p = min(1, u / (dur * self.draw_s)); p = 1 - (1 - p) ** 2
        xmax = self.xr[0] + (self.s[-1][0] - self.xr[0]) * p
        pts = [self.xy(x, y) for x, y in self.s if x <= xmax]
        if len(pts) > 1: d.line(pts, fill=self.color, width=6, joint='curve')
        if pts:
            x, y = pts[-1]; d.ellipse((x - 11, y - 11, x + 11, y + 11), fill=self.color)
            last = [v for v in self.s if v[0] <= xmax][-1]
            d.text((x + 22, y - 6), f'{last[1]:.0f}', font=F('unbounded-700', 40), fill=FG, anchor='ls')
        mf = F('onest-600', 32)
        for mx, text in self.marks:
            if mx <= xmax:
                xx = self.xy(mx, self.yr[0])[0]
                yy = min(self.xy(x, y)[1] for x, y in self.s if abs(x - mx) < 1)
                d.line((xx, yy - 26, xx, yy - 90), fill=FG, width=3)
                d.text((xx, yy - 100), text, font=mf, fill=FG, anchor='md')
        if self.caption and p >= 1:
            d.text((self.box[2], 120), self.caption, font=F('onest-600', 34), fill=MUTED, anchor='rt')
        return img

    def release(self): pass


class StripesCard:
    """Warming stripes revealed year by year, with an optional big caption."""

    def __init__(self, y0, y1, title=None, big=None, draw_s=0.7):
        self.y0, self.y1, self.title, self.big, self.draw_s = y0, y1, title, big, draw_s

    def frame(self, u, dur):
        img = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(img)
        years = list(range(self.y0, self.y1 + 1))
        p = min(1, u / (dur * self.draw_s)); n = max(1, round(len(years) * p))
        sw = W / len(years)
        for j, y in enumerate(years[:n]):
            d.rectangle((j * sw, 0, (j + 1) * sw + 1, H), fill=stripe_color(ANOM[y]))
        lab = F('unbounded-700', 44)
        d.text((60, H - 60), str(self.y0), font=lab, fill=FG, anchor='ls')
        if n == len(years): d.text((W - 60, H - 60), str(self.y1), font=lab, fill=FG, anchor='rs')
        if self.big and p >= 1:
            a = min(1, (u - dur * self.draw_s) / 0.5)
            ov = Image.new('RGBA', (W, H)); od = ImageDraw.Draw(ov)
            od.rounded_rectangle((W / 2 - 560, H / 2 - 190, W / 2 + 560, H / 2 + 150), 36,
                                 fill=BG + (int(225 * a),))
            od.text((W / 2, H / 2 - 20), self.big, font=F('unbounded-800', 200), fill=FG + (int(255 * a),),
                    anchor='mm')
            img = Image.alpha_composite(img.convert('RGBA'), ov).convert('RGB')
        return img

    def release(self): pass


class Card:
    """Logo or title on the background colour."""

    def __init__(self, logo=None, title=None, sub=None):
        self.logo, self.title, self.sub, self.img = logo, title, sub, None

    def frame(self, u, dur):
        if self.img is None:
            img = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(img)
            if self.logo:
                lg = Image.open(M(self.logo)).convert('RGBA'); lg.thumbnail((860, 480))
                box = Image.new('RGB', (lg.width + 120, lg.height + 120), (255, 255, 255))
                box.paste(lg, (60, 60), lg)
                img.paste(box, ((W - box.width) // 2, (H - box.height) // 2 - 10))
            if self.title:
                d.text((W / 2, H / 2 - 60), self.title, font=F('unbounded-800', 92), fill=FG, anchor='mm')
            if self.sub:
                d.text((W / 2, H / 2 + 60), self.sub, font=F('onest-600', 48), fill=MUTED, anchor='mm')
            self.img = img
        z = 1 + 0.04 * u / dur  # slow push-in
        return self.img.resize((round(W * z), round(H * z)), Image.BILINEAR).crop(
            (round((W * z - W) / 2), round((H * z - H) / 2), round((W * z - W) / 2) + W, round((H * z - H) / 2) + H))

    def release(self): self.img = None


VIDEOS = os.path.join(REPO, 'apps/screen/public/videos')

# ---------- the edit: (time, visual), badges (time, year, label) ----------
P = PARA_T
shots = [
    (0.0, Still('01a.jpg', (1.18, 1.04), (0.45, 0.42))),  # Pittsburgh mills
    (at(0, 'Les usines'), Still('01c.jpg', (1.08, 1.22), (0.5, 0.42))),  # Homestead works (Pennell)
    (at(0, 'les trains'), Still('01b.jpg', (1.05, 1.16), (0.5, 0.55), (0.42, 0.5))),  # coal train
    (P[1], Still('02a.jpg', (1.04, 1.18), (0.6, 0.45), (0.45, 0.45))),  # Ford line 1913
    (at(1, 'Le pétrole'), Still('02b.jpg', (1.0, 1.12), (0.5, 0.7), (0.5, 0.3))),  # Lucas gusher
    (at(1, 'Et dans'), Still('02c.jpg', (1.12, 1.0), (0.5, 0.5))),  # Model T line, smoke
    (P[2], Still('03b.jpg', (1.04, 1.14), (0.4, 0.5), (0.6, 0.5))),  # coal mine
    (at(2, 'En brûlant'), StripesCard(1880, 1938, draw_s=0.85)),
    (P[3], Still('04a.jpg', (1.04, 1.16), (0.5, 0.5))),  # supermarket 1955
    (at(3, 'les avions'), Still('04b.jpg', (1.14, 1.02), (0.55, 0.5))),  # Pan Am 707s
    (at(3, 'En quelques'), Still('04c.jpg', (1.02, 1.14), (0.5, 0.6))),  # traffic jam
    (P[4], Still('05a.jpg', (1.02, 1.14), (0.5, 0.45), (0.55, 0.5))),  # Mauna Loa observatory
    (at(4, 'un scientifique'), Chart(keeling, (1958, 2027), (310, 435), 'CO₂ dans l’air à Mauna Loa',
                                     'parties par million (ppm), mesures mensuelles NOAA', ACCENT,
                                     ticks_x=(1960, 1980, 2000, 2020), ticks_y=(320, 360, 400), draw_s=0.85)),
    (P[5], Card(title='Les limites à la croissance', sub='Rapport Meadows · Club de Rome · 1972')),
    (at(5, 'Le monde lit'), Still('06a.jpg', (1.03, 1.15), (0.5, 0.55))),  # DC traffic 1970s
    (P[6], Still('07a.jpg', (1.0, 1.12), (0.5, 0.5))),  # refinery at night
    (at(6, 'Leurs dirigeants'), Still('07b.jpg', (1.12, 1.0), (0.52, 0.4))),  # flare stack
    (P[7], Card(logo='08a.png')),
    (at(7, 'Aux États-Unis'), Still('08b.jpg', (1.0, 1.12), (0.45, 0.55), (0.4, 0.5))),  # Capitol 1988
    (P[8], Still('09b.jpeg', (1.0, 1.12), (0.45, 0.4))),  # Kohl at Rio-92
    (at(8, 'Kyoto,'), Still('09a.jpeg', (1.1, 1.0), (0.45, 0.4))),  # Bush at Rio-92
    (at(8, 'Les sommets'), Chart(emis, (1900, 2025), (0, 40), 'Émissions mondiales de CO₂',
                                 'milliards de tonnes par an (Global Carbon Project)', ACCENT,
                                 marks=((1992, 'Rio'), (1997, 'Kyoto')), ticks_x=(1900, 1950, 2000),
                                 ticks_y=(0, 10, 20, 30, 40), draw_s=0.8)),
    (P[9], Still('10a.jpg', (1.3, 1.42), (0.7, 0.58), (0.66, 0.62))),  # 2003 heatwave map
    (at(9, 'En 2005,'), Still('10b.jpg', (1.0, 1.16), (0.48, 0.42))),  # Katrina from space
    (at(9, 'noie'), Still('10c.jpg', (1.0, 1.1), (0.5, 0.5))),  # New Orleans flooded
    (P[10], Still('11b.jpg', (1.02, 1.12), (0.5, 0.35))),  # Hollande, Fabius, Ban applaud
    (at(10, 'et si possible'), Still('11a.jpg', (1.12, 1.02), (0.5, 0.45))),  # gavel
    (P[11], Clip(os.path.join(VIDEOS, 'wildfire.mp4'), 0, 0.75)),
    (at(11, 'tuent ou'), Still('12c.jpg', (1.0, 1.14), (0.35, 0.45))),  # smoke over SE Australia
    (at(11, 'En 2022,'), Still('12b.jpg', (1.0, 1.1), (0.5, 0.55), (0.72, 0.55))),  # Sindh 2021 → 2022
    (P[12], Still('13a.png', (1.14, 1.22), (0.52, 0.42))),  # GISTEMP 2024 map
    (at(12, 'dépasse'), StripesCard(1880, 2024, big='+1,5 °C', draw_s=0.45)),
    (P[13], Still('14a.jpg', (1.02, 1.14), (0.5, 0.55))),  # Paris climate march
    (at(13, 'Chaque tonne'), Still('14b.jpg', (1.12, 1.02), (0.5, 0.45))),
    (at(13, 'Construire,'), Still('14e.jpg', (1.0, 1.1), (0.5, 0.55))),
    (P[14], Still('15b.jpg', (1.55, 1.0), (0.5, 0.5))),  # Blue Marble, pulling back
]
badges = [
    (0.0, '1900', None), (P[1], '1908', None),
    (P[2], '1938', 'Guy Callendar, ingénieur'), (at(2, 'En brûlant'), None, None),
    (P[3], '1945', None), (P[4], '1958', 'Observatoire de Mauna Loa, Hawaï'),
    (at(4, 'un scientifique'), None, None), (P[5], None, None), (at(5, 'Le monde lit'), '1972', None),
    (P[6], 'Fin des années 70', None), (P[7], '1988', None),
    (at(7, 'Aux États-Unis'), '1988', 'James Hansen devant le Sénat'),
    (P[8], '1992', 'Sommet de la Terre, Rio'), (at(8, 'Kyoto,'), '1997', 'Protocole de Kyoto'),
    (at(8, 'Les sommets'), None, None),
    (P[9], '2003', 'Canicule en Europe'), (at(9, 'En 2005,'), '2005', 'Ouragan Katrina'),
    (P[10], '2015', 'COP21, Paris'), (P[11], '2019', 'Australie'), (at(11, 'En 2022,'), '2022', 'Pakistan'),
    (P[12], '2024', 'Anomalie de température, NASA'), (at(12, 'dépasse'), None, None),
    (P[13], None, None), (P[14], None, None),
]
YEAR_AT = [(0, 1900), (P[1], 1908), (P[2], 1938), (P[3], 1945), (P[4], 1958), (P[5], 1972), (P[6], 1979),
           (P[7], 1988), (P[8], 1992), (P[9], 2003), (P[10], 2015), (P[11], 2019), (P[12], 2024),
           (P[13], 2025), (P[14], 2025)]


def current(seq, t):
    j = max(k for k in range(len(seq)) if seq[k][0] <= t + 1e-9)
    return j


badge_cache, sub_cache = {}, {}


def layer_alpha(t, t0, t1, fade=0.3):
    return max(0, min(1, (t - t0) / fade, (t1 - t) / fade))


def stripes_bar(img, t):
    """Thin warming-stripes band at the bottom, growing with the story's year."""
    j = current(YEAR_AT, t)
    y_now = YEAR_AT[j][1] if j == len(YEAR_AT) - 1 else YEAR_AT[j][1] + (
        YEAR_AT[j + 1][1] - YEAR_AT[j][1]) * min(1, (t - YEAR_AT[j][0]) / 1.2)
    d = ImageDraw.Draw(img); n = 2025 - 1900 + 1; sw = W / n
    for k, y in enumerate(range(1900, min(2025, int(y_now)) + 1)):
        d.rectangle((k * sw, H - 12, (k + 1) * sw + 1, H), fill=stripe_color(ANOM[y]))


def render_frame(t):
    j = current(shots, t)
    t0, vis = shots[j]
    t1 = shots[j + 1][0] if j + 1 < len(shots) else DURATION
    img = vis.frame(t - t0, t1 - t0 + XF)
    if j > 0 and t - t0 < XF:
        pt0, pvis = shots[j - 1]
        img = Image.blend(pvis.frame(t - pt0, t0 - pt0 + XF), img, (t - t0) / XF)
    for k in range(j - 1):  # free memory of shots that are over
        shots[k][1].release()
    img = img.convert('RGBA')
    img.alpha_composite(VIGNETTE)
    # badge
    b = current(badges, t); bt0, year, label = badges[b]
    bt1 = badges[b + 1][0] if b + 1 < len(badges) else DURATION
    if year or label:
        key = (year, label)
        if key not in badge_cache: badge_cache[key] = badge_layer(year, label)
        a = layer_alpha(t, bt0, bt1 + 0.3, 0.4)
        lay = badge_cache[key]
        if a < 1:
            r, g, bb, al = badge_cache[key].split(); lay = Image.merge('RGBA', (r, g, bb, al.point(lambda v: v * a)))
        img.alpha_composite(lay)
    # subtitle
    for c, (c0, c1, lines) in enumerate(cues):
        if c0 <= t < c1:
            if c not in sub_cache: sub_cache.clear(); sub_cache[c] = subtitle_layer(lines)
            img.alpha_composite(sub_cache[c])
            break
    img = img.convert('RGB')
    if t < AUDIO_END + 0.5: stripes_bar(img, t)
    # fade in from black, fade out to the screen's background
    if t < LEAD: img = Image.blend(Image.new('RGB', (W, H), (0, 0, 0)), img, min(1, t / LEAD))
    if t > DURATION - 2.0: img = Image.blend(img, Image.new('RGB', (W, H), BG), (t - (DURATION - 2.0)) / 2.0)
    return img


if PREVIEW:
    for t in PREVIEW:
        render_frame(t).save(os.path.join(WORK, 'work', f'preview_{t:06.1f}.jpg'), quality=85)
    sys.exit()

n_frames = math.ceil(DURATION * FPS)
print(f'duration {DURATION:.2f}s, {n_frames} frames, {len(cues)} cues')
enc = subprocess.Popen([
    FFMPEG, '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
    '-i', VOICE, '-filter_complex', f'[1:a]adelay={int(LEAD * 1000)}:all=1,apad[a]', '-map', '0:v', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-tune', 'film', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', OUT], stdin=subprocess.PIPE)
for i in range(n_frames):
    enc.stdin.write(render_frame(i / FPS).tobytes())
    if i % 250 == 0: print(f'{i / FPS:6.1f}s', flush=True)
enc.stdin.close(); enc.wait()
print('done', OUT)
