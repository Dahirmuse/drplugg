#!/usr/bin/env python3
"""
Extraherar kort ur Anki-deck (.apkg) till JSONL.

    python3 scripts/anki-extract.py /tmp/apkg/*.apkg > src/content/anki-raw.jsonl

.apkg är en zip med collection.anki21 (ibland zstd-komprimerad) eller collection.anki2
(SQLite). Vi läser notes-tabellen och skriver ett objekt per kort.
"""
import json
import os
import re
import sqlite3
import subprocess
import sys
import tempfile
import zipfile

TAG_RE = re.compile(r"<[^>]+>")
IMG_RE = re.compile(r"\[sound:[^\]]+\]|<img[^>]*>", re.I)


def clean(text: str) -> str:
    text = IMG_RE.sub(" ", text)
    text = TAG_RE.sub(" ", text)
    text = text.replace("&nbsp;", " ").replace("&amp;", "&")
    text = text.replace("&lt;", "<").replace("&gt;", ">")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def extract(path: str):
    with tempfile.TemporaryDirectory() as tmp:
        try:
            with zipfile.ZipFile(path) as z:
                names = set(z.namelist())
                # Nyare Anki: collection.anki21b (zstd) · sedan anki21 · sist anki2
                for cand in ("collection.anki21b", "collection.anki21", "collection.anki2"):
                    if cand in names:
                        target = cand
                        break
                else:
                    target = None
                if not target:
                    return []
                z.extract(target, tmp)
        except zipfile.BadZipFile:
            print(f"! {path}: inte en zip", file=sys.stderr)
            return []

        db = os.path.join(tmp, target)
        with open(db, "rb") as fh:
            magic = fh.read(4)

        # zstd-magic: 0x28 B5 2F FD
        if magic == b"\x28\xb5\x2f\xfd":
            out = os.path.join(tmp, "collection.sqlite")
            try:
                subprocess.run(["zstd", "-d", "-f", db, "-o", out],
                               check=True, capture_output=True)
                db = out
            except Exception as exc:  # noqa: BLE001
                print(f"! {path}: kunde inte zstd-dekomprimera ({exc})", file=sys.stderr)
                return []

        try:
            con = sqlite3.connect(db)
            models = {}
            try:
                row = con.execute("select models from col").fetchone()
                if row and row[0]:
                    models = json.loads(row[0])
            except sqlite3.Error:
                pass

            rows = con.execute("select id, mid, tags, flds from notes").fetchall()
            cards = []
            for nid, mid, tags, flds in rows:
                fields = [clean(f) for f in flds.split("\x1f")]
                model = models.get(str(mid), {})
                fnames = [f.get("name", "") for f in model.get("flds", [])] if model else []
                if not any(fields):
                    continue
                cards.append({
                    "note": str(nid),
                    "deck": os.path.basename(path),
                    "model": model.get("name", ""),
                    "names": fnames,
                    "fields": fields,
                    "tags": (tags or "").strip(),
                })
            con.close()
            return cards
        except sqlite3.Error as exc:
            print(f"! {path}: {exc}", file=sys.stderr)
            return []


def main():
    total = 0
    for path in sys.argv[1:]:
        cards = extract(path)
        for c in cards:
            print(json.dumps(c, ensure_ascii=False))
        total += len(cards)
        print(f"# {os.path.basename(path)}: {len(cards)} kort", file=sys.stderr)
    print(f"# TOTALT: {total} kort", file=sys.stderr)


if __name__ == "__main__":
    main()
