"""Downloads the film's images from Wikimedia Commons (stills scaled to a standard thumbnail width), writes credits.json.
Usage: fetch.py <outdir> <media.txt>   (media.txt: one "key=File:Title" per line)"""
import json, os, re, sys, time, urllib.error, urllib.parse, urllib.request
UA = {"User-Agent": "jdlt-film/1.0 (https://github.com/vladbolliet/jeu_de_la_terre; school project) python-urllib"}  # Wikimedia UA policy
out = sys.argv[1]; cred_path = os.path.join(out, "credits.json")


def get(url):
    """GET with backoff: Commons answers 429 to bursts."""
    for k in range(6):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA)).read()
        except urllib.error.HTTPError as e:
            if e.code != 429 or k == 5: raise
            time.sleep(5 * 2 ** k)


creds = json.load(open(cred_path)) if os.path.exists(cred_path) else {}
for arg in open(sys.argv[2], encoding="utf-8").read().split("\n"):
    if not arg.strip(): continue
    key, title = arg.split("=", 1)
    params = {"action": "query", "format": "json", "titles": title, "prop": "imageinfo",
              "iiprop": "url|size|mime|extmetadata", "iiurlwidth": 3840,
              "iiextmetadatafilter": "LicenseShortName|Artist"}
    d = json.loads(get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)))
    p = next(iter(d["query"]["pages"].values()))
    if "imageinfo" not in p: print("MISSING", title); continue
    ii = p["imageinfo"][0]; m = ii["extmetadata"]
    video = ii["mime"].startswith("video")
    url = ii["url"] if video or ii["width"] <= 3840 else ii["thumburl"]
    ext = os.path.splitext(urllib.parse.urlparse(url).path)[1].lower()
    if ext in (".tif", ".tiff"): url = ii["thumburl"]; ext = ".jpg"
    dest = os.path.join(out, key + ext)
    if not os.path.exists(dest):
        data = get(url)  # before open(): a failed download must not leave an empty file
        with open(dest, "wb") as f: f.write(data)
        time.sleep(1)
    creds[key] = {"file": os.path.basename(dest), "title": title, "page": ii["descriptionurl"],
                  "license": m.get("LicenseShortName", {}).get("value", ""),
                  "artist": re.sub(r"\s+", " ", re.sub("<[^>]+>", "", m.get("Artist", {}).get("value", ""))).strip()}
    print("ok", key, os.path.getsize(dest) // 1024, "KB")
json.dump(creds, open(cred_path, "w"), ensure_ascii=False, indent=1)
