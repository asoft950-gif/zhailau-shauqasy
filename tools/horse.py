import math
from lib import *

POSES = ["stand", "rear", "jump"]
ORTHO = 3.2
ZC = 1.12
XC = 0.2


def build(team, pose):
    T = TEAMS[team]
    sun = team == "w"
    coat_c = (0.72, 0.47, 0.19) if sun else (0.075, 0.065, 0.07)
    hair_c = (0.93, 0.87, 0.70) if sun else (0.02, 0.02, 0.025)
    hoof_c = (0.30, 0.22, 0.15) if sun else (0.04, 0.04, 0.045)
    coat = mat("coat", coat_c, rough=0.42, sss=0.08, bump=0.12, bscale=320, sheen=0.35, var=0.18, var_scale=3.5, spec=0.55)
    hair = mat("hair", hair_c, rough=0.55, bump=0.5, bscale=260, sheen=0.5)
    hoof = mat("hoof", hoof_c, rough=0.25, coat=0.5)
    muzzle = mat("muz", (0.16, 0.12, 0.11) if sun else (0.10, 0.09, 0.09), rough=0.5, sss=0.1)
    nostril = mat("nos", (0.03, 0.02, 0.02), rough=0.4)
    cloth = mat("cloth", T["cloth"], rough=0.7, bump=0.45, bscale=300, sheen=0.5)
    cloth2 = mat("cloth2", T["cloth2"], rough=0.7, bump=0.4, bscale=300)
    leather = mat("leather", (0.28, 0.15, 0.07), rough=0.45, bump=0.25, bscale=200, coat=0.3)
    gold = mat("gold", (0.95, 0.72, 0.22), rough=0.25, metal=1.0)

    PX = -0.45
    rear = pose == "rear"
    jump = pose == "jump"
    pitch = -0.62 if rear else (-0.12 if jump else 0.0)
    root = empty(loc=(PX, 0, 0), rot=(0, pitch, 0))

    def L(x, y, z):
        return (x - PX, y, z)

    # ---- body
    ell(L(-0.02, 0, 1.05), (0.60, 0.30, 0.31), coat, parent=root)
    ell(L(0.38, 0, 1.08), (0.27, 0.27, 0.34), coat, parent=root)
    ell(L(-0.42, 0, 1.08), (0.30, 0.29, 0.33), coat, parent=root)
    ell(L(0.10, 0, 0.90), (0.45, 0.24, 0.20), coat, parent=root)
    # ---- neck
    tube([L(0.50, 0, 1.16), L(0.66, 0, 1.42), L(0.80, 0, 1.70)], [0.23, 0.17, 0.125], coat, parent=root, ends=False)
    ell(L(0.62, 0, 1.30), (0.20, 0.15, 0.27), coat, rot=(0, 0.45, 0), parent=root)
    # ---- head
    head = empty(loc=L(0.0, 0, 0.0))
    head.parent = root
    ell((0.93, 0, 1.80), (0.28, 0.12, 0.155), coat, rot=(0, 0.55, 0), parent=head)
    ell((0.86, 0, 1.72), (0.17, 0.125, 0.14), coat, rot=(0, 0.3, 0), parent=head)
    ell((1.10, 0, 1.63), (0.135, 0.10, 0.095), muzzle, rot=(0, 0.55, 0), parent=head)
    for s in (-1, 1):
        ell((1.19, 0.052 * s, 1.655), (0.028, 0.02, 0.03), nostril, rot=(0, 0.5, 0), parent=head)
        eye((0.90, 0.108 * s, 1.845), 0.048, parent=head, iris=(0.14, 0.07, 0.03))
        ell((0.90, 0.10 * s, 1.885), (0.06, 0.04, 0.02), coat, rot=(0, 0.2, 0), parent=head)
        cone((0.79, 0.065 * s, 1.995), 0.042, 0.006, 0.20, coat, rot=(0.18 * s * -1, -0.28, 0), parent=head)
    tube([(0.80, 0, 1.97), (0.90, 0, 1.93), (0.97, 0, 1.84)], [0.03, 0.032, 0.02], hair, parent=head, ends=False)
    # halter in team colour
    ring((1.04, 0, 1.69), 0.105, 0.012, cloth, rot=(0, 0.5 + math.pi / 2, 0), parent=head)
    tube([(0.88, 0.12, 1.72), (1.00, 0.108, 1.70)], [0.011, 0.011], cloth, parent=head, ends=False)
    tube([(0.88, -0.12, 1.72), (1.00, -0.108, 1.70)], [0.011, 0.011], cloth, parent=head, ends=False)
    # ---- mane + tail
    tube([L(0.50, 0, 1.40), L(0.64, 0, 1.64), L(0.78, 0, 1.92)], [0.075, 0.07, 0.05], hair, parent=root, ends=False)
    for i, (x, z) in enumerate([(0.54, 1.40), (0.62, 1.55), (0.70, 1.70), (0.77, 1.85)]):
        tube([L(x - 0.02, 0.03, z + 0.05), L(x - 0.08, -0.10, z - 0.05), L(x - 0.12, -0.15, z - 0.16)],
             [0.04, 0.033, 0.012], hair, parent=root, ends=False)
    for k, yy in enumerate((-0.05, 0.0, 0.05)):
        tube([L(-0.68, yy, 1.18), L(-0.92 - k * 0.02, yy * 2, 0.96), L(-0.98 - k * 0.03, yy * 3, 0.52 - k * 0.04)],
             [0.075, 0.07, 0.02], hair, parent=root, ends=False)

    # ---- legs
    def leg(pts, rad, parent):
        tube([L(*p) for p in pts], rad, coat, parent=parent, ends=False)

    for s in (-1, 1):
        y = 0.165 * s
        # front
        if rear or jump:
            fl = [(0.34, y, 0.98), (0.52, y, 0.84), (0.66, y, 0.93), (0.74, y, 0.72), (0.77, y, 0.62)]
            fr = [0.115, 0.085, 0.067, 0.046, 0.05]
            hoof_at = (0.78, y, 0.57)
            hoof_rot = (0, 0.25, 0)
        else:
            fl = [(0.34, y, 0.98), (0.37, y, 0.62), (0.37, y, 0.50), (0.385, y, 0.20), (0.40, y, 0.10)]
            fr = [0.115, 0.075, 0.064, 0.046, 0.05]
            hoof_at = (0.405, y, 0.045)
            hoof_rot = (0, 0, 0)
        leg(fl, fr, root)
        cone(L(*hoof_at), 0.066, 0.052, 0.10, hoof, rot=hoof_rot, parent=root)
        # hind
        if jump:
            hl = [(-0.36, y, 1.00), (-0.62, y, 0.82), (-0.80, y, 0.66), (-0.97, y, 0.58), (-1.02, y, 0.55)]
            hh = (-1.07, y, 0.52)
            hrot = (0, 1.2, 0)
        else:
            hl = [(-0.36, y, 1.00), (-0.50, y, 0.62), (-0.52, y, 0.47), (-0.47, y, 0.18), (-0.45, y, 0.10)]
            hh = (-0.445, y, 0.045)
            hrot = (0, 0, 0)
        leg(hl, [0.145, 0.088, 0.066, 0.046, 0.05], root)
        cone(L(*hh), 0.068, 0.054, 0.10, hoof, rot=hrot, parent=root)

    # ---- saddle cloth, saddle (team colours)
    ell(L(-0.04, 0, 1.06), (0.31, 0.318, 0.326), cloth, parent=root)
    ell(L(-0.04, 0, 1.06), (0.13, 0.322, 0.330), cloth2, parent=root)
    ell(L(-0.04, 0, 1.33), (0.23, 0.19, 0.075), leather, parent=root)
    ell(L(0.14, 0, 1.38), (0.07, 0.10, 0.08), leather, parent=root)
    ell(L(-0.04, 0.31, 0.80), (0.05, 0.03, 0.05), gold, parent=root)
    ell(L(-0.04, -0.31, 0.80), (0.05, 0.03, 0.05), gold, parent=root)
    return root
