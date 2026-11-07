"""Catalog images from four official pages and download a curated, bounded selection.

Run with Python 3 from the repository root. Originals remain unmodified; only
reviewed, optimized copies should be placed under public/ for site use.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from hashlib import sha256
from html.parser import HTMLParser
import json
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

BASE = "https://www.espejodeagua.org/"
PAGES = ["", "galeria.html", "emergencia.html", "proyecto-techo-camino-y-semilla.html"]
SELECTED = {
    "logo-header.png": "Organization attribution; preserve the original logo.",
    "resguardo-ibanacuara-condiciones.jpg": "Temporary shelter context; Ibanacuara only.",
    "resguardo-ibanacuara-condiciones2.jpg": "Damaged housing context; Ibanacuara only.",
    "resguardo-ibanacuara-condiciones4.jpg": "Temporary shelter context; Ibanacuara only.",
    "resguardo-ibanacuara-condiciones5.jpg": "Roof damage context; Ibanacuara only.",
    "resguardo-ibanacuara-condiciones6.jpg": "Roof damage context; Ibanacuara only.",
    "resguardo-ibanacuara-condiciones7.jpg": "Camp context; Ibanacuara only.",
    "terremoto-camino.jpg": "Earthquake-damaged access route; original event context only.",
    "terremoto-grietas.jpg": "Earthquake ground damage; original event context only.",
    "patty-valores-padres-campesinos-mariela.jpg": "Organization community-work section; Mariela workshop.",
    "convergencia-vital.jpg": "Organization community-work section; Convergencia Vital.",
    "patty-teatro-barranquilla.jpg": "Organization arts-work section; Barranquilla workshop.",
}
ROOT = Path(__file__).resolve().parents[1]


def fetch(url):
    if urlparse(url).hostname not in {"www.espejodeagua.org", "espejodeagua.org"}:
        raise ValueError(f"Not an official-site URL: {url}")
    with urlopen(Request(url, headers={"User-Agent": "Impacto image catalog"}), timeout=30) as response:
        if urlparse(response.url).hostname not in {"www.espejodeagua.org", "espejodeagua.org"}:
            raise ValueError("Unexpected off-site redirect")
        return response.read(), response.headers.get_content_type()


class ImageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.images = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "img" and attrs.get("src"):
            self.images.append((attrs["src"], attrs.get("alt", "")))


def main():
    catalog = {}
    for path in PAGES:
        page = urljoin(BASE, path)
        html, _ = fetch(page)
        parser = ImageParser()
        parser.feed(html.decode("utf-8"))
        for src, alt in parser.images:
            url = urljoin(page, src)
            entry = catalog.setdefault(url, {"sourceUrl": url, "sourcePages": [], "sourceCaptions": []})
            if page not in entry["sourcePages"]:
                entry["sourcePages"].append(page)
            if alt and alt not in entry["sourceCaptions"]:
                entry["sourceCaptions"].append(alt)

    def download(entry):
        filename = Path(urlparse(entry["sourceUrl"]).path).name
        if filename not in SELECTED:
            entry["selection"] = "Catalog only; not selected for this integration."
            return entry
        data, content_type = fetch(entry["sourceUrl"])
        if content_type not in {"image/jpeg", "image/png"}:
            raise ValueError(f"Unexpected image type: {content_type}")
        target = ROOT / "assets/espejo-de-agua/originals" / filename
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        entry.update(localPath=str(target.relative_to(ROOT)), bytes=len(data), sha256=sha256(data).hexdigest(), contentType=content_type, intendedUse=SELECTED[filename])
        return entry

    with ThreadPoolExecutor(max_workers=4) as pool:
        images = list(pool.map(download, catalog.values()))
    missing = set(SELECTED) - {Path(i["localPath"]).name for i in images if "localPath" in i}
    if missing:
        raise ValueError(f"Selected images absent from official pages: {missing}")
    manifest = {
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "publisher": "Espejo de Agua",
        "rights": "Source-site imagery; no explicit open reuse license was found on the parsed pages. Attribution is recorded, not a license grant.",
        "usage": "Organization and original-event context only. Do not attach these images to fictional households or use them as delivery/verified-impact evidence.",
        "pages": [urljoin(BASE, p) for p in PAGES],
        "images": images,
    }
    target = ROOT / "docs/espejo-de-agua/image-catalog.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    selected = [i for i in images if "localPath" in i]
    print(json.dumps({"cataloged": len(images), "downloaded": len(selected), "bytes": sum(i["bytes"] for i in selected), "files": [i["localPath"] for i in selected]}, indent=2))


if __name__ == "__main__":
    main()
