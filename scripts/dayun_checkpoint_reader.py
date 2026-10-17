"""Seekable, hash-verified reader for the engine's existing private source chunks."""
import hashlib
import io
import json
import re
from pathlib import Path
from dayun_private_storage import PREFIX, transfer


class CheckpointReader(io.BufferedIOBase):
    def __init__(self, label, cache, index=None):
        if label not in ('Agro_ABC', 'Agro_DEF'):
            raise ValueError('invalid_source')
        self.cache = Path(cache)
        self.cache.mkdir(parents=True, exist_ok=True)
        manifest = self.cache / 'checkpoint.json'
        if index is None:
            transfer('get', f'{PREFIX}/checkpoints/{label}/index.json', manifest)
        self.index = index or json.loads(manifest.read_text())
        self.label = label
        self.parts = self.index['parts']
        self.offsets = []
        total = 0
        for part in self.parts:
            if not part['key'].startswith(f'{PREFIX}/checkpoints/{label}/') or not re.fullmatch(r'[a-f0-9]{64}', part['sha256']) or not isinstance(part['bytes'], int) or not 0 < part['bytes'] <= 128 * 1024 * 1024:
                raise ValueError('invalid_checkpoint_key')
            self.offsets.append(total)
            total += part['bytes']
        self.size = total
        if 'size' in self.index['identity'] and total != int(self.index['identity']['size']):
            raise ValueError('checkpoint_not_complete')
        self.position = 0
        self.verified = set()

    def opener(self, path, mode='r'):
        if Path(path).name != 'source.tif' or mode not in ('r', 'rb'):
            raise FileNotFoundError(path)
        child = CheckpointReader(self.label, self.cache, self.index)
        child.verified = self.verified
        return child

    def prefetch(self, indices):
        from concurrent.futures import ThreadPoolExecutor
        def fetch(i):
            reader = self.opener('source.tif')
            reader.seek(self.offsets[i])
            reader.read(1)
        with ThreadPoolExecutor(max_workers=6) as pool:
            list(pool.map(fetch, sorted(set(indices))))

    def readable(self):
        return True

    def seekable(self):
        return True

    def tell(self):
        return self.position

    def seek(self, offset, whence=0):
        target = offset + (self.position if whence == 1 else self.size if whence == 2 else 0)
        if target < 0:
            raise ValueError('negative_seek')
        self.position = target
        return target

    def read(self, size=-1):
        import bisect
        remaining = max(0, self.size - self.position)
        remaining = remaining if size < 0 else min(size, remaining)
        data = []
        while remaining:
            i = bisect.bisect_right(self.offsets, self.position) - 1
            part = self.parts[i]
            path = self.cache / (part['sha256'] + '.bin')
            if part['sha256'] not in self.verified:
                if not path.exists():
                    staging = path.with_suffix('.part')
                    transfer('get', part['key'], staging)
                    staging.replace(path)
                if path.stat().st_size != part['bytes'] or hashlib.sha256(path.read_bytes()).hexdigest() != part['sha256']:
                    raise ValueError('invalid_checkpoint_chunk')
                self.verified.add(part['sha256'])
                print(f'Verified private source chunk {i + 1}/{len(self.parts)}', flush=True)
            start = self.position - self.offsets[i]
            count = min(remaining, part['bytes'] - start)
            with path.open('rb') as src:
                src.seek(start)
                piece = src.read(count)
            if len(piece) != count:
                raise ValueError('short_checkpoint_read')
            data.append(piece)
            self.position += count
            remaining -= count
        return b''.join(data)

    def readinto(self, buffer):
        data = self.read(len(buffer))
        buffer[:len(data)] = data
        return len(data)
