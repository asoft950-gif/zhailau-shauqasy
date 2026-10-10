"""Blender helpers for building the Zhailau Shaiqasy characters.

Coordinates: Z up, characters face +X, feet at the origin.
"""
import math
import bpy
import bmesh
from mathutils import Vector, Euler

TEAMS = {
    # Sun side: light coats, warm red-gold cloth. Night side: dark coats, indigo-teal cloth.
    "w": {"cloth": (0.80, 0.16, 0.10), "cloth2": (0.96, 0.74, 0.20), "trim": (0.95, 0.72, 0.18)},
    "b": {"cloth": (0.12, 0.17, 0.62), "cloth2": (0.22, 0.80, 0.72), "trim": (0.62, 0.70, 0.95)},
}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)


def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob


def _set(node, names, value):
    for n in names:
        if n in node.inputs:
            node.inputs[n].default_value = value
            return True
    return False


def mat(name, col, rough=0.6, sss=0.0, bump=0.0, bscale=90.0, metal=0.0,
        sheen=0.0, coat=0.0, var=0.0, var_scale=6.0, spec=0.5, emit=None):
    """Principled material. `var` mixes a darker noise variation into the colour,
    `bump` adds a fine noise bump (fur / skin / cloth micro detail)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    rgba = (col[0], col[1], col[2], 1.0)
    bsdf.inputs["Base Color"].default_value = rgba
    _set(bsdf, ["Roughness"], rough)
    _set(bsdf, ["Metallic"], metal)
    _set(bsdf, ["Specular IOR Level", "Specular"], spec)
    if sss > 0:
        _set(bsdf, ["Subsurface Weight", "Subsurface"], sss)
        _set(bsdf, ["Subsurface Radius"], (0.6, 0.25, 0.15))
        _set(bsdf, ["Subsurface Scale"], 0.08)
    if sheen > 0:
        _set(bsdf, ["Sheen Weight", "Sheen"], sheen)
        _set(bsdf, ["Sheen Roughness"], 0.45)
    if coat > 0:
        _set(bsdf, ["Coat Weight", "Clearcoat"], coat)
        _set(bsdf, ["Coat Roughness", "Clearcoat Roughness"], 0.12)
    if emit is not None:
        _set(bsdf, ["Emission Color", "Emission"], (emit[0], emit[1], emit[2], 1.0))
        _set(bsdf, ["Emission Strength"], emit[3] if len(emit) > 3 else 1.0)
    texco = nt.nodes.new("ShaderNodeTexCoord")
    if var > 0:
        noise = nt.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = var_scale
        noise.inputs["Detail"].default_value = 6.0
        noise.inputs["Roughness"].default_value = 0.6
        nt.links.new(texco.outputs["Object"], noise.inputs["Vector"])
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 0.35
        ramp.color_ramp.elements[1].position = 0.65
        dark = (col[0] * (1 - var), col[1] * (1 - var), col[2] * (1 - var), 1.0)
        ramp.color_ramp.elements[0].color = dark
        ramp.color_ramp.elements[1].color = rgba
        nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    if bump > 0:
        n2 = nt.nodes.new("ShaderNodeTexNoise")
        n2.inputs["Scale"].default_value = bscale
        n2.inputs["Detail"].default_value = 10.0
        n2.inputs["Roughness"].default_value = 0.7
        nt.links.new(texco.outputs["Object"], n2.inputs["Vector"])
        bp = nt.nodes.new("ShaderNodeBump")
        bp.inputs["Strength"].default_value = bump
        bp.inputs["Distance"].default_value = 0.02
        nt.links.new(n2.outputs["Fac"], bp.inputs["Height"])
        nt.links.new(bp.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def scales_mat(name, base, accent, belly, rough=0.35):
    """Snake skin: voronoi scale cells for bump, diamond-ish banding for colour."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    _set(bsdf, ["Roughness"], rough)
    _set(bsdf, ["Specular IOR Level", "Specular"], 0.6)
    _set(bsdf, ["Coat Weight", "Clearcoat"], 0.25)
    texco = nt.nodes.new("ShaderNodeTexCoord")
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 70.0
    nt.links.new(texco.outputs["Object"], vor.inputs["Vector"])
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.inputs["Scale"].default_value = 5.0
    wave.inputs["Distortion"].default_value = 2.5
    nt.links.new(texco.outputs["Object"], wave.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.45
    ramp.color_ramp.elements[1].position = 0.60
    ramp.color_ramp.elements[0].color = (*base, 1)
    ramp.color_ramp.elements[1].color = (*accent, 1)
    nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    # shade each scale a bit
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 0.55
    nt.links.new(ramp.outputs["Color"], mix.inputs["A"])
    cr = nt.nodes.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].color = (0.55, 0.55, 0.55, 1)
    cr.color_ramp.elements[1].color = (1, 1, 1, 1)
    nt.links.new(vor.outputs["Distance"], cr.inputs["Fac"])
    nt.links.new(cr.outputs["Color"], mix.inputs["B"])
    nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.9
    bp.inputs["Distance"].default_value = 0.02
    nt.links.new(vor.outputs["Distance"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def ell(loc, scale, m, rot=(0, 0, 0), seg=40, rings=20, parent=None):
    me = bpy.data.meshes.new("e")
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new("e", me)
    link(ob)
    ob.location = loc
    ob.scale = scale
    ob.rotation_euler = Euler(rot, "XYZ")
    ob.data.materials.append(m)
    if parent is not None:
        ob.parent = parent
    return ob


def cone(loc, r1, r2, depth, m, rot=(0, 0, 0), seg=32, parent=None):
    me = bpy.data.meshes.new("c")
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=depth)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new("c", me)
    link(ob)
    ob.location = loc
    ob.rotation_euler = Euler(rot, "XYZ")
    ob.data.materials.append(m)
    if parent is not None:
        ob.parent = parent
    return ob


def box(loc, size, m, rot=(0, 0, 0), bevel=0.01, parent=None):
    me = bpy.data.meshes.new("b")
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("b", me)
    link(ob)
    ob.location = loc
    ob.scale = size
    ob.rotation_euler = Euler(rot, "XYZ")
    ob.data.materials.append(m)
    if bevel > 0:
        md = ob.modifiers.new("bv", "BEVEL")
        md.width = bevel
        md.segments = 3
        md.limit_method = "ANGLE"
    for p in ob.data.polygons:
        p.use_smooth = True
    if parent is not None:
        ob.parent = parent
    return ob


def tube(pts, radii, m, res=10, ends=True, parent=None, smooth=True):
    """Smooth tapered tube through points (Bezier curve with per-point radius)."""
    cu = bpy.data.curves.new("t", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = 1.0
    cu.bevel_resolution = res
    cu.use_fill_caps = True
    cu.resolution_u = 14
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(pts) - 1)
    for i, (p, r) in enumerate(zip(pts, radii)):
        bp = sp.bezier_points[i]
        bp.co = p
        bp.radius = r
        bp.handle_left_type = "AUTO"
        bp.handle_right_type = "AUTO"
    ob = bpy.data.objects.new("t", cu)
    link(ob)
    cu.materials.append(m)
    if parent is not None:
        ob.parent = parent
    if ends:
        ell(pts[0], (radii[0],) * 3, m, parent=parent, seg=20, rings=10)
        ell(pts[-1], (radii[-1],) * 3, m, parent=parent, seg=20, rings=10)
    return ob


def ring(loc, radius, thick, m, rot=(0, 0, 0), n=24, parent=None):
    pts = []
    for i in range(n):
        a = i / n * math.tau
        pts.append((math.cos(a) * radius, math.sin(a) * radius, 0.0))
    cu = bpy.data.curves.new("r", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = thick
    cu.bevel_resolution = 6
    cu.resolution_u = 8
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(n - 1)
    for i, p in enumerate(pts):
        bp = sp.bezier_points[i]
        bp.co = p
        bp.handle_left_type = "AUTO"
        bp.handle_right_type = "AUTO"
    sp.use_cyclic_u = True
    ob = bpy.data.objects.new("r", cu)
    link(ob)
    ob.location = loc
    ob.rotation_euler = Euler(rot, "XYZ")
    cu.materials.append(m)
    if parent is not None:
        ob.parent = parent
    return ob


def empty(loc=(0, 0, 0), rot=(0, 0, 0)):
    ob = bpy.data.objects.new("g", None)
    link(ob)
    ob.location = loc
    ob.rotation_euler = Euler(rot, "XYZ")
    return ob


def eye(loc, r, parent=None, iris=(0.05, 0.03, 0.02), look=(1, 0, 0), sclera=None, slit=False):
    """Glossy eye: dark (or coloured) ball with a highlight bump."""
    if sclera is not None:
        ell(loc, (r, r, r), mat("sc", sclera, rough=0.25, spec=0.8), parent=parent, seg=24, rings=12)
        off = Vector(look).normalized() * r * 0.35
        iris_loc = (loc[0] + off.x, loc[1] + off.y, loc[2] + off.z)
        ell(iris_loc, (r * 0.78, r * 0.78, r * 0.78), mat("ir", iris, rough=0.15, spec=1.0, coat=1.0),
            parent=parent, seg=24, rings=12)
        pup = Vector(look).normalized() * r * 0.62
        pl = (loc[0] + pup.x, loc[1] + pup.y, loc[2] + pup.z)
        sc = (r * 0.2, r * 0.2, r * 0.55) if slit else (r * 0.38, r * 0.38, r * 0.38)
        ell(pl, sc, mat("pu", (0.01, 0.01, 0.01), rough=0.1), parent=parent, seg=16, rings=8)
    else:
        ell(loc, (r, r, r), mat("eye", iris, rough=0.08, spec=1.0, coat=1.0), parent=parent, seg=28, rings=14)


def setup_scene(size=352, samples=64, ortho=2.9, zc=0.98, xc=0.0, elev=16.0, azim=28.0, dist=14.0):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 6
    sc.cycles.diffuse_bounces = 3
    sc.cycles.glossy_bounces = 3
    sc.cycles.transmission_bounces = 2
    sc.cycles.sample_clamp_indirect = 8.0
    sc.render.resolution_x = size
    sc.render.resolution_y = size
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    # camera
    cam = bpy.data.cameras.new("cam")
    cam.type = "ORTHO"
    cam.ortho_scale = ortho
    co = bpy.data.objects.new("cam", cam)
    link(co)
    e = math.radians(elev)
    a = math.radians(azim)
    tgt = Vector((xc, 0, zc))
    off = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * dist
    co.location = tgt + off
    direction = tgt - co.location
    co.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    sc.camera = co
    # lights: warm key from upper left-front, cool fill, rim from behind
    def light(kind, name, energy, loc, color, size=3.0):
        ld = bpy.data.lights.new(name, kind)
        ld.energy = energy
        ld.color = color
        if kind == "AREA":
            ld.size = size
        lo = bpy.data.objects.new(name, ld)
        link(lo)
        lo.location = loc
        d = Vector((0, 0, 0.9)) - Vector(loc)
        lo.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        return lo
    light("AREA", "key", 900, (-5.5, -7.0, 7.5), (1.0, 0.95, 0.86), 5.0)
    light("AREA", "fill", 260, (7.0, -5.0, 3.0), (0.78, 0.88, 1.0), 6.0)
    light("AREA", "rim", 520, (1.5, 7.0, 5.0), (1.0, 0.98, 0.9), 4.0)
    # world: sky from above, green bounce from the grass below
    w = bpy.data.worlds.new("w")
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    texco = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[1].position = 0.65
    ramp.color_ramp.elements[0].color = (0.30, 0.45, 0.16, 1)
    ramp.color_ramp.elements[1].color = (0.62, 0.74, 0.92, 1)
    mapr = nt.nodes.new("ShaderNodeMapRange")
    mapr.inputs["From Min"].default_value = -1.0
    mapr.inputs["From Max"].default_value = 1.0
    nt.links.new(texco.outputs["Generated"], sep.inputs["Vector"])
    nt.links.new(sep.outputs["Z"], mapr.inputs["Value"])
    nt.links.new(mapr.outputs["Result"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 0.9
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    sc.world = w
    return co


def anchor_px(size):
    """Pixel position of the world origin (feet) in the render."""
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    v = world_to_camera_view(sc, sc.camera, Vector((0, 0, 0)))
    return round(v.x * size, 1), round((1 - v.y) * size, 1)


def render(path):
    sc = bpy.context.scene
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
