import os
import math
import datetime
import numpy as np
import pyproj
from shapely.geometry import Polygon
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import Polygon as MplPolygon, FancyBboxPatch, FancyArrowPatch
from matplotlib.offsetbox import OffsetImage, AnnotationBbox
from PIL import Image

# 1. Configuración de Proyección Geodésica: WGS84 -> UTM Zona 19N (EPSG:32619)
transformer = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:32619", always_xy=True)

def to_utm(lon, lat):
    return transformer.transform(lon, lat)

# Coordenadas WGS84
coords_wgs_p = [
    (-64.6334931, 10.2041270),  # P1 (SW)
    (-64.6325898, 10.2039085),  # P2 (SE)
    (-64.6322931, 10.2051063),  # P3 (NE)
    (-64.6332604, 10.2053150),  # P4 (NW)
]

# Huella Central: 5.189,67 m² (5.190 m² nominal)
coords_wgs_q = [
    (-64.6330805, 10.2052798),  # Q1 (NW)
    (-64.6332309, 10.2045362),  # Q2 (SW)
    (-64.6326685, 10.2044512),  # Q3 (SE)
    (-64.6325082, 10.2051530),  # Q4 (NE)
]

# Cortes de Subdivisión en 3 Macro-Lotes (1.730 m² c/u)
corte1_wgs = ((-64.6331306, 10.2050319), (-64.6325616, 10.2049191))
corte2_wgs = ((-64.6331808, 10.2047841), (-64.6326151, 10.2046851))

boca_acceso_wgs = (-64.633879, 10.205651)
eje_fin_wgs = (-64.633260, 10.205315)

poly_ext_utm = np.array([to_utm(lon, lat) for lon, lat in coords_wgs_p])
poly_int_utm = np.array([to_utm(lon, lat) for lon, lat in coords_wgs_q])
c1_pts_utm = np.array([to_utm(*corte1_wgs[0]), to_utm(*corte1_wgs[1])])
c2_pts_utm = np.array([to_utm(*corte2_wgs[0]), to_utm(*corte2_wgs[1])])
boca_acceso_utm = np.array(to_utm(*boca_acceso_wgs))
eje_fin_utm = np.array(to_utm(*eje_fin_wgs))

lote1_utm = np.array([poly_int_utm[0], c1_pts_utm[0], c1_pts_utm[1], poly_int_utm[3]])
lote2_utm = np.array([c1_pts_utm[0], c2_pts_utm[0], c2_pts_utm[1], c1_pts_utm[1]])
lote3_utm = np.array([c2_pts_utm[0], poly_int_utm[1], poly_int_utm[2], c2_pts_utm[1]])

# Configuración de Lienzo A1 Panorámico
plt.rcParams['font.sans-serif'] = 'DejaVu Sans'
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['font.size'] = 9.0

fig = plt.figure(figsize=(24, 15), dpi=300, facecolor='#FFFFFF')

# Marcos de Lámina Profesional
outer_frame = patches.Rectangle((0.008, 0.008), 0.984, 0.984, fill=False, edgecolor='#0F172A', linewidth=2.8, transform=fig.transFigure)
inner_frame = patches.Rectangle((0.012, 0.012), 0.976, 0.976, fill=False, edgecolor='#94A3B8', linewidth=0.8, transform=fig.transFigure)
fig.patches.extend([outer_frame, inner_frame])

# Header Superior Ejecutivo (SIN MASTER PLAN)
header_ax = fig.add_axes([0.018, 0.922, 0.964, 0.060])
header_ax.axis('off')
header_box = patches.FancyBboxPatch((0, 0), 1, 1, boxstyle='round,pad=0.01,rounding_size=0.015',
                                    facecolor='#091024', edgecolor='#D97706', linewidth=2.0)
header_ax.add_patch(header_box)

header_ax.text(0.02, 0.65, "CENTRO COMERCIAL MARIO SÁNCHEZ — PLANO DE LEVANTAMIENTO TOPOGRÁFICO Y SUBDIVISIÓN",
               fontsize=14.0, fontweight='bold', color='#FFFFFF', va='center')
header_ax.text(0.02, 0.28, "SUBDIVISIÓN FORMAL DE LA HUELLA CENTRAL (5.189,67 m²) EN TRES (3) MACRO-LOTES DE 1.730 m² • LOGÍSTICA VIAL 20.00 M",
               fontsize=9.5, fontweight='bold', color='#F59E0B', va='center')
