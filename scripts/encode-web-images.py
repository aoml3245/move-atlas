#!/usr/bin/env python3
"""Make web delivery encodings; preserve approved original images privately.
Requires Pillow only when re-encoding originals, not for building/serving the app.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
import json, os
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
manifest = json.loads((PUBLIC / 'illustrations/manifest.json').read_text())
reviews = json.loads((ROOT / 'work/illustration-reviews.json').read_text())
archive = ROOT / 'work/approved-image-originals'
archive.mkdir(parents=True, exist_ok=True)

def encode(pair):
    exercise_id, asset = pair
    review = reviews[exercise_id]
    source = ROOT / review['imagePath']
    if not source.exists(): source = archive / source.name
    original = source.read_bytes()
    assert review['status'] == 'approved' and sha256(original).hexdigest() == review['sha256']
    target = PUBLIC / 'illustrations' / (source.stem+'.webp')
    with Image.open(source) as image:
        dimensions = list(image.size)
        image.save(target, 'WEBP', quality=90, method=6)
    with Image.open(target) as image:
        image.load()
        assert list(image.size) == dimensions
    delivery = target.read_bytes()
    new_asset = dict(asset, url='/illustrations/' + target.name)
    new_review = dict(status='approved', imagePath='public'+new_asset['url'], sha256=sha256(delivery).hexdigest(), reviewedAt=review['reviewedAt'], reviewer=review.get('reviewer','parent-visual-review'), sourceReview={'filename':source.name,'sha256':review['sha256'],'reviewedAt':review['reviewedAt']}, encoding={'format':'WebP','quality':90,'method':6,'dimensions':dimensions,'sourceBytes':len(original),'deliveryBytes':len(delivery),'operation':'format encoding only; no crop, resize, or pose changes'})
    return exercise_id, new_asset, new_review, source

assets, delivery_reviews, originals = {}, {}, []
with ThreadPoolExecutor(max_workers=min(8, os.cpu_count() or 4)) as pool:
    for index, (exercise_id, asset, review, source) in enumerate(pool.map(encode, manifest['assets'].items()), 1):
        assets[exercise_id] = asset
        delivery_reviews[exercise_id] = review
        originals.append(source)
        if index % 200 == 0: print('Encoded', index, '/', len(manifest['assets']), flush=True)
# Write metadata only after every source hash and delivery decode has passed.
(ROOT/'data').mkdir(exist_ok=True)
(ROOT/'data/illustration-reviews.json').write_text(json.dumps(delivery_reviews,ensure_ascii=False,indent=2)+'\n')
(ROOT/'data/illustration-assets.json').write_text(json.dumps({'assets':[dict(asset,exerciseId=key,imagePath='public'+asset['url']) for key,asset in assets.items()]},ensure_ascii=False,indent=2)+'\n')
manifest['assets']=assets
manifest['revision']=sha256(json.dumps(assets,ensure_ascii=False).encode()).hexdigest()
(PUBLIC/'illustrations/manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
for source in originals:
    if source.parent == archive: continue
    saved=archive/source.name
    if saved.exists():
        assert sha256(saved.read_bytes()).hexdigest()==sha256(source.read_bytes()).hexdigest()
        # Leave duplicate originals in place until explicitly reconciled.
        raise RuntimeError('Original archive collision: '+source.name)
    source.rename(saved)
print(json.dumps({'images':len(assets),'originalBytes':sum(r['encoding']['sourceBytes'] for r in delivery_reviews.values()),'webBytes':sum(r['encoding']['deliveryBytes'] for r in delivery_reviews.values())}),flush=True)
