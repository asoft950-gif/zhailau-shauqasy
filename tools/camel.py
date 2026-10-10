import math
from lib import *

POSES = ["stand", "step"]
ORTHO = 3.3
ZC = 1.05
XC = 0.3


def build(team, pose):
    T = TEAMS[team]
    sun = team == "w"
    fur_c = (0.74, 0.57, 0.34) if sun else (0.21, 0.14, 0.10)
    dark_c = (0.46, 0.33, 0.18) if sun else (0.08, 0.055, 0.04)
    pale_c = (0.88, 0.76, 0.55) if sun else (0.30, 0.22, 0.16)
    fur = mat("fur", fur_c, rough=0.85, sss=0.1, bump=0.55, bscale=130, sheen=0.7, var=0.28, var_scale=4)
    furd = mat("furd", dark_c, rough=0.9, bump=0.8, bscale=90, sheen=0.7, var=0.3, var_scale=6)
    pale = mat("pale", pale_c, rough=0.85, sss=0.1, bump=0.5, bscale=140, sheen=0.7)
    pad = mat("pad", (0.28, 0.22, 0.20), rough=0.7, bump=0.3, bscale=120)
    nos = mat("nos", (0.04, 0.03, 0.03), rough=0.5)
    cloth = mat("cloth", T["cloth"], rough=0.75, bump=0.5, bscale=330, sheen=0.6)
    cloth2 = mat("cloth2", T["cloth2"], rough=0.75, bump=0.4, bscale=330)
    gold = mat("gold", (0.95, 0.72, 0.22), rough=0.25, metal=1.0)

    root = empty()
    step = pose == "step"

    # barrel, chest, rump, belly
    ell((0, 0, 1.05), (0.72, 0.34, 0.36), fur, parent=root)
    ell((0.58, 0, 1.12), (0.30, 0.28, 0.34), fur, parent=root)
    ell((-0.55, 0, 1.08), (0.30, 0.30, 0.34), fur, parent=root)
    ell((0.0, 0, 0.86), (0.58, 0.28, 0.21), pale, parent=root)
    # humps
    ell((-0.20, 0, 1.46), (0.23, 0.22, 0.30), furd, parent=root)
    ell((0.30, 0, 1.45), (0.23, 0.22, 0.30), furd, parent=root)
    # neck (S curve) + throat fur
    tube([(0.62, 0, 1.14), (0.90, 0, 1.30), (0.92, 0, 1.62), (1.04, 0, 1.84)],
         [0.20, 0.15, 0.12, 0.11], fur, parent=root, ends=False)
    ell((0.86, 0, 1.38), (0.12, 0.11, 0.22), furd, rot=(0, 0.2, 0), parent=root)
    ell((0.98, 0, 1.70), (0.09, 0.09, 0.2), furd, rot=(0, 0.25, 0), parent=root)
    # head
    ell((1.14, 0, 1.90), (0.26, 0.13, 0.14), fur, rot=(0, 0.35, 0), parent=root)
    ell((1.34, 0, 1.82), (0.14, 0.115, 0.10), pale, rot=(0, 0.35, 0), parent=root)
    ell((1.22, 0, 1.93), (0.05, 0.10, 0.07), furd, parent=root)
    for s in (-1, 1):
        ell((1.45, 0.045 * s, 1.84), (0.028, 0.02, 0.03), nos, rot=(0, 0.4, 0), parent=root)
        eye((1.10, 0.105 * s, 1.95), 0.046, parent=root, iris=(0.12, 0.06, 0.03))
        ell((1.10, 0.10 * s, 1.995), (0.065, 0.04, 0.02), fur, rot=(0, 0.2, 0), parent=root)
        ell((0.99, 0.09 * s, 2.04), (0.05, 0.03, 0.075), fur, rot=(0.3 * -s, 0, 0), parent=root)
    ring((1.30, 0, 1.84), 0.11, 0.014, cloth2, rot=(0, 0.35 + math.pi / 2, 0), parent=root)
    # legs
    for xf in (0.52, -0.52):
        for s in (-1, 1):
            y = 0.20 * s
            lift_x, lift_z = 0.0, 0.0
            if step and ((xf > 0 and s == -1) or (xf < 0 and s == 1)):
                lift_x = 0.24 if xf > 0 else -0.20
                lift_z = 0.14
            pts = [(xf, y, 1.02), (xf + 0.02, y, 0.55), (xf + 0.02 + lift_x * 0.5, y, 0.50 + lift_z * 0.5),
                   (xf + 0.02 + lift_x, y, 0.20 + lift_z), (xf + 0.04 + lift_x, y, 0.10 + lift_z)]
            tube(pts, [0.16, 0.08, 0.072, 0.058, 0.06], fur, parent=root, ends=False)
            ell((xf + 0.02 + lift_x * 0.5, y + 0.02 * s, 0.50 + lift_z * 0.5), (0.075, 0.07, 0.085), furd, parent=root)
            ell((xf + 0.07 + lift_x, y, 0.05 + lift_z), (0.15, 0.115, 0.055), pad, parent=root)
    # tail
    tube([(-0.80, 0, 1.18), (-0.92, 0, 0.95), (-0.93, 0, 0.72)], [0.045, 0.04, 0.03], furd, parent=root)
    ell((-0.93, 0, 0.64), (0.06, 0.05, 0.11), furd, parent=root)
    # blanket in team colours + tassels
    ell((0.05, 0, 1.05), (0.30, 0.352, 0.374), cloth, parent=root)
    ell((0.05, 0, 1.05), (0.11, 0.357, 0.379), cloth2, parent=root)
    ell((0.05, 0, 1.30), (0.30, 0.27, 0.12), cloth, parent=root)
    for s in (-1, 1):
        for dx in (-0.12, 0.0, 0.12):
            tube([(0.05 + dx, 0.355 * s, 0.82), (0.05 + dx, 0.37 * s, 0.70)], [0.025, 0.02], cloth2, parent=root, ends=True)
    return root
