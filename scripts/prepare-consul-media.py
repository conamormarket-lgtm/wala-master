"""Prepare the approved local batch; no cloud writes or publication."""
from pathlib import Path
import json
import subprocess
from PIL import Image, ImageOps
import imageio_ffmpeg

root = Path(__file__).resolve().parent.parent
source = root / 'output/imagegen/yoryo-consul-20261123/lote-completo'
target = root / 'output/product-media/consul'
images = json.loads((source / 'manifest-final.json').read_text(encoding='utf8'))['entries']
videos = json.loads((source / 'flow-media-final.json').read_text(encoding='utf8'))['media']
records = []
for item in images:
    relative = Path(item['file']).with_suffix('.webp')
    output = target / relative
    output.parent.mkdir(parents=True, exist_ok=True)
    image = ImageOps.exif_transpose(Image.open(source / item['file'])).convert('RGB')
    image.thumbnail((1440, 1440), Image.Resampling.LANCZOS)
    image.save(output, 'WEBP', quality=86, method=6)
    records.append(dict(kind='image', source=item['file'], file=relative.as_posix(), width=image.width, height=image.height, bytes=output.stat().st_size))
print(f'Imágenes preparadas: {len(records)}', flush=True)
for item in videos:
    output = target / 'videos' / (item['id'] + '.mp4')
    output.parent.mkdir(parents=True, exist_ok=True)
    if not output.exists():
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-loglevel', 'error', '-n', '-i', str(source / item['src']), '-map', '0:v:0', '-vf', r'scale=if(gt(iw\,ih)\,1280\,720):-2', '-c:v', 'libx264', '-crf', '24', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', str(output)], check=True)
    poster = Image.open(source / item['poster']).convert('RGB')
    poster.thumbnail((960, 960), Image.Resampling.LANCZOS)
    poster_path = output.with_suffix('.webp')
    poster.save(poster_path, 'WEBP', quality=84, method=6)
    records.append(dict(kind='video', source=item['src'], file=output.relative_to(target).as_posix(), poster=poster_path.relative_to(target).as_posix(), bytes=output.stat().st_size))
    print(f"Vídeo preparado: {item['id']}", flush=True)
(target / 'manifest.json').write_text(json.dumps(dict(images=53, videos=14, totalBytes=sum(r['bytes'] for r in records), assets=records), ensure_ascii=False, indent=2), encoding='utf8')
print(json.dumps(dict(images=53, videos=14, totalMB=round(sum(r['bytes'] for r in records)/1e6, 1))), flush=True)
