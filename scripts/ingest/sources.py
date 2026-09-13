# -*- coding: utf-8 -*-
"""The source manifest, Python half (SAK-434).

This is scripts/ingest/sources.mjs in Python: the same file, the same format,
the same rules. Read that module's header for why the manifest exists and why
`archives` and `builtFrom` are written by different events. In short:

    archives   what each upstream archive is pinned to now: URL, the version the
               archive itself declares, and the SHA-256 of the file as
               downloaded.
    builtFrom  one entry per ingest pass, keyed by the script: the archives that
               pass read and the files under src/data/generated it wrote,
               stamped when it wrote them.

An ingest calls verify_source() before it reads an archive and stops when the
bytes differ, unless --accept-source is passed. After it writes its outputs it
calls record_build(). src/data/source-manifest.test.ts fails when the two
sections disagree, which is what stops a committed reduction from claiming an
archive it was not cut from.

Both halves write the file with json.dumps(..., indent=2, sort_keys=True) and a
trailing newline, so it does not churn depending on which language last touched
it.
"""

import bz2
import datetime
import gzip
import hashlib
import io
import json
import os
import urllib.request
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", ".."))
MANIFEST = os.path.join(REPO, "src", "data", "generated", "sources.json")


def _today():
    return datetime.date.today().isoformat()


def read_manifest():
    with open(MANIFEST, encoding="utf-8") as fh:
        return json.load(fh)


def write_manifest(manifest):
    text = json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    with open(MANIFEST, "w", encoding="utf-8") as fh:
        fh.write(text)


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def archive_path(archive_id, manifest=None):
    """Absolute path to where an archive lives in the ignored raw directory."""
    manifest = manifest or read_manifest()
    entry = manifest["archives"].get(archive_id)
    if entry is None:
        raise SystemExit(f'no archive "{archive_id}" in src/data/generated/sources.json')
    return os.path.join(REPO, entry["path"])


def ensure_archive(archive_id):
    """Put an archive on disk at its manifest path if it is not there, and
    return that path.

    The ingest reads from a file rather than straight from the network: a
    response body that is never written down cannot be hashed the same way
    twice, and the hash is the whole point. The raw directory is ignored by git,
    so nothing this downloads is committed.
    """
    manifest = read_manifest()
    entry = manifest["archives"].get(archive_id)
    if entry is None:
        raise SystemExit(f'no archive "{archive_id}" in src/data/generated/sources.json')
    file = os.path.join(REPO, entry["path"])
    if os.path.exists(file):
        return file
    if entry.get("committed"):
        raise SystemExit(f"{entry['name']} is committed at {entry['path']} but is missing")
    os.makedirs(os.path.dirname(file), exist_ok=True)
    print(f"downloading {entry['name']} from {entry['url']}")
    urllib.request.urlretrieve(entry["url"], file)
    return file


def open_archive(archive_id, zip_member=None):
    """A binary stream over an archive's content, decompressed as needed.

    The hash is always of the file as downloaded, so .gz, .bz2 and .zip are
    unpacked here rather than leaving a second, unpinned copy on disk.
    """
    path = archive_path(archive_id)
    if zip_member is not None:
        with zipfile.ZipFile(path) as zf:
            return io.BytesIO(zf.read(zip_member))
    if path.endswith(".gz"):
        return gzip.open(path, "rb")
    if path.endswith(".bz2"):
        return bz2.open(path, "rb")
    return open(path, "rb")


def open_archive_text(archive_id, encoding="utf-8", zip_member=None):
    """A line-iterable text stream over an archive's content."""
    return io.TextIOWrapper(
        open_archive(archive_id, zip_member=zip_member), encoding=encoding
    )


def read_archive_text(archive_id, encoding="utf-8", zip_member=None):
    """An archive's content as one string. KRADFILE is distributed in EUC-JP,
    which is why the encoding is a parameter rather than always UTF-8.
    """
    with open_archive(archive_id, zip_member=zip_member) as fh:
        return fh.read().decode(encoding)


def add_source_args(parser):
    """The one flag every ingest takes: accept a new archive and record it."""
    parser.add_argument(
        "--accept-source",
        action="store_true",
        help="record the archive on disk as the new pin and build from it",
    )


def verify_source(archive_id, path=None, accept=False, version=None):
    """Check the bytes about to be read against the manifest; return the digest.

    Without `accept` a difference stops the run: rebuilding the committed
    reduction from an archive nobody chose is the exact failure the pins cannot
    see. With `accept` the entry is rewritten to this file and the run goes on.
    """
    manifest = read_manifest()
    entry = manifest["archives"].get(archive_id)
    if entry is None:
        raise SystemExit(
            f'No archive "{archive_id}" is recorded in src/data/generated/sources.json. '
            "Add it there before an ingest can read it."
        )
    file = os.path.abspath(path) if path else os.path.join(REPO, entry["path"])
    if not os.path.exists(file):
        raise SystemExit(
            f"{entry['name']} is not on disk at {os.path.relpath(file, REPO)}.\n"
            f"Download it from {entry['url']} to that path. The raw directory is "
            "ignored by git on purpose; the archives are not committed."
        )
    digest = sha256_file(file)
    if digest == entry["sha256"]:
        return digest
    if not accept:
        raise SystemExit(
            f"{entry['name']} is not the archive src/data/generated was built from.\n"
            f"  recorded  {entry['sha256']}\n"
            f"            version {entry['version']}, recorded {entry['recordedAt']}\n"
            f"  on disk   {digest}\n"
            f"            {os.path.relpath(file, REPO)}\n"
            "Stopping rather than rebuilding the reduction from an archive nobody\n"
            "chose. If this newer archive is the one you want, rerun with\n"
            "--accept-source: that records it here and builds from it. Every other\n"
            f"pass that reads {archive_id} then has to be re-run too, and\n"
            "src/data/source-manifest.test.ts fails until it is."
        )
    entry = dict(entry)
    entry["sha256"] = digest
    entry["bytes"] = os.path.getsize(file)
    entry["version"] = version if version is not None else entry["version"]
    entry["recordedAt"] = _today()
    manifest["archives"][archive_id] = entry
    write_manifest(manifest)
    print(f"recorded {entry['name']}: {digest} ({entry['version']})")
    return digest


def record_build(script, outputs, archive_ids):
    """Record one ingest pass: the archives it read, the files it wrote."""
    manifest = read_manifest()
    archives = {}
    for archive_id in archive_ids:
        entry = manifest["archives"].get(archive_id)
        if entry is None:
            raise SystemExit(f'no archive "{archive_id}" to record')
        archives[archive_id] = entry["sha256"]
    built = manifest.setdefault("builtFrom", {})
    built[script] = {
        "outputs": sorted(outputs),
        "archives": archives,
        "recordedAt": _today(),
    }
    write_manifest(manifest)