header_ax.text(0.98, 0.50, "SISTEMA GEODÉSICO: REGVEN / UTM HUSO 19N (EPSG:32619) | PUERTO LA CRUZ, VENEZUELA",
               fontsize=8.8, fontweight='bold', color='#94A3B8', ha='right', va='center')

# Viewport Cartográfico Principal
ax = fig.add_axes([0.025, 0.035, 0.70, 0.875])

all_x = np.concatenate([poly_ext_utm[:, 0], poly_int_utm[:, 0], [boca_acceso_utm[0], eje_fin_utm[0]]])
all_y = np.concatenate([poly_ext_utm[:, 1], poly_int_utm[:, 1], [boca_acceso_utm[1], eje_fin_utm[1]]])

min_x, max_x = np.min(all_x) - 28, np.max(all_x) + 32
min_y, max_y = np.min(all_y) - 26, np.max(all_y) + 32

grid_step = 25.0
x_ticks = np.arange(np.floor(min_x / grid_step) * grid_step, np.ceil(max_x / grid_step) * grid_step + grid_step, grid_step)
y_ticks = np.arange(np.floor(min_y / grid_step) * grid_step, np.ceil(max_y / grid_step) * grid_step + grid_step, grid_step)

ax.set_xticks(x_ticks)
ax.set_yticks(y_ticks)
ax.xaxis.set_major_formatter(plt.FuncFormatter(lambda val, pos: f"{int(val)} m E"))
ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda val, pos: f"{int(val)} m N"))
ax.grid(True, linestyle='--', color='#E2E8F0', linewidth=0.6, zorder=0)
ax.tick_params(axis='both', which='major', labelsize=8, colors='#475569')

# 1. Polígono General
p_ext = MplPolygon(poly_ext_utm, closed=True, facecolor='#F8FAFC', edgecolor='#0284C7', linewidth=2.8, zorder=1)
ax.add_patch(p_ext)

# 2. Eje y Boca de Acceso Vial
dx_e = eje_fin_utm[0] - boca_acceso_utm[0]
dy_e = eje_fin_utm[1] - boca_acceso_utm[1]
L_eje = math.hypot(dx_e, dy_e)
ux_e, uy_e = dx_e / L_eje, dy_e / L_eje
nx_e, ny_e = -uy_e * (11.5 / 2.0), ux_e * (11.5 / 2.0)

poly_acceso = np.array([
    boca_acceso_utm - np.array([nx_e, ny_e]),
    eje_fin_utm - np.array([nx_e, ny_e]),
    eje_fin_utm + np.array([nx_e, ny_e]),
    boca_acceso_utm + np.array([nx_e, ny_e])
])
p_acc = MplPolygon(poly_acceso, closed=True, facecolor='#FAF5FF', edgecolor='#9333EA', linewidth=1.8, linestyle='--', zorder=2)
ax.add_patch(p_acc)
ax.plot([boca_acceso_utm[0], eje_fin_utm[0]], [boca_acceso_utm[1], eje_fin_utm[1]], color='#9333EA', linestyle='-.', linewidth=1.4, zorder=3)

# 3. Avenida de Servicio Oeste (20.00 m libres) y Puestos 90°
dx_w = poly_int_utm[1][0] - poly_int_utm[0][0]
dy_w = poly_int_utm[1][1] - poly_int_utm[0][1]
L_w = math.hypot(dx_w, dy_w)
ux_w, uy_w = dx_w / L_w, dy_w / L_w
nx_w, ny_w = -uy_w * 20.0, ux_w * 20.0

poly_serv_w = np.array([
    poly_int_utm[0],
    poly_int_utm[1],
    poly_int_utm[1] + np.array([nx_w, ny_w]),
    poly_int_utm[0] + np.array([nx_w, ny_w])
])
p_serv = MplPolygon(poly_serv_w, closed=True, facecolor='#F0FDF4', edgecolor='#16A34A', linewidth=1.2, linestyle=':', zorder=2)
ax.add_patch(p_serv)

# Puestos de estacionamiento
num_stalls = 34
stall_len = L_w / num_stalls
for i in range(num_stalls + 1):
    base_pt = poly_int_utm[0] + np.array([ux_w, uy_w]) * (i * stall_len)
    end_pt = base_pt + np.array([nx_w, ny_w]) * (5.0 / 20.0)
    ax.plot([base_pt[0], end_pt[0]], [base_pt[1], end_pt[1]], color='#0284C7', linewidth=0.75, zorder=3)

