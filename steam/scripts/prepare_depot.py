# -*- coding: utf-8 -*-
"""
准备 Steam depot 内容目录。

用法:
    python prepare_depot.py [AppID]

优先级:
  1. 复制 electron-builder 产物 dist/win-unpacked/
  2. 否则解压 dist/*.zip
结果写入本脚本同级的 depot/ 目录，并生成 steam_appid.txt（开发期本地测试用，
上传时会被 depot_build 脚本自动排除）。
"""
import os, shutil, sys, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)                      # F:\游戏开发
DEPOT = os.path.join(HERE, 'depot')


def find_source():
    # 1) 本目录 / 项目目录下的 win-unpacked
    for cand in [os.path.join(HERE, 'win-unpacked'),
                 os.path.join(PROJ, 'dist', 'win-unpacked'),
                 r'C:\sw-build\dist\win-unpacked']:
        if os.path.isdir(cand):
            return cand, 'dir'
    # 2) 任意 Setup zip
    for cand in [os.path.join(PROJ, 'dist')] + [HERE]:
        if os.path.isdir(cand):
            for f in sorted(os.listdir(cand)):
                if f.endswith('.zip') and 'Setup' in f:
                    return os.path.join(cand, f), 'zip'
    return None, None


def main():
    appid = sys.argv[1] if len(sys.argv) > 1 else '480'
    src, kind = find_source()
    if not src:
        sys.exit('未找到构建产物：请先运行 electron-builder 生成 dist/win-unpacked，'
                 '或把 Setup zip 放到 dist/ 目录。')
    print(f'源: {src}  ({kind})')

    if os.path.isdir(DEPOT):
        shutil.rmtree(DEPOT)
    os.makedirs(DEPOT)

    if kind == 'dir':
        shutil.copytree(src, DEPOT, dirs_exist_ok=True)
    else:
        with zipfile.ZipFile(src) as z:
            z.extractall(DEPOT)

    # 开发期本地测试用（上传时被排除）
    with open(os.path.join(DEPOT, 'steam_appid.txt'), 'w') as f:
        f.write(appid)

    n, total = 0, 0
    for root, _, files in os.walk(DEPOT):
        for f in files:
            n += 1
            total += os.path.getsize(os.path.join(root, f))
    print(f'depot 就绪: {DEPOT}')
    print(f'  文件数 {n}, 共 {total/1024/1024:.0f} MB, appid={appid}')
    # 关键文件自检
    exes = [f for f in os.listdir(DEPOT) if f.endswith('.exe')]
    print('  主程序:', exes[:3])


if __name__ == '__main__':
    main()
