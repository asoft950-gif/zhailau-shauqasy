import math
from mathutils import Vector
from lib import *

POSES = ["idle", "strike", "pull"]
ORTHO = 3.0
ZC = 0.85
XC = 0.15


def align_euler(direction, up="Y"):
    return Vector(direction).normalized().to_track_quat("Z", up).to_euler()


def build(team, pose):
    T = TEAMS[team]
    sun = team == "w"
    if sun:
        skin = scales_mat("skin", (0.62, 0.50, 0.24), (0.30, 0.18, 0.07), (0.9, 0.85, 0.6))
    else:
        skin = scales_mat("skin", (0.07, 0.09, 0.14), (0.16, 0.38, 0.55), (0.3, 0.3, 0.35))
    cloth = mat("cloth", T["cloth"], rough=0.7, bump=0.4, bscale=300, sheen=0.5)
    cloth2 = mat("cloth2", T["cloth2"], rough=0.7)
    tongue = mat("tongue", (0.85, 0.08, 0.14), rough=0.4)
    amber = mat("amber", (0.98, 0.78, 0.12), rough=0.12, coat=1.0)
    black = mat("black", (0.01, 0.01, 0.01), rough=0.1)
    gold = mat("gold", (0.95, 0.72, 0.22), rough=0.25, metal=1.0)

    root = empty()
    pts, rad = [], []
    turns = 2.75
    n = 34
    for i in range(n):
        t = i / (n - 1)
        a = math.pi + t * turns * math.tau
        r = 0.56 - 0.16 * t
        z = 0.12 + 0.40 * t
        pts.append((r * math.cos(a), r * math.sin(a), z))
        rad.append(0.035 + 0.14 * min(1.0, t / 0.25))
    # coil ends near angle pi (back side, x<0): continue into the neck
    last = pts[-1]
    if pose == "strike":
        neck = [(-0.30, 0.0, 0.70), (-0.05, 0.0, 0.86), (0.35, 0.0, 0.96), (0.75, 0.0, 0.92)]
        head = Vector((0.98, 0.0, 0.84))
        pitch = 0.35
    elif pose == "pull":
        neck = [(-0.36, 0.0, 0.88), (-0.46, 0.0, 1.14), (-0.30, 0.0, 1.36), (-0.04, 0.0, 1.42)]
        head = Vector((0.18, 0.0, 1.36))
        pitch = 0.45
    else:
        neck = [(-0.34, 0.0, 0.84), (-0.30, 0.0, 1.05), (-0.04, 0.0, 1.24), (0.22, 0.0, 1.42)]
        head = Vector((0.46, 0.0, 1.46))
        pitch = 0.25
    for p in neck:
        pts.append(p)
        rad.append(0.145)
    rad[-1] = 0.115
    rad[-2] = 0.13
    tube(pts, rad, skin, res=14, parent=root, ends=True)

    # head (wedge shaped, flattened)
    hd = empty(loc=tuple(head), rot=(0, pitch, 0))
    hd.parent = root
    ell((0, 0, 0), (0.25, 0.155, 0.105), skin, parent=hd)
    ell((0.15, 0, -0.02), (0.14, 0.11, 0.07), skin, parent=hd)
    for s in (-1, 1):
        ell((0.08, 0.12 * s, 0.07), (0.075, 0.06, 0.045), skin, parent=hd)
        ell((0.09, 0.115 * s, 0.075), (0.052, 0.052, 0.052), amber, parent=hd)
        ell((0.115, 0.145 * s, 0.078), (0.012, 0.018, 0.04), black, parent=hd)
        ell((0.27, 0.035 * s, 0.01), (0.012, 0.012, 0.012), black, parent=hd)
    # forked tongue
    tube([(0.26, 0, -0.03), (0.38, 0, -0.04), (0.46, 0.03, -0.04)], [0.012, 0.01, 0.006], tongue, parent=hd, ends=False)
    tube([(0.40, 0, -0.04), (0.47, -0.03, -0.04)], [0.009, 0.005], tongue, parent=hd, ends=False)
    # team collar around the neck, gold clasp
    c0 = Vector(neck[-2])
    c1 = Vector(neck[-1])
    tan = (c1 - c0)
    ring(tuple(c0.lerp(c1, 0.4)), 0.17, 0.035, cloth, rot=tuple(align_euler(tan)), parent=root)
    ring(tuple(c0.lerp(c1, 0.4)), 0.17, 0.014, cloth2, rot=tuple(align_euler(tan)), parent=root)
    return root