p_bay_start = poly_int_utm[0] + np.array([nx_w * 0.25, ny_w * 0.25])
p_bay_end = poly_int_utm[1] + np.array([nx_w * 0.25, ny_w * 0.25])
ax.plot([p_bay_start[0], p_bay_end[0]], [p_bay_start[1], p_bay_end[1]], color='#0284C7', linestyle='--', linewidth=1.0, zorder=3)

# 4. Los 3 Macro-Lotes
p_c01 = MplPolygon(lote1_utm, closed=True, facecolor='#FEF3C7', edgecolor='#D97706', linewidth=2.4, zorder=4)
p_c02 = MplPolygon(lote2_utm, closed=True, facecolor='#E0F2FE', edgecolor='#0284C7', linewidth=2.4, zorder=4)
p_c03 = MplPolygon(lote3_utm, closed=True, facecolor='#F3E8FF', edgecolor='#9333EA', linewidth=2.4, zorder=4)
ax.add_patch(p_c01)
ax.add_patch(p_c02)
ax.add_patch(p_c03)

ax.plot([c1_pts_utm[0][0], c1_pts_utm[1][0]], [c1_pts_utm[0][1], c1_pts_utm[1][1]],
        color='#B45309', linestyle='--', linewidth=2.0, zorder=5)
ax.plot([c2_pts_utm[0][0], c2_pts_utm[1][0]], [c2_pts_utm[0][1], c2_pts_utm[1][1]],
        color='#6B21A8', linestyle='--', linewidth=2.0, zorder=5)

for pt in [c1_pts_utm[0], c1_pts_utm[1], c2_pts_utm[0], c2_pts_utm[1]]:
    ax.scatter(pt[0], pt[1], color='#D97706', s=35, zorder=6, edgecolors='#0F172A', linewidth=0.8)

# 5. Badges Centrales de cada Macro-Lote
c1 = np.mean(lote1_utm, axis=0)
c2 = np.mean(lote2_utm, axis=0)
c3 = np.mean(lote3_utm, axis=0)

ax.text(c1[0], c1[1], "LOT-C01 (NORTE)\n1.730 m²\n[FTE. OESTE: 27,95 m]",
        fontsize=8.5, fontweight='bold', color='#92400E', ha='center', va='center',
        bbox=dict(boxstyle='round,pad=0.45', facecolor='#FFFFFF', edgecolor='#D97706', linewidth=1.5, alpha=0.96), zorder=7)

ax.text(c2[0], c2[1], "LOT-C02 (CENTRO)\n1.730 m²\n[FTE. OESTE: 27,95 m]",
        fontsize=8.5, fontweight='bold', color='#0369A1', ha='center', va='center',
        bbox=dict(boxstyle='round,pad=0.45', facecolor='#FFFFFF', edgecolor='#0284C7', linewidth=1.5, alpha=0.96), zorder=7)

ax.text(c3[0], c3[1], "LOT-C03 (SUR)\n1.730 m²\n[FTE. OESTE: 27,96 m]",
        fontsize=8.5, fontweight='bold', color='#6B21A8', ha='center', va='center',
        bbox=dict(boxstyle='round,pad=0.45', facecolor='#FFFFFF', edgecolor='#9333EA', linewidth=1.5, alpha=0.96), zorder=7)

