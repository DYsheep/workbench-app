# 重写 Kalimba.tsx：17 键 → 21 键标准 C 大调拇指琴（中央 1 = C4）
p = r'C:\project\工作台\workbench-app\src\pages\Kalimba.tsx'
s = open(p, encoding='utf-8').read()

NEW_TINES = '''export const TINES = [
  // ===== 左 10（外→内，音由高到低） =====
  { id: 21, num: '7°°', note: 'B6', freq: 1975.53, label: '7°°', side: 'left',  index: 0 },
  { id: 19, num: '5°°', note: 'G6', freq: 1567.98, label: '5°°', side: 'left',  index: 1 },
  { id: 17, num: '3°°', note: 'E6', freq: 1318.51, label: '3°°', side: 'left',  index: 2 },
  { id: 15, num: '1°°', note: 'C6', freq: 1046.50, label: '1°°', side: 'left',  index: 3 },
  { id: 13, num: '6°',  note: 'A5', freq: 880.00,  label: '6°',  side: 'left',  index: 4 },
  { id: 11, num: '4°',  note: 'F5', freq: 698.46,  label: '4°',  side: 'left',  index: 5 },
  { id: 9,  num: '2°',  note: 'D5', freq: 587.33,  label: '2°',  side: 'left',  index: 6 },
  { id: 7,  num: '7',   note: 'B4', freq: 493.88,  label: '7',   side: 'left',  index: 7 },
  { id: 5,  num: '5',   note: 'G4', freq: 392.00,  label: '5',   side: 'left',  index: 8 },
  { id: 3,  num: '3',   note: 'E4', freq: 329.63,  label: '3',   side: 'left',  index: 9 },
  // ===== 中央（最低音，最长键，对应字母 c / 简谱 1） =====
  { id: 1,  num: '1',   note: 'C4', freq: 261.63,  label: '1',   side: 'center', index: 10 },
  // ===== 右 10（内→外，音由低到高） =====
  { id: 2,  num: '2',   note: 'D4', freq: 293.66,  label: '2',   side: 'right', index: 9 },
  { id: 4,  num: '4',   note: 'F4', freq: 349.23,  label: '4',   side: 'right', index: 8 },
  { id: 6,  num: '6',   note: 'A4', freq: 440.00,  label: '6',   side: 'right', index: 7 },
  { id: 8,  num: '1°',  note: 'C5', freq: 523.25,  label: '1°',  side: 'right', index: 6 },
  { id: 10, num: '3°',  note: 'E5', freq: 659.25,  label: '3°',  side: 'right', index: 5 },
  { id: 12, num: '5°',  note: 'G5', freq: 783.99,  label: '5°',  side: 'right', index: 4 },
  { id: 14, num: '7°',  note: 'B5', freq: 987.77,  label: '7°',  side: 'right', index: 3 },
  { id: 16, num: '2°°', note: 'D6', freq: 1174.66, label: '2°°', side: 'right', index: 2 },
  { id: 18, num: '4°°', note: 'F6', freq: 1396.91, label: '4°°', side: 'right', index: 1 },
  { id: 20, num: '6°°', note: 'A6', freq: 1760.00, label: '6°°', side: 'right', index: 0 },
]'''

NEW_LABELS = '''export const LABEL_DETAILS: Record<string, { main: string; sub?: string }> = {
  '7°°': { main: '7', sub: '°°' },
  '5°°': { main: '5', sub: '°°' },
  '3°°': { main: '3', sub: '°°' },
  '1°°': { main: '1', sub: '°°' },
  '6°°': { main: '6', sub: '°°' },
  '4°°': { main: '4', sub: '°°' },
  '2°°': { main: '2', sub: '°°' },
  '7°':  { main: '7', sub: '°' },
  '5°':  { main: '5', sub: '°' },
  '3°':  { main: '3', sub: '°' },
  '1°':  { main: '1', sub: '°' },
  '6°':  { main: '6', sub: '°' },
  '4°':  { main: '4', sub: '°' },
  '2°':  { main: '2', sub: '°' },
  '7':   { main: '7' },
  '6':   { main: '6' },
  '5':   { main: '5' },
  '4':   { main: '4' },
  '3':   { main: '3' },
  '2':   { main: '2' },
  '1':   { main: '1' },
}'''

s = s.replace('''function tineLength(index: number): number {
  const center = 8
  const dist = Math.abs(index - center)
  return 140 - dist * 6
}''', '''function tineLength(index: number): number {
  const center = 10
  const dist = Math.abs(index - center)
  return 140 - dist * 5
}''')

start = s.index('export const TINES')
end = s.index('\n]\n', start) + 3
s = s[:start] + NEW_TINES + s[end:]

start = s.index('export const LABEL_DETAILS')
end = s.index('\n}\n', start) + 3
s = s[:start] + NEW_LABELS + s[end:]

s = s.replace('minWidth: 700, maxWidth: 900', 'minWidth: 780, maxWidth: 1000')

s = s.replace('''    // 数字 1-9 = 中央 C4 + 右侧音阶（D4→D6）
    // Q-I = 左侧高音区（E6→E4，从外到内）
    const keys: Record<string, number> = {
      '1': 1, '2': 2, '3': 4, '4': 6, '5': 8, '6': 10, '7': 12, '8': 14, '9': 16,
      'q': 17, 'w': 15, 'e': 13, 'r': 11, 't': 9, 'y': 7, 'u': 5, 'i': 3,
    }''', '''    // 数字 1-7 = 中音 C4-B4（简谱 1-7，中央 1 = C4）
    // Q-P = 左侧 10 键（E4→B6，从内到外）
    // 数字 8-0/-/Z/X = 右侧高音（C5→F6）
    const keys: Record<string, number> = {
      '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
      'q': 3, 'w': 5, 'e': 7, 'r': 9, 't': 11, 'y': 13, 'u': 15, 'i': 17, 'o': 19, 'p': 21,
      '8': 8, '9': 10, '0': 12, '-': 14, '=': 16, 'z': 18, 'x': 20,
    }''')

s = s.replace('键盘：数字 1-9 = 中央与右侧 · Q-I = 左侧高音', '键盘：数字 1-7 中音 · Q-P 左侧 · 数字 8-0 与 Z X 右侧高音')

s = s.replace('''          <span>左手区域：高音区（短键）</span>
          <span className="text-zinc-300">|</span>
          <span>中央：中音</span>
          <span className="text-zinc-300">|</span>
          <span>右手区域：低音区（长键）</span>''', '''          <span>左侧 10 键：高音区（短键）</span>
          <span className="text-zinc-300">|</span>
          <span>中央 1 = C（最低音，最长键）</span>
          <span className="text-zinc-300">|</span>
          <span>右侧 10 键：中高音区</span>''')

s = s.replace('''// Standard 17-key C-major layout (player view, left to right):
//   Left 8 (outer→inner): E6 C6 A5 F5 D5 B4 G4 E4  — high register
//   Center: C4 (lowest, longest tine)
//   Right 8 (inner→outer): D4 F4 A4 C5 E5 G5 B5 D6  — mid to high''', '''// Standard 21-key C-major layout (player view, left to right):
//   Left 10 (outer→inner): B6 G6 E6 C6 A5 F5 D5 B4 G4 E4  — high register
//   Center: C4 = 1 (lowest, longest tine)
//   Right 10 (inner→outer): D4 F4 A4 C5 E5 G5 B5 D6 F6 A6  — mid to high''')

open(p, 'w', encoding='utf-8').write(s)
print('21 键重写完成')
