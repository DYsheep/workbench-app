# 修复 Relations.tsx ringColor → boxShadow
import io

p = r'C:\project\工作台\workbench-app\src\pages\Relations.tsx'
s = open(p, encoding='utf-8').read()

old = "style={{ringColor:cat.color,background:editingPerson.avatar===a.e?cat.bg:'transparent'}}"
new = "style={{boxShadow:editingPerson.avatar===a.e?`0 0 0 2px ${cat.color}`:'none',background:editingPerson.avatar===a.e?cat.bg:'transparent'}}"

if old in s:
    s = s.replace(old, new)
    open(p, 'w', encoding='utf-8').write(s)
    print('ringColor fixed -> boxShadow')
else:
    print('pattern not found, checking...')
    import re
    m = re.search(r"style=\{\{ringColor[^}]*\}\}", s)
    print('found:', m.group(0) if m else 'none')