# 6. COTAS ARQUITECTÓNICAS DEFINITIVAS CON TICKS A 45°
def draw_dim(ax, p1, p2, label, offset, color='#0F172A', text_color=None, tick_size=1.6, lw=1.1, fontsize=7.8):
    if text_color is None:
        text_color = color
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    L = math.hypot(dx, dy)
    if L == 0: return
    ux, uy = dx / L, dy / L
    nx, ny = -uy * offset, ux * offset
    
    d1 = (p1[0] + nx, p1[1] + ny)
    d2 = (p2[0] + nx, p2[1] + ny)
    mid = ((d1[0] + d2[0]) / 2.0, (d1[1] + d2[1]) / 2.0)
    
    ax.plot([p1[0], d1[0]], [p1[1], d1[1]], color='#64748B', linestyle=':', linewidth=0.75, alpha=0.7, zorder=5)
    ax.plot([p2[0], d2[0]], [p2[1], d2[1]], color='#64748B', linestyle=':', linewidth=0.75, alpha=0.7, zorder=5)
    ax.plot([d1[0], d2[0]], [d1[1], d2[1]], color=color, linestyle='-', linewidth=lw, zorder=5)
    
    tx, ty = tick_size * 0.7071, tick_size * 0.7071
    ax.plot([d1[0] - tx, d1[0] + tx], [d1[1] - ty, d1[1] + ty], color=color, linewidth=lw*1.4, zorder=6)
    ax.plot([d2[0] - tx, d2[0] + tx], [d2[1] - ty, d2[1] + ty], color=color, linewidth=lw*1.4, zorder=6)
    
    deg = math.degrees(math.atan2(dy, dx))
    if deg > 90: deg -= 180
    elif deg < -90: deg += 180
    
    ax.text(mid[0], mid[1], label, fontsize=fontsize, fontweight='bold', color=text_color,
            ha='center', va='center', rotation=deg,
            bbox=dict(boxstyle='round,pad=0.25', facecolor='#FFFFFF', edgecolor=color, linewidth=0.9, alpha=0.96), zorder=7)

# 6a. Cotas Perímetro Exterior
draw_dim(ax, poly_ext_utm[0], poly_ext_utm[1], "SUR: 101.88 m", offset=-10.0, color='#0369A1', fontsize=8.0)
draw_dim(ax, poly_ext_utm[1], poly_ext_utm[2], "ESTE: 136.42 m", offset=-10.0, color='#0369A1', fontsize=8.0)
draw_dim(ax, poly_ext_utm[3], poly_ext_utm[2], "NORTE: 108.47 m", offset=20.0, color='#0369A1', fontsize=8.0)
draw_dim(ax, poly_ext_utm[0], poly_ext_utm[3], "OESTE: 133.85 m", offset=15.0, color='#0369A1', fontsize=8.0)

# 6b. Cotas Huella Central (Ubicadas para cero colisiones)
draw_dim(ax, poly_int_utm[3], poly_int_utm[0], "Frente Norte: 64.31 m", offset=4.5, color='#B45309', fontsize=7.6)
# Frente Sur ubicada adentro del lote para que no choque con PATIO SUR
draw_dim(ax, poly_int_utm[1], poly_int_utm[2], "Frente Sur: 62.38 m", offset=3.5, color='#B45309', fontsize=7.6)
# Lindero Este ubicada adentro del lote para no chocar con flecha ni pasillo este
draw_dim(ax, poly_int_utm[2], poly_int_utm[3], "Lindero Este: 79.56 m", offset=3.5, color='#B45309', fontsize=7.4)

# Divisiones Internas
draw_dim(ax, c1_pts_utm[0], c1_pts_utm[1], "Divisoria 1 (C01 / C02): 63.13 m", offset=2.4, color='#B45309', fontsize=7.4)
draw_dim(ax, c2_pts_utm[0], c2_pts_utm[1], "Divisoria 2 (C02 / C03): 62.56 m", offset=2.4, color='#6B21A8', fontsize=7.4)

# Frentes Viales Oeste de cada Lote
draw_dim(ax, poly_int_utm[0], c1_pts_utm[0], "C01: 27.95 m", offset=-2.6, color='#D97706', fontsize=7.2)
draw_dim(ax, c1_pts_utm[0], c2_pts_utm[0], "C02: 27.95 m", offset=-2.6, color='#0284C7', fontsize=7.2)
draw_dim(ax, c2_pts_utm[0], poly_int_utm[1], "C03: 27.96 m", offset=-2.6, color='#9333EA', fontsize=7.2)

# Frente Vial Oeste Total
draw_dim(ax, poly_int_utm[0], poly_int_utm[1], "Frente Vial Oeste Huella: 83.86 m", offset=-8.5, color='#0D9488', fontsize=7.8)

# Acceso Boca y Eje
draw_dim(ax, boca_acceso_utm - np.array([nx_e, ny_e]), boca_acceso_utm + np.array([nx_e, ny_e]),
         "Boca: 11.50 m", offset=6.0, color='#7E22CE', fontsize=7.6)
draw_dim(ax, boca_acceso_utm, eje_fin_utm,
         "Eje Longitudinal Acceso: 76.00 m", offset=-8.0, color='#7E22CE', fontsize=7.8)

