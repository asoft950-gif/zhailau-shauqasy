import math
from mathutils import Vector
from lib import *

POSES = ["idle", "windup", "slash"]
ORTHO = 3.4
ZC = 1.2
XC = 0.15

SWORD = {"idle": 0.30, "windup": -1.25, "slash": 1.95}


def build(team, pose):
    T = TEAMS[team]
    sun = team == "w"
    steel_c = (0.80, 0.82, 0.84) if sun else (0.20, 0.22, 0.27)
    trim_c = (0.97, 0.76, 0.24) if sun else (0.72, 0.78, 0.92)
    steel = mat("steel", steel_c, rough=0.28, metal=1.0, bump=0.1, bscale=200)
    trim = mat("trim", trim_c, rough=0.22, metal=1.0)
    mail = mat("mail", tuple(c * 0.75 for c in steel_c), rough=0.45, metal=1.0, bump=1.2, bscale=380)
    skin = mat("skin", (0.80, 0.58, 0.42), rough=0.55, sss=0.35, bump=0.2, bscale=400)
    cloth = mat("cloth", T["cloth"], rough=0.72, bump=0.5, bscale=380, sheen=0.6)
    cloth2 = mat("cloth2", T["cloth2"], rough=0.72, bump=0.4, bscale=380, sheen=0.5)
    leather = mat("leather", (0.20, 0.11, 0.06), rough=0.45, bump=0.3, bscale=220, coat=0.3)
    pants = mat("pants", (0.13, 0.11, 0.10), rough=0.8, bump=0.4, bscale=300)
    hair = mat("hair", (0.05, 0.035, 0.03), rough=0.6, bump=0.5, bscale=300)
    black = mat("black", (0.01, 0.01, 0.01), rough=0.1)
    blade = mat("blade", (0.88, 0.91, 0.94), rough=0.12, metal=1.0)

    root = empty()
    # ---- legs & boots
    for s in (-1, 1):
        y = 0.115 * s
        tube([(0.0, y, 0.95), (0.03, y, 0.55), (0.05, y, 0.20)], [0.125, 0.10, 0.095], pants, parent=root, ends=False)
        tube([(0.05, y, 0.42), (0.06, y, 0.12)], [0.108, 0.115], leather, parent=root, ends=False)
        ell((0.13, y, 0.085), (0.19, 0.095, 0.09), leather, parent=root)
        ell((0.27, y, 0.06), (0.07, 0.07, 0.06), leather, rot=(0, -0.3, 0), parent=root)
    # ---- tunic skirt, hem, torso
    cone((0, 0, 0.82), 0.37, 0.26, 0.58, cloth, parent=root)
    ring((0, 0, 0.54), 0.368, 0.025, cloth2, parent=root)
    ring((0, 0, 0.60), 0.355, 0.012, trim, parent=root)
    ell((0.0, 0, 1.28), (0.25, 0.31, 0.45), cloth, parent=root)
    ell((0.07, 0, 1.38), (0.20, 0.275, 0.31), steel, parent=root)
    ell((0.22, 0, 1.45), (0.03, 0.10, 0.12), trim, parent=root)
    for k in range(3):
        ring((0.06, 0, 1.20 + 0.10 * k), 0.255 - 0.012 * k, 0.012, trim, parent=root, n=20)
    ring((0, 0, 1.02), 0.255, 0.04, leather, parent=root)
    ell((0.26, 0, 1.02), (0.05, 0.05, 0.045), trim, parent=root)
    # ---- cape
    ell((-0.24, 0, 1.18), (0.045, 0.31, 0.70), cloth2, rot=(0, -0.10, 0), parent=root)
    ring((-0.17, 0, 1.62), 0.20, 0.03, cloth2, rot=(0, 1.2, 0), parent=root)
    # ---- shoulders
    for s in (-1, 1):
        ell((0.0, 0.345 * s, 1.60), (0.16, 0.14, 0.12), steel, parent=root)
        ring((0.0, 0.345 * s, 1.60), 0.15, 0.012, trim, rot=(1.57, 0, 0), parent=root, n=20)
    # ---- far arm (resting)
    tube([(0.0, 0.36, 1.55), (0.06, 0.42, 1.28), (0.18, 0.36, 1.08)], [0.085, 0.07, 0.065], cloth, parent=root)
    ell((0.20, 0.35, 1.04), (0.07, 0.06, 0.07), skin, parent=root)
    ell((0.07, 0.40, 1.28), (0.09, 0.075, 0.10), mail, parent=root)
    # ---- sword arm (near camera, y < 0)
    ang = SWORD[pose]
    if pose == "windup":
        hand = Vector((-0.12, -0.46, 1.78))
        elbow = Vector((-0.08, -0.52, 1.60))
    elif pose == "slash":
        hand = Vector((0.46, -0.40, 1.26))
        elbow = Vector((0.18, -0.50, 1.35))
    else:
        hand = Vector((0.30, -0.42, 1.28))
        elbow = Vector((0.12, -0.50, 1.32))
    sh = Vector((0.0, -0.36, 1.55))
    tube([tuple(sh), tuple(elbow), tuple(hand)], [0.09, 0.075, 0.062], cloth, parent=root)
    ell(tuple((sh + elbow) / 2), (0.10, 0.085, 0.11), mail, parent=root)
    ell(tuple(hand), (0.07, 0.07, 0.07), skin, parent=root)
    sw = empty(loc=tuple(hand), rot=(0, ang, 0))
    sw.parent = root
    cone((0, 0, 0.0), 0.022, 0.02, 0.20, leather, parent=sw)
    ell((0, 0, -0.11), (0.04, 0.04, 0.04), trim, parent=sw)
    box((0, 0, 0.115), (0.05, 0.22, 0.035), trim, parent=sw, bevel=0.012)
    box((0.0, 0, 0.62), (0.045, 0.012, 0.95), blade, parent=sw, bevel=0.005)
    ell((0.0, 0, 1.095), (0.022, 0.008, 0.07), blade, parent=sw)
    box((0.0, 0.0, 0.62), (0.046, 0.016, 0.50), steel, parent=sw, bevel=0.004)
    # ---- neck & head
    tube([(0.02, 0, 1.58), (0.03, 0, 1.70)], [0.115, 0.10], skin, parent=root, ends=False)
    ell((0.03, 0, 1.84), (0.175, 0.16, 0.18), skin, parent=root)
    ell((0.17, 0, 1.80), (0.045, 0.04, 0.05), skin, parent=root)
    tube([(0.145, -0.065, 1.735), (0.175, -0.02, 1.715), (0.175, 0.02, 1.715), (0.145, 0.065, 1.735)],
         [0.018, 0.02, 0.02, 0.018], hair, parent=root)
    for s in (-1, 1):
        ell((0.13, 0.085 * s, 1.87), (0.04, 0.032, 0.032), black, parent=root)
        ell((0.115, 0.10 * s, 1.915), (0.07, 0.03, 0.016), hair, rot=(0, 0.1, 0.35 * s * -1), parent=root)
        ell((0.10, 0.165 * s, 1.80), (0.05, 0.03, 0.06), skin, parent=root)
    # ---- helmet (spiked dome, aventail, nose guard, plume)
    ell((0.0, 0, 1.95), (0.205, 0.195, 0.16), steel, parent=root)
    ring((0.0, 0, 1.915), 0.198, 0.026, trim, parent=root)
    cone((0, 0, 2.20), 0.04, 0.004, 0.24, trim, parent=root)
    ell((0, 0, 2.08), (0.045, 0.045, 0.045), trim, parent=root)
    box((0.205, 0, 1.86), (0.02, 0.04, 0.16), steel, parent=root, bevel=0.006)
    cone((-0.05, 0, 1.76), 0.27, 0.205, 0.22, mail, parent=root)
    tube([(0.0, 0, 2.16), (-0.18, 0, 2.20), (-0.38, 0, 2.08), (-0.50, 0, 1.88)],
         [0.04, 0.055, 0.05, 0.035], cloth, parent=root)
    tube([(-0.50, 0, 1.88), (-0.52, 0, 1.72)], [0.03, 0.02], cloth2, parent=root)
    return root
