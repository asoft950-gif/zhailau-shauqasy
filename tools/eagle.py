import math
from mathutils import Vector
from lib import *

POSES = ["fold", "half", "spread", "dive"]
ORTHO = 4.0
ZC = 1.25
XC = 0.0


def build(team, pose):
    T = TEAMS[team]
    sun = team == "w"
    body_c = (0.46, 0.30, 0.13) if sun else (0.10, 0.08, 0.07)
    wing_c = (0.40, 0.26, 0.11) if sun else (0.07, 0.06, 0.06)
    tip_c = (0.20, 0.12, 0.06) if sun else (0.03, 0.03, 0.035)
    nape_c = (0.93, 0.72, 0.34) if sun else (0.42, 0.30, 0.13)
    chest_c = (0.62, 0.46, 0.25) if sun else (0.20, 0.15, 0.11)
    body = mat("body", body_c, rough=0.62, bump=0.6, bscale=110, sheen=0.5, var=0.3, var_scale=5)
    wing = mat("wing", wing_c, rough=0.6, bump=0.6, bscale=90, sheen=0.4, var=0.25, var_scale=4)
    tips = mat("tips", tip_c, rough=0.6, bump=0.5, bscale=90)
    nape = mat("nape", nape_c, rough=0.62, bump=0.6, bscale=120, sheen=0.5, var=0.2, var_scale=6)
    chest = mat("chest", chest_c, rough=0.62, bump=0.6, bscale=120, sheen=0.5)
    yellow = mat("yellow", (0.95, 0.72, 0.16), rough=0.45, bump=0.3, bscale=160, sss=0.2)
    horn = mat("horn", (0.18, 0.14, 0.10), rough=0.3, coat=0.4)
    beak = mat("beak", (0.80, 0.62, 0.20), rough=0.3, coat=0.4)
    amber = mat("amber", (0.98, 0.62, 0.05), rough=0.1, coat=1.0, spec=1.0)
    black = mat("black", (0.01, 0.01, 0.01), rough=0.1)
    cloth = mat("cloth", T["cloth"], rough=0.7, bump=0.4, bscale=300, sheen=0.5)
    cloth2 = mat("cloth2", T["cloth2"], rough=0.7)
    gold = mat("gold", (0.97, 0.76, 0.24), rough=0.22, metal=1.0)

    dive = pose == "dive"
    pitch = 0.55 if dive else 0.0
    PZ = 0.9
    root = empty(loc=(0, 0, PZ), rot=(0, pitch, 0))

    def L(x, y, z):
        return (x, y, z - PZ)

    # ---- body
    ell(L(0.0, 0, 0.92), (0.33, 0.27, 0.56), body, rot=(0, 0.12, 0), parent=root)
    ell(L(0.14, 0, 0.98), (0.21, 0.21, 0.42), chest, rot=(0, 0.1, 0), parent=root)
    for s in (-1, 1):
        ell(L(0.02, 0.15 * s, 0.50), (0.17, 0.13, 0.22), body, parent=root)
    # ---- neck & head
    tube([L(0.04, 0, 1.30), L(0.12, 0, 1.50)], [0.18, 0.15], nape, parent=root, ends=False)
    ell(L(0.16, 0, 1.60), (0.20, 0.17, 0.19), nape, parent=root)
    ell(L(0.09, 0, 1.52), (0.2, 0.2, 0.2), nape, parent=root)
    ell(L(0.12, 0, 1.66), (0.15, 0.14, 0.12), body, parent=root)
    # beak
    tube([L(0.30, 0, 1.58), L(0.43, 0, 1.55), L(0.51, 0, 1.45)], [0.082, 0.062, 0.016], beak, parent=root, ends=False)
    ell(L(0.30, 0, 1.58), (0.08, 0.085, 0.07), yellow, parent=root)
    tube([L(0.47, 0, 1.51), L(0.52, 0, 1.43)], [0.03, 0.013], horn, parent=root, ends=False)
    for s in (-1, 1):
        ell(L(0.205, 0.13 * s, 1.63), (0.055, 0.055, 0.055), amber, parent=root)
        pv = Vector((0.7, 0.7 * s, 0.0)).normalized() * 0.05
        ell(L(0.205 + pv.x, 0.13 * s + pv.y, 1.63), (0.025, 0.025, 0.025), black, parent=root)
        ell(L(0.19, 0.125 * s, 1.705), (0.10, 0.06, 0.03), nape, rot=(0, 0.35, -0.5 * s), parent=root)
    # crown
    crown_rot = (0, 0.05, 0)
    ring(L(0.13, 0, 1.78), 0.125, 0.018, gold, rot=crown_rot, parent=root)
    for i in range(7):
        a = i / 7 * math.tau
        cone(L(0.13 + 0.125 * math.cos(a), 0.125 * math.sin(a), 1.82), 0.022, 0.003, 0.09, gold, parent=root)
    # ---- team collar & jesses
    ring(L(0.07, 0, 1.36), 0.19, 0.035, cloth, rot=(0, 0.25, 0), parent=root)
    ring(L(0.07, 0, 1.36), 0.19, 0.012, cloth2, rot=(0, 0.25, 0), parent=root)
    tube([L(0.22, -0.12, 1.30), L(0.28, -0.16, 1.12), L(0.30, -0.15, 0.98)], [0.03, 0.028, 0.012], cloth, parent=root)
    # ---- legs & talons
    for s in (-1, 1):
        y = 0.115 * s
        if dive:
            pts = [L(0.05, y, 0.62), L(0.20, y, 0.45), L(0.42, y, 0.38)]
            foot = (0.46, y, 0.36)
        else:
            pts = [L(0.02, y, 0.62), L(0.04, y, 0.30), L(0.06, y, 0.075)]
            foot = (0.08, y, 0.05)
        tube(pts, [0.075, 0.056, 0.05], yellow, parent=root)
        ring(L(0.03, y, 0.40) if not dive else L(0.14, y, 0.50), 0.065, 0.018, cloth2, rot=(0, 0.1, 0), parent=root)
        for k, ang in enumerate((-0.45, 0.0, 0.45)):
            dx = 0.22 * math.cos(ang) if not dive else 0.16 * math.cos(ang)
            dy = 0.22 * math.sin(ang) * 0.9
            dz = 0.0 if not dive else -0.13
            base = Vector(foot)
            tip = base + Vector((dx, dy * s, dz))
            tube([L(*base), L(*(base + (tip - base) * 0.6)), L(*tip)], [0.034, 0.03, 0.026], yellow, parent=root)
            cl = tip + Vector((0.05, dy * s * 0.2, -0.05))
            tube([L(*tip), L(*cl)], [0.024, 0.006], horn, parent=root, ends=False)
        bk = Vector(foot) + Vector((-0.12, 0, 0.0))
        tube([L(*foot), L(*bk)], [0.034, 0.028], yellow, parent=root)
    # ---- tail fan
    for i in range(-3, 4):
        a = i * 0.16
        d = Vector((-math.cos(a) * 0.30, math.sin(a) * 0.22, -0.55)).normalized()
        c = Vector((-0.06, 0, 0.55)) + d * 0.32
        e = Vector((0, 0, 1)).to_track_quat("X", "Z")
        qq = d.to_track_quat("X", "Z")
        ell(L(c.x, c.y, c.z), (0.34, 0.012, 0.055), tips if i in (-3, 3) else wing, rot=tuple(qq.to_euler()), parent=root)

    # ---- wings
    spread = {"fold": 0.0, "half": 0.55, "spread": 1.0, "dive": 0.0}[pose]
    for s in (-1, 1):
        S = Vector((-0.02, 0.27 * s, 1.18))
        folded = Vector((-0.22, 0.12 * s, -1.0))
        if pose == "dive":
            spr = Vector((-1.0, 0.30 * s, 0.10))
            w = 1.0
        else:
            spr = Vector((-0.45, 0.62 * s, 0.70))
            w = spread
        d = folded.lerp(spr, w).normalized()
        wl = 0.55 + 0.40 * w  # wing length
        q = d.to_track_quat("Z", "Y")
        grp = empty(loc=L(*S), rot=tuple(q.to_euler()))
        grp.parent = root
        # arm + covert mass
        ell((0.0, 0, wl * 0.45), (0.17, 0.05, wl * 0.52), wing, parent=grp)
        ell((-0.03, 0, wl * 0.30), (0.20, 0.06, wl * 0.30), body, parent=grp)
        # flight feathers along the trailing edge
        nfe = 13
        for i in range(nfe):
            t = i / (nfe - 1)
            zb = wl * (0.12 + 0.80 * t)
            phi = (-0.25 + 1.05 * t) * (0.6 + 0.5 * w)
            L_f = (0.42 + 0.30 * t) * (0.55 + 0.45 * w + 0.15)
            f = Vector((-math.cos(phi), 0.0, math.sin(phi)))
            base = Vector((-0.08, 0.0, zb))
            ctr = base + f * (L_f / 2)
            ell(ctr, (L_f / 2, 0.010, 0.052 + 0.01 * (1 - t)), tips if t > 0.62 else wing,
                rot=(0, math.pi + phi, 0), seg=24, rings=10, parent=grp)
    return root
