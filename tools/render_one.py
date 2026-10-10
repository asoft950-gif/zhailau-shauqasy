"""usage: python render_one.py <char> <team> <pose> <out.png> [samples] [size]"""
import importlib
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

char, team, pose, out = sys.argv[1:5]
samples = int(sys.argv[5]) if len(sys.argv) > 5 else 32
size = int(sys.argv[6]) if len(sys.argv) > 6 else 256

lib.reset()
mod = importlib.import_module(char)
lib.setup_scene(size=size, samples=samples, ortho=getattr(mod, "ORTHO", 2.9),
                zc=getattr(mod, "ZC", 0.98), xc=getattr(mod, "XC", 0.0))
mod.build(team, pose)
t = time.time()
lib.render(out)
ax, ay = lib.anchor_px(size)
print(json.dumps({"char": char, "team": team, "pose": pose, "anchor": [ax, ay],
                  "ortho": getattr(mod, "ORTHO", 2.9), "s": round(time.time() - t, 1)}))
