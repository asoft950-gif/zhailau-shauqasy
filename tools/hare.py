import math
from lib import *

POSES = ["idle", "attack"]
ORTHO = 2.0
ZC = 0.60
XC = 0.12


def build(team, pose):
    T = TEAMS[team]
    light = team == "w"
    fur_c = (0.74, 0.55, 0.34) if light else (0.26, 0.24, 0.25)
    belly_c = (0.96, 0.90, 0.78) if light else (0.50, 0.47, 0.46)
    dark_c = (0.45, 0.30, 0.17) if light else (0.10, 0.09, 0.10)
    fur = mat("fur", fur_c, rough=0.9, sss=0.12, bump=0.7, bscale=210, sheen=0.8, var=0.22, var_scale=5)
    belly = mat("belly", belly_c, rough=0.9, sss=0.12, bump=0.7, bscale=150, sheen=0.8)
    dark = mat("dark", dark_c, rough=0.9, bump=0.7, bscale=150, sheen=0.6)
    pink = mat("pink", (0.95, 0.62, 0.68), rough=0.5, sss=0.4)
    white = mat("white", (0.98, 0.97, 0.94), rough=0.95, bump=1.0, bscale=110, sheen=0.9)
    cloth = mat("cloth", T["cloth"], rough=0.7, bump=0.5, bscale=260, sheen=0.5)
    cloth2 = mat("cloth2", T["cloth2"], rough=0.7, bump=0.4, bscale=260)
    whisk = mat("whisk", (0.95, 0.95, 0.95), rough=0.4)

    atk = pose == "attack"
    lean = 0.20 if atk else 0.0
    root = empty(rot=(0, lean, 0))

    # body & haunches
    ell((-0.04, 0, 0.40), (0.44, 0.31, 0.35), fur, parent=root)
    ell((0.10, 0, 0.30), (0.30, 0.25, 0.22), belly, parent=root)
    for s in (-1, 1):
        ell((-0.20, 0.20 * s, 0.31), (0.30, 0.15, 0.27), fur, parent=root)
        ell((-0.02, 0.21 * s, 0.07), (0.31, 0.085, 0.07), dark, rot=(0, 0, 0.05 * s), parent=root)
        # front legs
        tube([(0.24, 0.12 * s, 0.30), (0.31, 0.12 * s, 0.14), (0.36, 0.11 * s, 0.05)],
             [0.075, 0.058, 0.05], fur, parent=root)
        ell((0.40, 0.11 * s, 0.045), (0.11, 0.06, 0.04), dark, parent=root)
    # tail
    ell((-0.46, 0, 0.42), (0.12, 0.11, 0.12), white, parent=root)

    # head group (can be pushed forward in attack)
    hx = 0.10 if atk else 0.0
    hz = -0.06 if atk else 0.0
    head = empty(loc=(hx, 0, hz), rot=(0, 0.30 if atk else 0.0, 0))
    head.parent = root
    # neck
    tube([(0.22, 0, 0.50), (0.32, 0, 0.60)], [0.19, 0.17], fur, parent=head, ends=False)
    ell((0.40, 0, 0.68), (0.25, 0.19, 0.21), fur, parent=head)
    ell((0.58, 0, 0.62), (0.15, 0.115, 0.10), belly, parent=head)
    ell((0.50, 0, 0.58), (0.14, 0.16, 0.09), belly, parent=head)
    ell((0.71, 0, 0.64), (0.035, 0.05, 0.03), pink, parent=head)
    # cheeks & whiskers
    for s in (-1, 1):
        for k, dz in enumerate((-0.015, 0.0, 0.02)):
            tube([(0.60, 0.07 * s, 0.61 + dz), (0.72, 0.19 * s, 0.62 + dz * 2.5 + 0.03),
                  (0.80, 0.27 * s, 0.60 + dz * 3)], [0.004, 0.003, 0.002], whisk, parent=head, ends=False)
        eye((0.53, 0.14 * s, 0.725), 0.050, parent=head, iris=(0.08, 0.04, 0.02))
        # brow
        ell((0.51, 0.13 * s, 0.775), (0.07, 0.04, 0.02), fur, rot=(0, 0.2, 0.4 * s * (1 if atk else 0.3)), parent=head)
    # ears
    back = 1.15 if atk else 0.22
    for s in (-1, 1):
        ear = empty(loc=(0.30, 0.09 * s, 0.84), rot=(-0.34 * s, -back, 0.0))
        ear.parent = head
        ell((0, 0, 0.27), (0.055, 0.032, 0.30), fur, parent=ear)
        ell((0.015, 0.0, 0.26), (0.035, 0.018, 0.24), pink, parent=ear)
        ell((0, 0, 0.48), (0.045, 0.028, 0.10), dark, parent=ear)
    # scarf (team colour) around the neck
    ring((0.27, 0, 0.55), 0.20, 0.045, cloth, rot=(0, 0.55, 0), parent=head)
    ell((0.40, 0.13, 0.50), (0.07, 0.06, 0.07), cloth, parent=head)
    tube([(0.40, 0.14, 0.50), (0.28, 0.20, 0.36), (0.12, 0.24, 0.28)], [0.045, 0.04, 0.025], cloth, parent=head)
    tube([(0.28, 0.12, 0.34), (0.22, 0.16, 0.24)], [0.022, 0.02], cloth2, parent=head, ends=False)
    return root
