"""Build the browser model for GitHub Pages without Node or cloud services."""
from pathlib import Path
import argparse
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]

def build(base):
    base = '/' + base.strip('/') + '/' if base.strip('/') else '/'
    source, target = ROOT / 'app/public', ROOT / 'docs'
    target.mkdir(exist_ok=True)
    # Only rewrite root URLs that identify existing bundled resources.
    names = sorted((p.name for p in source.iterdir()), key=len, reverse=True)
    pattern = re.compile(r'''(?P<quote>["'`(])/(?P<name>''' + '|'.join(re.escape(n) for n in names) + r''')(?=[/"'`?#)])''')
    count = 0
    for src in sorted(source.rglob('*')):
        if not src.is_file():
            continue
        dest = target / src.relative_to(source)
        dest.parent.mkdir(parents=True, exist_ok=True)
        if src.suffix in {'.html', '.js', '.css', '.json'}:
            text = src.read_text()
            text = pattern.sub(lambda m: m['quote'] + base + m['name'], text)
            if src.name == 'geometry-workspace.js':
                text = text.replace("async function api(path,body){", "async function api(path,body){throw new Error('Native geometry jobs require the optional local backend; GitHub Pages serves the browser tools and bundled downloads.');")
            dest.write_text(text)
        else:
            shutil.copyfile(src, dest)
        count += 1
    # Open directly into the model, keeping superblock.html as a compatible URL.
    shutil.copyfile(target / 'superblock.html', target / 'index.html')
    (target / '.nojekyll').write_text('')
    print(f'Built {count} resources + model entry point at {base}')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', default='/American-Superblock/')
    build(parser.parse_args().base)
