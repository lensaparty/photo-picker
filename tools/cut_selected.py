#!/usr/bin/env python3
import argparse
import os
import re
import shutil
import sys
from pathlib import Path


RAW_EXT = {".cr2", ".cr3", ".nef", ".arw", ".raf", ".dng", ".orf", ".rw2"}
JPG_EXT = {".jpg", ".jpeg"}


def parse_names(text):
  names = []
  for line in text.splitlines():
    line = line.strip()
    if not line:
      continue
    m = re.match(r"^\d+\.\s+(.+)$", line)
    if m:
      names.append(m.group(1).strip())
  return names


def index_files(source):
  index = {}
  for path in source.rglob("*"):
    if not path.is_file():
      continue
    index.setdefault(path.name, []).append(path)
  return index


def ensure_dir(path):
  path.mkdir(parents=True, exist_ok=True)


def copy_matches(name, index, dest):
  copied = []
  exact = index.get(name, [])
  if exact:
    for p in exact:
      target = dest / p.name
      shutil.copy2(p, target)
      copied.append(target)
    return copied

  base, ext = os.path.splitext(name)
  for candidate_ext in JPG_EXT.union(RAW_EXT):
    cand = base + candidate_ext
    for p in index.get(cand, []):
      target = dest / p.name
      shutil.copy2(p, target)
      copied.append(target)
  return copied


def main():
  parser = argparse.ArgumentParser(
    description="Copy JPG+RAW selected from export text into folder 'terpilih'."
  )
  parser.add_argument("--source", required=True, help="Folder sumber foto")
  parser.add_argument("--output", help="Folder output (default: <source>/terpilih)")
  parser.add_argument("--text", help="Path file export.txt (hasil copy dari app)")
  args = parser.parse_args()

  source = Path(args.source).expanduser().resolve()
  if not source.exists():
    raise SystemExit(f"Source tidak ditemukan: {source}")

  output = Path(args.output).expanduser().resolve() if args.output else source / "terpilih"
  ensure_dir(output)

  if args.text:
    text = Path(args.text).read_text(encoding="utf-8")
  else:
    print("Paste hasil export di sini, akhiri dengan Ctrl+D:")
    text = sys.stdin.read()

  names = parse_names(text)
  if not names:
    raise SystemExit("Tidak ada nama file terdeteksi di export.")

  index = index_files(source)
  missing = []
  total = 0
  for name in names:
    copied = copy_matches(name, index, output)
    if not copied:
      missing.append(name)
    else:
      total += len(copied)

  print(f"Selesai. Copied file: {total}")
  if missing:
    print("Tidak ditemukan:")
    for name in missing:
      print(f"- {name}")


if __name__ == "__main__":
  main()