# 7. Cartelas Informativas de Pasillos Viales
ax.text(poly_int_utm[0][0] - 22.0, poly_int_utm[0][1] - 42.0,
        "PASILLO OESTE: 20.00 m LIBRES\nAVENIDA DE SERVICIO COMERCIAL\n(VÍA GANDOLAS + BATERÍA 90° ~35 PUESTOS)",
        fontsize=7.4, fontweight='bold', color='#0369A1', ha='center', va='center',
        bbox=dict(boxstyle='square,pad=0.35', facecolor='#F0F9FF', edgecolor='#0284C7', linewidth=1.2, alpha=0.96), zorder=7)

ax.text((poly_int_utm[1][0] + poly_int_utm[2][0])/2.0 - 12.0, poly_int_utm[1][1] - 10.0,
        "PATIO SUR: 20.00 m LIBRES\n(MANIOBRA Y CARGA REPUESTOS DE ORIENTE)",
        fontsize=7.2, fontweight='bold', color='#0F766E', ha='center', va='center',
        bbox=dict(boxstyle='square,pad=0.32', facecolor='#CCFBF1', edgecolor='#0D9488', linewidth=1.2, alpha=0.96), zorder=7)

ax.text((poly_int_utm[0][0] + poly_int_utm[3][0])/2.0 + 8.0, poly_ext_utm[3][1] - 4.5,
        "RETIRO NORTE: 23.86 m (ACCESO & ESTAC. CLIENTES)",
        fontsize=7.6, fontweight='bold', color='#15803D', ha='center', va='center',
        bbox=dict(boxstyle='square,pad=0.35', facecolor='#F0FDF4', edgecolor='#16A34A', linewidth=1.2, alpha=0.96), zorder=7)

ax.text((poly_int_utm[2][0] + poly_int_utm[3][0])/2.0 + 13.0, (poly_int_utm[2][1] + poly_int_utm[3][1])/2.0,
        "PASILLO ESTE: 23.80 m\n(RETORNO Y TRÁNSITO PESADO)",
        fontsize=7.6, fontweight='bold', color='#15803D', ha='center', va='center',
        bbox=dict(boxstyle='square,pad=0.35', facecolor='#F0FDF4', edgecolor='#16A34A', linewidth=1.2, alpha=0.96), zorder=7)

# 8. Circulación de Gandolas (Sentido Horario)
def add_arrow(start, end):
    arr = FancyArrowPatch(start, end, arrowstyle='-|>', mutation_scale=13, color='#16A34A', linewidth=2.4, zorder=6)
    ax.add_patch(arr)

add_arrow((poly_int_utm[0][0] - 13.5, poly_int_utm[0][1] - 10.0), (poly_int_utm[1][0] - 13.5, poly_int_utm[1][1] + 12.0))
add_arrow((poly_int_utm[1][0] + 8.0, poly_int_utm[1][1] - 5.5), (poly_int_utm[2][0] - 8.0, poly_int_utm[2][1] - 5.5))
add_arrow((poly_int_utm[2][0] + 7.5, poly_int_utm[2][1] + 10.0), (poly_int_utm[3][0] + 7.5, poly_int_utm[3][1] - 10.0))
add_arrow((poly_int_utm[3][0] - 6.0, poly_int_utm[3][1] + 8.0), (poly_int_utm[0][0] + 8.0, poly_int_utm[0][1] + 8.0))

# 9. Vértices Topográficos
for pt, lbl in zip(poly_ext_utm, ['P1 (SW)', 'P2 (SE)', 'P3 (NE)', 'P4 (NW)']):
    ax.scatter(pt[0], pt[1], color='#DC2626', s=55, zorder=7, edgecolors='#0F172A', linewidth=1.0)
    off_x, off_y = (-14, -14) if 'SW' in lbl else ((14, -14) if 'SE' in lbl else ((14, 14) if 'NE' in lbl else (-14, 14)))
    ax.annotate(lbl, xy=(pt[0], pt[1]), xytext=(off_x, off_y), textcoords='offset points',
                fontsize=8.0, fontweight='bold', color='#991B1B',
                bbox=dict(boxstyle='round,pad=0.2', facecolor='#FFFFFF', edgecolor='#DC2626', linewidth=1.0), zorder=8)

