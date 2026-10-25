from pathlib import Path
from collections import defaultdict
from PIL import Image, ImageFilter
import numpy as np
import json
import argparse
import math

parser = argparse.ArgumentParser(description='Trace a black-on-white logo into editable SVG and 3D shape contours.')
parser.add_argument('source', type=Path)
parser.add_argument('--output-directory', type=Path, required=True)
args = parser.parse_args()
source = args.source
out = args.output_directory
out.mkdir(parents=True, exist_ok=True)
image = Image.open(source).convert('L')
binary = image.point(lambda value: 255 if value < 128 else 0)
bounds = binary.getbbox()
binary = binary.crop(bounds)
mask = np.asarray(binary) > 0
h, w = mask.shape
p = np.pad(mask, 1)
edges = defaultdict(list)
for boundary, direction in [
    (mask & ~p[:-2, 1:-1], 'top'),
    (mask & ~p[1:-1, 2:], 'right'),
    (mask & ~p[2:, 1:-1], 'bottom'),
    (mask & ~p[1:-1, :-2], 'left')
]:
    ys, xs = np.nonzero(boundary)
    for y, x in zip(ys.tolist(), xs.tolist()):
        if direction == 'top': a, b = (x, y), (x + 1, y)
        elif direction == 'right': a, b = (x + 1, y), (x + 1, y + 1)
        elif direction == 'bottom': a, b = (x + 1, y + 1), (x, y + 1)
        else: a, b = (x, y + 1), (x, y)
        edges[a].append(b)

def area(points):
    return sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(points, points[1:] + points[:1])) / 2

