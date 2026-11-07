"""Build the offline playground and static-hosting entry point; no dependencies."""
import base64
import html
import json
from pathlib import Path

root = Path(__file__).resolve().parent
src = root / 'src'
fonts = [
    ('Atlas Inter', 'Inter.ttf', '100 900'),
    ('Atlas Jakarta', 'PlusJakartaSans.ttf', '200 800'),
    ('Atlas Manrope', 'Manrope.ttf', '200 800'),
    ('Atlas Serif', 'SourceSerif4.ttf', '200 900'),
    ('Atlas Plex Sans', 'IBMPlexSans.ttf', '100 700'),
    ('Atlas Plex Mono', 'IBMPlexMono.ttf', '400'),
]
font_faces = []
for family, filename, weights in fonts:
    encoded = base64.b64encode((root / 'fonts' / filename).read_bytes()).decode('ascii')
    font_faces.append(f'@font-face{{font-family:"{family}";src:url(data:font/ttf;base64,{encoded}) format("truetype");font-weight:{weights};font-display:swap;}}')
data = json.loads((root / 'theme-tokens.json').read_text(encoding='utf-8'))
licenses = '\n\n'.join(p.name + '\n' + p.read_text(encoding='utf-8') for p in sorted((root / 'font-licenses').glob('*-OFL.txt')))
replacements = {
    '__FONT_FACES__': '\n'.join(font_faces),
    '__STYLES__': '\n'.join((src / name).read_text(encoding='utf-8') for name in ['styles.css', 'workbench.css', 'screens.css', 'select-ui.css']),
    '__THEME_DATA__': json.dumps(data, ensure_ascii=False).replace('<', '\\u003c'),
    '__FONT_FILES__': json.dumps([item[1] for item in fonts]),
    '__FONT_LICENSES__': html.escape(licenses),
    '__PROJECT_LICENSE__': html.escape((root / 'LICENSE').read_text(encoding='utf-8')),
    '__CORE__': (src / 'theme-core.js').read_text(encoding='utf-8'),
    '__SELECTS__': (src / 'select-ui.js').read_text(encoding='utf-8'),
    '__SCREENS__': (src / 'screens.js').read_text(encoding='utf-8'),
    '__APP__': (src / 'app.js').read_text(encoding='utf-8') + '\n' + (src / 'workbench.js').read_text(encoding='utf-8'),
}
output = (src / 'index.html').read_text(encoding='utf-8')
for placeholder, content in replacements.items():
    if placeholder not in output:
        raise ValueError(f'Missing build placeholder: {placeholder}')
    output = output.replace(placeholder, content)
(root / 'dist').mkdir(exist_ok=True)
for target in [root / 'color-theme-playground.html', root / 'dist/index.html']:
    with target.open('w', encoding='utf-8', newline='\n') as handle:
        handle.write(output)
print(f'Built standalone playground and dist/index.html ({len(output.encode()):,} bytes)')