for pt, lbl in zip(poly_int_utm, ['Q1 (NW)', 'Q2 (SW)', 'Q3 (SE)', 'Q4 (NE)']):
    ax.scatter(pt[0], pt[1], color='#D97706', s=45, zorder=7, edgecolors='#0F172A', linewidth=0.9)
    off_x, off_y = (-12, 10) if 'NW' in lbl else ((-12, -10) if 'SW' in lbl else ((10, -10) if 'SE' in lbl else (10, 10)))
    ax.annotate(lbl, xy=(pt[0], pt[1]), xytext=(off_x, off_y), textcoords='offset points',
                fontsize=7.6, fontweight='bold', color='#92400E',
                bbox=dict(boxstyle='round,pad=0.2', facecolor='#FFFFFF', edgecolor='#D97706', linewidth=0.9), zorder=8)

# Rosa de los Vientos
nx, ny = min_x + 18, max_y - 16
ax.annotate('', xy=(nx, ny + 13), xytext=(nx, ny - 3),
            arrowprops=dict(facecolor='#DC2626', edgecolor='#0F172A', width=3.5, headwidth=12, headlength=14), zorder=8)
ax.text(nx, ny + 15.5, 'NORTE', fontsize=9.0, fontweight='bold', color='#991B1B', ha='center', va='bottom', zorder=8)
ax.text(nx, ny - 6.5, 'UTM 19N\nWGS84', fontsize=7.2, fontweight='bold', color='#475569', ha='center', va='top', zorder=8)

# Escala Gráfica
sx, sy = min_x + 14, min_y + 10
slen = 50.0
ax.plot([sx, sx + slen], [sy, sy], color='#0F172A', linewidth=4.0, zorder=8)
ax.plot([sx, sx + slen/2], [sy, sy], color='#0F172A', linewidth=6.5, zorder=8)
ax.plot([sx + slen/2, sx + slen], [sy, sy], color='#FFFFFF', linewidth=4.5, zorder=9)
ax.plot([sx + slen/2, sx + slen], [sy, sy], color='#0F172A', linewidth=1.0, zorder=10)
for val, txt in [(0, '0 m'), (25, '25 m'), (50, '50 m')]:
    ax.plot([sx + val, sx + val], [sy - 1.5, sy + 1.5], color='#0F172A', linewidth=1.2, zorder=8)
    ax.text(sx + val, sy - 3.0, txt, fontsize=7.5, fontweight='bold', color='#0F172A', ha='center', va='top', zorder=8)
ax.text(sx + slen/2, sy + 3.0, "ESCALA MÉTRICA 1:1.000", fontsize=8.2, fontweight='bold', color='#0F172A', ha='center', va='bottom', zorder=8)

ax.set_xlim(min_x, max_x)
ax.set_ylim(min_y, max_y)
ax.set_aspect('equal', adjustable='box')

# =========================================================================
# 10. PANEL DERECHO DE ESPECIFICACIONES TÉCNICAS
# =========================================================================
side_ax = fig.add_axes([0.735, 0.035, 0.245, 0.875])
side_ax.set_xlim(0, 1)
side_ax.set_ylim(0, 1)
side_ax.axis('off')

side_box = patches.FancyBboxPatch((0, 0), 1, 1, boxstyle='round,pad=0.01,rounding_size=0.015',
                                  facecolor='#F8FAFC', edgecolor='#CBD5E1', linewidth=1.5)
side_ax.add_patch(side_box)

y_cursor = 0.98

# Logotipo Oficial 2K
logo_paths = [
    "c:/Users/Administrator/Desktop/Memoria/cc-mario-sanchez-comercial/logo_cc_mario_sanchez_2k.png",
    "c:/Users/Administrator/Desktop/Memoria/Proyecto Centro Comercial Mario Sánchez/01_Levantamiento_Tecnico_GIS/logo_cc_mario_sanchez_2k.png"
]
logo_loaded = False
for lp in logo_paths:
    if os.path.exists(lp):
        try:
            logo_img = Image.open(lp)
            imagebox = OffsetImage(logo_img, zoom=0.060)
            ab = AnnotationBbox(imagebox, (0.5, y_cursor - 0.045), frameon=False)
            side_ax.add_artist(ab)
            y_cursor -= 0.105
            logo_loaded = True
            break
        except Exception:
            pass

if not logo_loaded:
    side_ax.text(0.5, y_cursor - 0.03, "CENTRO COMERCIAL MARIO SÁNCHEZ",
                 fontsize=11.0, fontweight='bold', color='#091024', ha='center')
    y_cursor -= 0.06