def rdp(points, tolerance):
    if len(points) <= 2: return points
    a, b = points[0], points[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    norm = (dx * dx + dy * dy) ** .5 or 1
    distances = [abs(dy * (q[0] - a[0]) - dx * (q[1] - a[1])) / norm for q in points]
    index = max(range(len(points)), key=distances.__getitem__)
    if distances[index] <= tolerance: return [a, b]
    return rdp(points[:index+1], tolerance)[:-1] + rdp(points[index:], tolerance)

def simplify(points):
    clean = []
    for i, b in enumerate(points):
        a, c = points[i-1], points[(i+1) % len(points)]
        if (b[0]-a[0]) * (c[1]-b[1]) != (b[1]-a[1]) * (c[0]-b[0]): clean.append(b)
    if len(clean) < 4: return clean
    split = max(range(1, len(clean)), key=lambda i: (clean[i][0]-clean[0][0])**2 + (clean[i][1]-clean[0][1])**2)
    return rdp(clean[:split+1], .75)[:-1] + rdp(clean[split:] + clean[:1], .75)[:-1]

loops = []
while edges:
    start = next(iter(edges))
    current, previous = start, (start[0]-1, start[1])
    loop = []
    while True:
        loop.append(current)
        choices = edges[current]
        incoming = (current[0]-previous[0], current[1]-previous[1])
        def turn(candidate):
            outgoing = (candidate[0]-current[0], candidate[1]-current[1])
            cross = incoming[0]*outgoing[1] - incoming[1]*outgoing[0]
            dot = incoming[0]*outgoing[0] + incoming[1]*outgoing[1]
            return 0 if cross > 0 else 1 if dot > 0 else 2 if cross < 0 else 3
        nxt = min(choices, key=turn)
        choices.remove(nxt)
        if not choices: del edges[current]
        previous, current = current, nxt
        if current == start: break
    if len(loop) >= 4 and abs(area(loop)) >= 10:
        loop = simplify(loop)
        if len(loop) >= 3: loops.append(loop)

def contains(polygon, point):
    x, y = point
    inside = False
    j = len(polygon)-1
    for i in range(len(polygon)):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if (yi > y) != (yj > y) and x < (xj-xi)*(y-yi)/(yj-yi)+xi: inside = not inside
        j = i
    return inside

tip_points = []
smoothed_loops = []
for loop in loops:
    count = len(loop)
    lengths = [math.dist(loop[i], loop[(i+1) % count]) for i in range(count)]
    cumulative = [0.0]
    for length in lengths: cumulative.append(cumulative[-1] + length)
    total_length = cumulative[-1]
    def sample_along(index, direction, distance):
        current = index
        for _ in range(count):
            nxt = (current + direction) % count
            length = math.dist(loop[current], loop[nxt])
            if distance <= length:
                t = distance / (length or 1)
                return tuple(loop[current][axis] * (1-t) + loop[nxt][axis] * t for axis in (0, 1))
            distance -= length
            current = nxt
        return loop[index]
    candidates = []
    for i, point in enumerate(loop):
        a, c = sample_along(i, -1, 12), sample_along(i, 1, 12)
        u, v = (a[0]-point[0], a[1]-point[1]), (c[0]-point[0], c[1]-point[1])
        denominator = math.hypot(*u) * math.hypot(*v)
        if denominator < 1: continue
        angle = math.acos(max(-1, min(1, (u[0]*v[0]+u[1]*v[1])/denominator)))
        convex = (-u[0])*v[1] - (-u[1])*v[0] > 0
        if convex and angle < math.radians(72): candidates.append((angle, i))
    selected = []
    for angle, i in sorted(candidates):
        if all(min(abs(cumulative[i]-cumulative[j]), total_length-abs(cumulative[i]-cumulative[j])) > 13 for _,j in selected):
            selected.append((angle, i))
    locked = {i for _,i in selected}
    for angle, i in selected: tip_points.append((loop[i], max(.085, min(.30, .053 / max(.08, math.sin(angle/2))))))
    # Remove raster stair-stepping while preserving every real pointed tip.
    original = [tuple(point) for point in loop]
    smooth = original[:]
    if abs(area(loop)) > 80:
        for _ in range(4):
            updated = []
            for i, point in enumerate(smooth):
                if i in locked: updated.append(point); continue
                a, c = smooth[i-1], smooth[(i+1) % count]
                candidate = ((a[0]+2*point[0]+c[0])/4, (a[1]+2*point[1]+c[1])/4)
                dx, dy = candidate[0]-original[i][0], candidate[1]-original[i][1]
                distance = math.hypot(dx, dy)
                if distance > 1.1: candidate = (original[i][0]+dx/distance*1.1, original[i][1]+dy/distance*1.1)
                updated.append(candidate)
            smooth = updated
    smoothed_loops.append(smooth)
loops = smoothed_loops

outers = [{'outline': loop, 'holes': []} for loop in loops if area(loop) > 0]
for hole in [loop for loop in loops if area(loop) < 0]:
    candidates = [shape for shape in outers if contains(shape['outline'], hole[0])]
    if candidates: min(candidates, key=lambda shape: abs(area(shape['outline'])))['holes'].append(hole)

scale = 4.5 / w
def world(points): return [[round((x-w/2)*scale, 5), round((h/2-y)*scale, 5)] for x, y in points]
data = [{'outline': world(shape['outline']), 'holes': [world(hole) for hole in shape['holes']]} for shape in outers]
(out / 'logo-shape.js').write_text('window.DX_LOGO_SHAPES=' + json.dumps(data, separators=(',', ':')) + ';window.DX_LOGO_META=' + json.dumps({'width': 4.5, 'height':h*scale, 'tips':[{'position':world([point])[0], 'radius':round(radius,5)} for point,radius in tip_points]}, separators=(',', ':')) + ';\n', encoding='utf-8')
paths = ['M' + 'L'.join(f'{x},{y}' for x, y in loop) + 'Z' for loop in loops]
svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+str(w)+' '+str(h)+'"><defs><linearGradient id="metal" x2=".2" y2="1"><stop stop-color="#090a0c"/><stop offset=".18" stop-color="#aeb5bd"/><stop offset=".27" stop-color="#11151a"/><stop offset=".49" stop-color="#444b53"/><stop offset=".55" stop-color="#c6ccd0"/><stop offset=".63" stop-color="#14171d"/><stop offset="1" stop-color="#20252c"/></linearGradient></defs><path fill="url(#metal)" stroke="#adb7bf" stroke-opacity=".25" stroke-width=".7" fill-rule="evenodd" d="' + ''.join(paths) + '"/></svg>'
(out / 'dx-logo.svg').write_text(svg, encoding='utf-8')
erosion = binary.copy()
relief = np.zeros(mask.shape, dtype=np.uint8)
for depth in range(1, 29):
    erosion = erosion.filter(ImageFilter.MinFilter(3))
    relief[np.asarray(erosion) > 0] = depth
relief = np.uint8(np.sin(relief.astype(np.float32) / 28 * np.pi / 2) * 255)
Image.fromarray(relief).filter(ImageFilter.GaussianBlur(3)).save(out / 'logo-relief.png')
print(json.dumps({'bounds': bounds, 'outer_shapes': len(outers), 'holes': sum(len(s['holes']) for s in outers), 'vertices': sum(len(p) for p in loops), 'sharp_tips':len(tip_points), 'world_height': round(h*scale,3)}))
