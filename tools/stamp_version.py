"""Pone un número de versión nuevo en todas las páginas antes de publicar.
Así los móviles detectan que hay versión nueva y se actualizan solos (update.js).
Uso: python3 tools/stamp_version.py   (desde la carpeta del repositorio)"""
import re, glob, json, time, os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
V = time.strftime('%Y%m%d%H%M%S')
SNIP = '<script>window.WO2_VERSION=\'%s\';</script>\n<script src="update.js?v=%s"></script>'
for f in glob.glob('*.html'):
    s = open(f, encoding='utf-8').read()
    if 'update.js' not in s:
        m = re.search(r'<link rel="manifest"[^>]*>', s) or re.search(r'</title>', s)
        s = s[:m.end()] + '\n' + (SNIP % (V, V)) + s[m.end():]
    s = re.sub(r"window\.WO2_VERSION='[^']*'", "window.WO2_VERSION='%s'" % V, s)
    # Los archivos propios se piden con la versión, para que no se queden viejos
    s = re.sub(r'src="(update|branding|status|firebase-init)\.js(\?v=[^"]*)?"', r'src="\1.js?v=%s"' % V, s)
    open(f, 'w', encoding='utf-8').write(s)
json.dump({'v': V}, open('version.json', 'w'))
print('Versión', V)