def draw_custom_table(ax, x0, y0, col_widths, headers, rows, header_color='#0284C7', row_colors=['#FFFFFF', '#F0F9FF']):
    h_row = 0.024
    cx = x0
    for w, h in zip(col_widths, headers):
        rect = patches.Rectangle((cx, y0 - h_row), w, h_row, facecolor=header_color, edgecolor='#0F172A', linewidth=0.8)
        ax.add_patch(rect)
        ax.text(cx + w/2.0, y0 - h_row/2.0, h, fontsize=7.2, fontweight='bold', color='white', ha='center', va='center')
        cx += w
    
    cy = y0 - h_row
    for r_idx, r in enumerate(rows):
        cx = x0
        bg = row_colors[r_idx % len(row_colors)]
        for c_idx, (w, val) in enumerate(zip(col_widths, r)):
            rect = patches.Rectangle((cx, cy - h_row), w, h_row, facecolor=bg, edgecolor='#CBD5E1', linewidth=0.6)
            ax.add_patch(rect)
            fw = 'bold' if c_idx == 0 else 'normal'
            fc = '#0F172A'
            ax.text(cx + w/2.0, cy - h_row/2.0, str(val), fontsize=6.8, fontweight=fw, color=fc, ha='center', va='center')
            cx += w
        cy -= h_row
    return cy

# 1. Tabla de Vértices Polígono General
side_ax.text(0.04, y_cursor, "1. CUADRO DE VÉRTICES GENERAL (UTM 19N)", fontsize=8.2, fontweight='bold', color='#0369A1')
y_cursor -= 0.015

headers_p = ['Vértice', 'Este (X)', 'Norte (Y)', 'Lindero']
widths_p = [0.20, 0.26, 0.26, 0.22]
rows_p = [
    ['P1 (SW)', f"{poly_ext_utm[0][0]:.2f}", f"{poly_ext_utm[0][1]:.2f}", "101.88 m (S)"],
    ['P2 (SE)', f"{poly_ext_utm[1][0]:.2f}", f"{poly_ext_utm[1][1]:.2f}", "136.42 m (E)"],
    ['P3 (NE)', f"{poly_ext_utm[2][0]:.2f}", f"{poly_ext_utm[2][1]:.2f}", "108.47 m (N)"],
    ['P4 (NW)', f"{poly_ext_utm[3][0]:.2f}", f"{poly_ext_utm[3][1]:.2f}", "133.85 m (O)"],
]
y_cursor = draw_custom_table(side_ax, 0.04, y_cursor, widths_p, headers_p, rows_p, header_color='#0284C7')
y_cursor -= 0.008

side_ax.text(0.04, y_cursor, "Área General: 14.207,00 m² (1,421 Ha) | Perímetro: 480,62 m",
             fontsize=7.2, fontweight='bold', color='#0F172A')
y_cursor -= 0.025

# 2. Tabla de Subdivisión Huella Central
side_ax.text(0.04, y_cursor, "2. SUBDIVISIÓN HUELLA CENTRAL (5.189,67 m²)", fontsize=8.2, fontweight='bold', color='#B45309')
y_cursor -= 0.015

headers_q = ['Lote', 'Área (m²)', 'Fte. Oeste', 'Uso Predominante']
widths_q = [0.20, 0.22, 0.22, 0.28]
rows_q = [
    ['LOT-C01', '1.730,00', '27.95 m', 'Showroom / Retail Mayorista'],
    ['LOT-C02', '1.730,00', '27.95 m', 'Logística / Distribución'],
    ['LOT-C03', '1.730,00', '27.96 m', 'Taller / Patio Carga Pesada'],
]
y_cursor = draw_custom_table(side_ax, 0.04, y_cursor, widths_q, headers_q, rows_q, header_color='#D97706', row_colors=['#FFFFFF', '#FEF3C7'])
y_cursor -= 0.008

side_ax.text(0.04, y_cursor, "Huella Central: 5.189,67 m² (100%) | Perímetro Envolvente: 290,11 m",
             fontsize=7.2, fontweight='bold', color='#0F172A')
y_cursor -= 0.025

# 3. Parámetros Urbanísticos y Logística Vial
side_ax.text(0.04, y_cursor, "3. PARÁMETROS VIALES Y LOGÍSTICA DE CARGA", fontsize=8.2, fontweight='bold', color='#15803D')
y_cursor -= 0.016

