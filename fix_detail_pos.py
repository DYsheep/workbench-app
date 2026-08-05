# 修复：详情区从 search 视图块内移到块外（收藏详情共用区）
lines = open(r'C:\project\工作台\workbench-app\src\pages\Drugs.tsx', encoding='utf-8').read().split('\n')

# 详情区起点（0-based）
idx_start = next(i for i, l in enumerate(lines) if '详情区（搜索与收藏共用渲染' in l)
# 详情区终点：找 '数据来自万维易源' 行，之后是 </div> 和 )}
idx_footer = next(i for i, l in enumerate(lines) if '数据来自万维易源' in l)
idx_end = idx_footer + 2  # </div> +1, )} +2
assert lines[idx_end].strip() == ')}', repr(lines[idx_end])

# search 块闭合在 idx_end 之后：</> 和 )}
assert lines[idx_end + 1].strip() == '</>', repr(lines[idx_end + 1])
assert lines[idx_end + 2].strip() == ')}', repr(lines[idx_end + 2])

detail_block = lines[idx_start:idx_end + 1]
# 从 search 块内删除详情区
lines = lines[:idx_start] + lines[idx_end + 1:]
# 现在 </> 和 )} 位于 idx_start 与 idx_start+1
# 在 )}（search 闭合）之后插入详情区
lines = lines[:idx_start + 2] + detail_block + lines[idx_start + 2:]

open(r'C:\project\工作台\workbench-app\src\pages\Drugs.tsx', 'w', encoding='utf-8').write('\n'.join(lines))
print('修复完成：详情区已在 search 块外')