params_box = patches.Rectangle((0.04, y_cursor - 0.170), 0.92, 0.170,
                              facecolor='#F0FDF4', edgecolor='#16A34A', linewidth=0.9)
side_ax.add_patch(params_box)

urban_lines = [
    "• Boca de Acceso Av. Municipal: 11.50 m (Entrada / Salida)",
    "• Eje Longitudinal de Acceso: 76.00 m libres",
    "• Pasillo Oeste (Av. Servicio): 20.00 m (Vía Gandolas + Estac. 90°)",
    "• Batería Estacionamiento 90°: ~35 puestos frente a locales",
    "• Patio Sur (Maniobras Carga): 20.00 m (Repuestos de Oriente)",
    "• Retiro Norte (Estac. Clientes): 23.86 m",
    "• Pasillo Este (Retorno / Logística): 23.80 m libres",
    "• Sentido de Circulación: Horario Obligatorio para Gandolas"
]
for idx, line in enumerate(urban_lines):
    side_ax.text(0.06, y_cursor - 0.018 - (idx * 0.019), line, fontsize=6.8, color='#14532D', fontweight='medium')

y_cursor -= 0.185

# 4. Membrete Oficial Profesional (SIN MASTER PLAN Y SIN NÚMERO C.I.V.)
side_ax.text(0.04, y_cursor, "4. CUADRO DE RESPONSABILIDAD TÉCNICA", fontsize=8.2, fontweight='bold', color='#0F172A')
y_cursor -= 0.015

mem_box = patches.Rectangle((0.04, y_cursor - 0.185), 0.92, 0.185,
                            facecolor='#FFFFFF', edgecolor='#0F172A', linewidth=1.4)
side_ax.add_patch(mem_box)

fecha_str = datetime.date.today().strftime("%d/%m/%Y")
side_ax.text(0.07, y_cursor - 0.026, "PROYECTO: CENTRO COMERCIAL MARIO SÁNCHEZ", fontsize=7.2, fontweight='bold', color='#0F172A')
side_ax.text(0.07, y_cursor - 0.048, "PLANO: LEVANTAMIENTO TOPOGRÁFICO Y SUBDIVISIÓN (3 LOTES)", fontsize=6.8, fontweight='bold', color='#475569')
side_ax.text(0.07, y_cursor - 0.070, f"FECHA: {fecha_str}  |  ESCALA: 1:1.000  |  LÁMINA: 01/01", fontsize=6.8, fontweight='bold', color='#0369A1')
side_ax.text(0.07, y_cursor - 0.092, "REVISIÓN: R-03 (SUBDIVISIÓN TRIPLE DEFINITIVA)", fontsize=6.8, fontweight='bold', color='#D97706')

side_ax.plot([0.07, 0.93], [y_cursor - 0.106, y_cursor - 0.106], color='#E2E8F0', linewidth=1.0)

side_ax.text(0.07, y_cursor - 0.125, "RESPONSABLE TÉCNICO:", fontsize=6.6, fontweight='bold', color='#64748B')
side_ax.text(0.07, y_cursor - 0.145, "Ing. Freddy Rodríguez Pérez", fontsize=8.0, fontweight='bold', color='#0F172A')
side_ax.text(0.07, y_cursor - 0.165, "Ingeniería de Proyectos & Control", fontsize=7.0, fontweight='medium', color='#475569')

# Rutas de Exportación
out_dir = "C:/Users/Administrator/Desktop/Memoria/Proyecto Centro Comercial Mario Sánchez/01_Levantamiento_Tecnico_GIS"
os.makedirs(out_dir, exist_ok=True)

out_png = os.path.join(out_dir, "PLANO_EJECUTIVO_ALTA_RESOLUCION.png")
out_pdf = os.path.join(out_dir, "PLANO_EJECUTIVO.pdf")

# Guardar PNG 300 DPI
plt.savefig(out_png, dpi=300, bbox_inches='tight', facecolor='white')
print(f"PNG Alta Resolución generado: {out_png}")

# Guardar PDF Vectorial
plt.savefig(out_pdf, format='pdf', bbox_inches='tight', facecolor='white')
print(f"PDF Vectorial generado: {out_pdf}")

# Copia de scratch para verificación
plt.savefig("C:/Users/Administrator/Desktop/Memoria/scratch_plano_v5.png", dpi=300, bbox_inches='tight', facecolor='white')
plt.close()
print("Proceso completado exitosamente.")
