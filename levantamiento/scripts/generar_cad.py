import math
import datetime
import pyproj
import ezdxf
from ezdxf import units
from shapely.geometry import Polygon

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

# Huella Central 5.190 m² (Real: 5.189,67 m²)
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

poly_ext_utm_orig = [to_utm(lon, lat) for lon, lat in coords_wgs_p]
poly_int_utm_orig = [to_utm(lon, lat) for lon, lat in coords_wgs_q]
corte1_utm_orig = (to_utm(*corte1_wgs[0]), to_utm(*corte1_wgs[1]))
corte2_utm_orig = (to_utm(*corte2_wgs[0]), to_utm(*corte2_wgs[1]))
boca_acceso_utm_orig = to_utm(*boca_acceso_wgs)
eje_fin_utm_orig = to_utm(*eje_fin_wgs)

poly_ext_geom = Polygon(poly_ext_utm_orig)
poly_int_geom = Polygon(poly_int_utm_orig)

def generate_dxf(filename, is_local=False):
    if is_local:
        ox, oy = poly_ext_utm_orig[0]
        poly_ext_utm = [(x - ox, y - oy) for x, y in poly_ext_utm_orig]
        poly_int_utm = [(x - ox, y - oy) for x, y in poly_int_utm_orig]
        corte1_utm = ((corte1_utm_orig[0][0] - ox, corte1_utm_orig[0][1] - oy), (corte1_utm_orig[1][0] - ox, corte1_utm_orig[1][1] - oy))
        corte2_utm = ((corte2_utm_orig[0][0] - ox, corte2_utm_orig[0][1] - oy), (corte2_utm_orig[1][0] - ox, corte2_utm_orig[1][1] - oy))
        boca_acceso_utm = (boca_acceso_utm_orig[0] - ox, boca_acceso_utm_orig[1] - oy)
        eje_fin_utm = (eje_fin_utm_orig[0] - ox, eje_fin_utm_orig[1] - oy)
        coord_sys_str = "SISTEMA LOCAL RELATIVO P1 (0,0) - PLANO TOPOGRÁFICO Y SUBDIVISIÓN"
    else:
        poly_ext_utm = list(poly_ext_utm_orig)
        poly_int_utm = list(poly_int_utm_orig)
        corte1_utm = corte1_utm_orig
        corte2_utm = corte2_utm_orig
        boca_acceso_utm = boca_acceso_utm_orig
        eje_fin_utm = eje_fin_utm_orig
        coord_sys_str = "SISTEMA REGVEN / UTM HUSO 19N (EPSG:32619) - DATUM WGS84"

    doc = ezdxf.new("R2018", setup=True)
    doc.units = units.M
    msp = doc.modelspace()

    # Capas Técnicas Oficiales de Alta Gama
    capas = [
        {"name": "0_POLIGONO_GENERAL", "color": 4, "lineweight": 50},        # Cyan (0.50mm)
        {"name": "0_HUELLA_CENTRAL", "color": 2, "lineweight": 40},          # Yellow (0.40mm)
        {"name": "SUBDIVISION_LOT_C01", "color": 30, "lineweight": 35},      # Naranja / C01
        {"name": "SUBDIVISION_LOT_C02", "color": 140, "lineweight": 35},     # Cyan / C02
        {"name": "SUBDIVISION_LOT_C03", "color": 210, "lineweight": 35},     # Magenta / C03
        {"name": "0_DIVISORIAS_INTERNAS", "color": 1, "lineweight": 35},     # Rojo Discontinuo (0.35mm)
        {"name": "0_COTAS_METRICAS", "color": 1, "lineweight": 18},          # Rojo Fino (0.18mm)
        {"name": "0_ESTACIONAMIENTOS", "color": 3, "lineweight": 25},        # Verde (0.25mm)
        {"name": "0_ACCESO_VIAL", "color": 6, "lineweight": 30},             # Magenta (0.30mm)
        {"name": "0_CIRCULACION_GANDOLAS", "color": 3, "lineweight": 50},    # Verde Grueso (0.50mm)
        {"name": "0_TEXTOS_COTAS", "color": 7, "lineweight": 25},            # Blanco (0.25mm)
        {"name": "0_CUADRO_TECNICO", "color": 7, "lineweight": 30},          # Blanco (0.30mm)
        {"name": "0_GRILLA_UTM", "color": 8, "lineweight": 13},              # Gris Tenue (0.13mm)
    ]

    for c in capas:
        if c["name"] not in doc.layers:
            doc.layers.add(name=c["name"], color=c["color"], lineweight=c["lineweight"])

    # 1. Polígono General
    poly_ext_pts = [(p[0], p[1], 0) for p in poly_ext_utm]
    msp.add_lwpolyline(poly_ext_pts, close=True, dxfattribs={"layer": "0_POLIGONO_GENERAL"})

    # Vértices P1-P4
    p_labels = [
        f"P1 (SW): X={poly_ext_utm[0][0]:.2f}, Y={poly_ext_utm[0][1]:.2f}",
        f"P2 (SE): X={poly_ext_utm[1][0]:.2f}, Y={poly_ext_utm[1][1]:.2f}",
        f"P3 (NE): X={poly_ext_utm[2][0]:.2f}, Y={poly_ext_utm[2][1]:.2f}",
        f"P4 (NW): X={poly_ext_utm[3][0]:.2f}, Y={poly_ext_utm[3][1]:.2f}"
    ]
    for pt, lbl in zip(poly_ext_utm, p_labels):
        msp.add_circle((pt[0], pt[1], 0), radius=0.8, dxfattribs={"layer": "0_POLIGONO_GENERAL"})
        msp.add_text(lbl, height=1.2, dxfattribs={"layer": "0_TEXTOS_COTAS"}).set_placement((pt[0] + 1.5, pt[1] + 1.5, 0))

    # 2. Huella Central Envolvente
    poly_int_pts = [(q[0], q[1], 0) for q in poly_int_utm]
    msp.add_lwpolyline(poly_int_pts, close=True, dxfattribs={"layer": "0_HUELLA_CENTRAL"})

    # 3. Subdivisión en 3 Macro-Lotes (Geometrías cerradas y rayados)
    lote1_pts = [poly_int_utm[0], corte1_utm[0], corte1_utm[1], poly_int_utm[3]]
    lote2_pts = [corte1_utm[0], corte2_utm[0], corte2_utm[1], corte1_utm[1]]
    lote3_pts = [corte2_utm[0], poly_int_utm[1], poly_int_utm[2], corte2_utm[1]]

    msp.add_lwpolyline([(p[0], p[1], 0) for p in lote1_pts], close=True, dxfattribs={"layer": "SUBDIVISION_LOT_C01"})
    msp.add_lwpolyline([(p[0], p[1], 0) for p in lote2_pts], close=True, dxfattribs={"layer": "SUBDIVISION_LOT_C02"})
    msp.add_lwpolyline([(p[0], p[1], 0) for p in lote3_pts], close=True, dxfattribs={"layer": "SUBDIVISION_LOT_C03"})

    # Líneas divisorias de corte (Discontinuas)
    msp.add_line((corte1_utm[0][0], corte1_utm[0][1], 0), (corte1_utm[1][0], corte1_utm[1][1], 0),
                 dxfattribs={"layer": "0_DIVISORIAS_INTERNAS", "linetype": "DASHED"})
    msp.add_line((corte2_utm[0][0], corte2_utm[0][1], 0), (corte2_utm[1][0], corte2_utm[1][1], 0),
                 dxfattribs={"layer": "0_DIVISORIAS_INTERNAS", "linetype": "DASHED"})

    # Vértices de corte
    for cpt in [corte1_utm[0], corte1_utm[1], corte2_utm[0], corte2_utm[1]]:
        msp.add_circle((cpt[0], cpt[1], 0), radius=0.45, dxfattribs={"layer": "0_DIVISORIAS_INTERNAS"})

    # Etiquetas de Macro-Lotes
    c1_x = sum(p[0] for p in lote1_pts) / 4.0
    c1_y = sum(p[1] for p in lote1_pts) / 4.0
    msp.add_text("LOT-C01 (NORTE) - 1.730 m2", height=1.8, dxfattribs={"layer": "SUBDIVISION_LOT_C01"}).set_placement((c1_x - 14.0, c1_y + 1.2, 0))
    msp.add_text("FTE. VIAL OESTE: 27.95 m | SHOWROOM / RETAIL", height=1.0, dxfattribs={"layer": "0_TEXTOS_COTAS"}).set_placement((c1_x - 18.0, c1_y - 1.4, 0))

    c2_x = sum(p[0] for p in lote2_pts) / 4.0
    c2_y = sum(p[1] for p in lote2_pts) / 4.0
    msp.add_text("LOT-C02 (CENTRO) - 1.730 m2", height=1.8, dxfattribs={"layer": "SUBDIVISION_LOT_C02"}).set_placement((c2_x - 14.0, c2_y + 1.2, 0))
    msp.add_text("FTE. VIAL OESTE: 27.95 m | LOGISTICA Y DISTRIBUCION", height=1.0, dxfattribs={"layer": "0_TEXTOS_COTAS"}).set_placement((c2_x - 18.0, c2_y - 1.4, 0))

    c3_x = sum(p[0] for p in lote3_pts) / 4.0
    c3_y = sum(p[1] for p in lote3_pts) / 4.0
    msp.add_text("LOT-C03 (SUR) - 1.730 m2", height=1.8, dxfattribs={"layer": "SUBDIVISION_LOT_C03"}).set_placement((c3_x - 14.0, c3_y + 1.2, 0))
    msp.add_text("FTE. VIAL OESTE: 27.96 m | TALLER / PATIO CARGA", height=1.0, dxfattribs={"layer": "0_TEXTOS_COTAS"}).set_placement((c3_x - 18.0, c3_y - 1.4, 0))

    # Vértices Q1-Q4
    q_labels = [
        f"Q1 (NW): X={poly_int_utm[0][0]:.2f}, Y={poly_int_utm[0][1]:.2f}",
        f"Q2 (SW): X={poly_int_utm[1][0]:.2f}, Y={poly_int_utm[1][1]:.2f}",
        f"Q3 (SE): X={poly_int_utm[2][0]:.2f}, Y={poly_int_utm[2][1]:.2f}",
        f"Q4 (NE): X={poly_int_utm[3][0]:.2f}, Y={poly_int_utm[3][1]:.2f}"
    ]
    for pt, lbl in zip(poly_int_utm, q_labels):
        msp.add_circle((pt[0], pt[1], 0), radius=0.6, dxfattribs={"layer": "0_HUELLA_CENTRAL"})
        msp.add_text(lbl, height=1.0, dxfattribs={"layer": "0_TEXTOS_COTAS"}).set_placement((pt[0] + 1.0, pt[1] - 2.5, 0))

    # 4. Eje de Acceso Vial (11.50 m de ancho x 76.00 m de largo)
    msp.add_line((boca_acceso_utm[0], boca_acceso_utm[1], 0), (eje_fin_utm[0], eje_fin_utm[1], 0),
                 dxfattribs={"layer": "0_ACCESO_VIAL", "linetype": "CENTER"})

    dx_e = eje_fin_utm[0] - boca_acceso_utm[0]
    dy_e = eje_fin_utm[1] - boca_acceso_utm[1]
    dist_eje = math.hypot(dx_e, dy_e)
    ux_e = dx_e / dist_eje
    uy_e = dy_e / dist_eje
    px_e = -uy_e * (11.5 / 2.0)
    py_e = ux_e * (11.5 / 2.0)

    msp.add_line((boca_acceso_utm[0] - px_e, boca_acceso_utm[1] - py_e, 0), (boca_acceso_utm[0] + px_e, boca_acceso_utm[1] + py_e, 0), dxfattribs={"layer": "0_ACCESO_VIAL"})
    msp.add_line((eje_fin_utm[0] - px_e, eje_fin_utm[1] - py_e, 0), (eje_fin_utm[0] + px_e, eje_fin_utm[1] + py_e, 0), dxfattribs={"layer": "0_ACCESO_VIAL"})
    msp.add_line((boca_acceso_utm[0] - px_e, boca_acceso_utm[1] - py_e, 0), (eje_fin_utm[0] - px_e, eje_fin_utm[1] - py_e, 0), dxfattribs={"layer": "0_ACCESO_VIAL"})
    msp.add_line((boca_acceso_utm[0] + px_e, boca_acceso_utm[1] + py_e, 0), (eje_fin_utm[0] + px_e, eje_fin_utm[1] + py_e, 0), dxfattribs={"layer": "0_ACCESO_VIAL"})

    msp.add_text("BOCA DE ACCESO AV. MUNICIPAL (11.50 m)", height=1.3, dxfattribs={"layer": "0_TEXTOS_COTAS"}).set_placement(
        (boca_acceso_utm[0] - 25.0, boca_acceso_utm[1] + 5.0, 0)
    )
    msp.add_text(f"EJE ACCESO: {dist_eje:.2f} m (Nominal 76.00 m)", height=1.2, dxfattribs={"layer": "0_TEXTOS_COTAS"}).set_placement(
        ((boca_acceso_utm[0] + eje_fin_utm[0])/2 - 15, (boca_acceso_utm[1] + eje_fin_utm[1])/2 + 4.0, 0)
    )

    # 5. Avenida de Servicio Oeste (20.00 m) y Batería de 34 Puestos a 90°
    dx_w = poly_int_utm[1][0] - poly_int_utm[0][0]
    dy_w = poly_int_utm[1][1] - poly_int_utm[0][1]
    L_w = math.hypot(dx_w, dy_w)
    ux_w, uy_w = dx_w / L_w, dy_w / L_w
    nx_w, ny_w = -uy_w * 20.0, ux_w * 20.0

    # Contorno vial de 20.00 m libres
    msp.add_line((poly_int_utm[0][0] + nx_w, poly_int_utm[0][1] + ny_w, 0),
                 (poly_int_utm[1][0] + nx_w, poly_int_utm[1][1] + ny_w, 0),
                 dxfattribs={"layer": "0_ESTACIONAMIENTOS", "linetype": "DASHED"})

    # 34 puestos de 2.50m x 5.00m a 90°
    num_stalls = 34
    stall_w = L_w / num_stalls
    for i in range(num_stalls + 1):
        bx = poly_int_utm[0][0] + ux_w * (i * stall_w)
        by = poly_int_utm[0][1] + uy_w * (i * stall_w)
        ox = bx + nx_w * (5.0 / 20.0)
        oy = by + ny_w * (5.0 / 20.0)
        msp.add_line((bx, by, 0), (ox, oy, 0), dxfattribs={"layer": "0_ESTACIONAMIENTOS"})

    # Línea frontal de puestos
    msp.add_line((poly_int_utm[0][0] + nx_w * 0.25, poly_int_utm[0][1] + ny_w * 0.25, 0),
                 (poly_int_utm[1][0] + nx_w * 0.25, poly_int_utm[1][1] + ny_w * 0.25, 0),
                 dxfattribs={"layer": "0_ESTACIONAMIENTOS", "linetype": "DASHED"})

    # 6. Función de Cotas Métricas Arquitectónicas con Ticks a 45°
    def add_arch_dimension(p1, p2, label, offset_dist=4.0, layer="0_COTAS_METRICAS"):
        x1, y1 = p1
        x2, y2 = p2
        dx = x2 - x1
        dy = y2 - y1
        L = math.hypot(dx, dy)
        if L == 0: return
        nx = -dy / L * offset_dist
        ny = dx / L * offset_dist
        
        d1 = (x1 + nx, y1 + ny)
        d2 = (x2 + nx, y2 + ny)
        mid = ((d1[0] + d2[0])/2.0, (d1[1] + d2[1])/2.0)
        
        # Líneas de referencia y línea de cota
        msp.add_line((x1, y1, 0), (d1[0], d1[1], 0), dxfattribs={"layer": layer})
        msp.add_line((x2, y2, 0), (d2[0], d2[1], 0), dxfattribs={"layer": layer})
        msp.add_line((d1[0], d1[1], 0), (d2[0], d2[1], 0), dxfattribs={"layer": layer})
        
        # Ticks a 45°
        tick_s = 0.9
        msp.add_line((d1[0] - tick_s, d1[1] - tick_s, 0), (d1[0] + tick_s, d1[1] + tick_s, 0), dxfattribs={"layer": layer})
        msp.add_line((d2[0] - tick_s, d2[1] - tick_s, 0), (d2[0] + tick_s, d2[1] + tick_s, 0), dxfattribs={"layer": layer})
        
        ang_deg = math.degrees(math.atan2(dy, dx))
        if ang_deg > 90:
            ang_deg -= 180
        elif ang_deg < -90:
            ang_deg += 180
            
        txt = msp.add_text(label, height=1.3, dxfattribs={"layer": "0_TEXTOS_COTAS", "rotation": ang_deg})
        txt.set_placement((mid[0] + (-dy/L)*1.2, mid[1] + (dx/L)*1.2, 0))

    # Cotas Perímetro Exterior
    add_arch_dimension(poly_ext_utm[0], poly_ext_utm[1], "SUR: 101.88 m", offset_dist=-6.0)
    add_arch_dimension(poly_ext_utm[1], poly_ext_utm[2], "ESTE: 136.42 m", offset_dist=6.0)
    add_arch_dimension(poly_ext_utm[2], poly_ext_utm[3], "NORTE: 108.47 m", offset_dist=6.0)
    add_arch_dimension(poly_ext_utm[3], poly_ext_utm[0], "OESTE: 133.85 m", offset_dist=-6.0)

    # Cotas Huella Central
    add_arch_dimension(poly_int_utm[3], poly_int_utm[0], "FTE. NORTE: 64.31 m", offset_dist=3.5)
    add_arch_dimension(poly_int_utm[1], poly_int_utm[2], "FTE. SUR: 62.38 m", offset_dist=-3.5)
    add_arch_dimension(poly_int_utm[2], poly_int_utm[3], "LAT. ESTE: 79.56 m", offset_dist=-3.5)
    add_arch_dimension(poly_int_utm[0], poly_int_utm[1], "LAT. OESTE: 83.86 m", offset_dist=-6.5)

    # Cotas de frentes viales por Lote
    add_arch_dimension(poly_int_utm[0], corte1_utm[0], "C01: 27.95 m", offset_dist=-2.5)
    add_arch_dimension(corte1_utm[0], corte2_utm[0], "C02: 27.95 m", offset_dist=-2.5)
    add_arch_dimension(corte2_utm[0], poly_int_utm[1], "C03: 27.96 m", offset_dist=-2.5)

    # Cotas Divisorias Internas
    add_arch_dimension(corte1_utm[0], corte1_utm[1], "DIVISORIA 1 (C01/C02): 63.13 m", offset_dist=2.0)
    add_arch_dimension(corte2_utm[0], corte2_utm[1], "DIVISORIA 2 (C02/C03): 62.56 m", offset_dist=2.0)

    # Textos de Vialidad y Maniobras
    msp.add_text("PASILLO OESTE: 20.00 m (AV. DE SERVICIO: GANDOLAS + ESTACIONAMIENTO 90° ~35 PUESTOS)", height=1.3, dxfattribs={"layer": "0_TEXTOS_COTAS"}).set_placement(
        (poly_int_utm[0][0] - 42.0, poly_int_utm[0][1] - 20.0, 0)
    )
    msp.add_text("PATIO SUR: 20.00 m (MANIOBRA Y CARGA PESADA REPUESTOS DE ORIENTE)", height=1.3, dxfattribs={"layer": "0_TEXTOS_COTAS"}).set_placement(
        (poly_int_utm[1][0] - 10.0, poly_int_utm[1][1] - 12.0, 0)
    )
    msp.add_text("PASILLO ESTE: 23.80 m (TRÁNSITO, RETORNO Y ESTACIONAMIENTO CLIENTES)", height=1.3, dxfattribs={"layer": "0_TEXTOS_COTAS"}).set_placement(
        (poly_int_utm[3][0] + 5.0, poly_int_utm[3][1] - 20.0, 0)
    )
    msp.add_text("RETIRO NORTE: 23.86 m (ESTACIONAMIENTO CLIENTES / ACCESO)", height=1.3, dxfattribs={"layer": "0_TEXTOS_COTAS"}).set_placement(
        (poly_int_utm[3][0] - 35.0, poly_int_utm[3][1] + 8.0, 0)
    )

    # 7. Anillo Vial de Carga (Flechas de Sentido Horario)
    def add_flow_arrow(start_pt, end_pt):
        msp.add_line((start_pt[0], start_pt[1], 0), (end_pt[0], end_pt[1], 0), dxfattribs={"layer": "0_CIRCULACION_GANDOLAS", "lineweight": 50})
        dx = end_pt[0] - start_pt[0]
        dy = end_pt[1] - start_pt[1]
        L = math.hypot(dx, dy)
        if L == 0: return
        ux, uy = dx/L, dy/L
        arrow_len = 3.5
        arrow_w = 1.2
        p_arr1 = (end_pt[0] - arrow_len*ux + arrow_w*(-uy), end_pt[1] - arrow_len*uy + arrow_w*ux)
        p_arr2 = (end_pt[0] - arrow_len*ux - arrow_w*(-uy), end_pt[1] - arrow_len*uy - arrow_w*ux)
        msp.add_line((end_pt[0], end_pt[1], 0), (p_arr1[0], p_arr1[1], 0), dxfattribs={"layer": "0_CIRCULACION_GANDOLAS", "lineweight": 50})
        msp.add_line((end_pt[0], end_pt[1], 0), (p_arr2[0], p_arr2[1], 0), dxfattribs={"layer": "0_CIRCULACION_GANDOLAS", "lineweight": 50})

    add_flow_arrow((poly_int_utm[0][0] - 12.0, poly_int_utm[0][1] - 10.0), (poly_int_utm[1][0] - 12.0, poly_int_utm[1][1] + 10.0))
    add_flow_arrow((poly_int_utm[1][0] + 8.0, poly_int_utm[1][1] - 8.0), (poly_int_utm[2][0] - 10.0, poly_int_utm[2][1] - 8.0))
    add_flow_arrow((poly_int_utm[2][0] + 12.0, poly_int_utm[2][1] + 10.0), (poly_int_utm[3][0] + 12.0, poly_int_utm[3][1] - 10.0))
    add_flow_arrow((poly_int_utm[3][0] + 8.0, poly_int_utm[3][1] + 10.0), (poly_int_utm[3][0] - 15.0, poly_int_utm[3][1] + 12.0))
    add_flow_arrow((poly_int_utm[3][0] - 15.0, poly_int_utm[3][1] + 12.0), (poly_int_utm[0][0] + 10.0, poly_int_utm[0][0] + 12.0))

    # 8. Membrete Técnico Oficial Tipo Cuadro CAD (SIN MASTER PLAN Y SIN C.I.V.)
    min_x = min(p[0] for p in poly_ext_utm) - 30
    min_y = min(p[1] for p in poly_ext_utm) - 40
    fecha_hoy = datetime.date.today().strftime("%d/%m/%Y")

    t_lines = [
        "=========================================================================================",
        "PROYECTO: CENTRO COMERCIAL MARIO SANCHEZ - PLANO TOPOGRAFICO Y SUBDIVISION",
        "PLANO: LEVANTAMIENTO TOPOGRAFICO Y SUBDIVISION EN TRES (3) MACRO-LOTES COMERCIALES",
        "UBICACION: AV. INTERCOMUNAL JORGE RODRIGUEZ / AV. MUNICIPAL, PUERTO LA CRUZ, ANZOATEGUI",
        f"SISTEMA DE COORDENADAS: {coord_sys_str}",
        "AREA GENERAL DEL TERRENO: 14.207,00 m2 (1,421 Ha) | PERIMETRO: 480,62 m",
        "AREA HUELLA CENTRAL COMERCIAL: 5.189,67 m2 (100%) | PERIMETRO: 290,11 m",
        "-----------------------------------------------------------------------------------------",
        "CUADRO DE SUBDIVISION DE LA HUELLA CENTRAL:",
        "  - LOT-C01 (NORTE):  1.730,00 m2 | FTE. VIAL OESTE: 27.95 m | RETAIL / SHOWROOM",
        "  - LOT-C02 (CENTRO): 1.730,00 m2 | FTE. VIAL OESTE: 27.95 m | LOGISTICA Y DISTRIBUCION",
        "  - LOT-C03 (SUR):    1.730,00 m2 | FTE. VIAL OESTE: 27.96 m | TALLER / PATIO CARGA PESADA",
        "-----------------------------------------------------------------------------------------",
        "PARAMETROS DE LOGISTICA Y VIALIDAD:",
        "  - PASILLO OESTE: 20.00 m LIBRES (AV. SERVICIO GANDOLAS + BATERIA ESTAC. 90° ~35 PUESTOS)",
        "  - PATIO SUR: 20.00 m LIBRES (MANIOBRA Y DESCARGA REPUESTOS DE ORIENTE)",
        "  - RETIRO NORTE: 23.86 m (ACCESO & ESTACIONAMIENTO CLIENTES)",
        "  - PASILLO ESTE: 23.80 m (RETORNO Y TRANSITO PESADO)",
        "  - SENTIDO DE CIRCULACION: HORARIO OBLIGATORIO PARA GANDOLAS",
        f"FECHA: {fecha_hoy} | ESCALA: 1:1.000 | LAMINA: 01/01 | REVISION: R-03 (TRIPLE SUBDIVISION)",
        "-----------------------------------------------------------------------------------------",
        "RESPONSABLE TECNICO:",
        "Ing. Freddy Rodriguez Perez",
        "Ingenieria de Proyectos & Control",
        "========================================================================================="
    ]

    for i, line in enumerate(t_lines):
        msp.add_text(line, height=1.4, dxfattribs={"layer": "0_CUADRO_TECNICO"}).set_placement(
            (min_x, min_y - (i * 2.6), 0)
        )

    doc.saveas(filename)
    print(f"Archivo CAD exportado exitosamente: {filename}")

# Generar versión UTM 19N y versión Local (0,0)
out_cad_dir = "C:/Users/Administrator/Desktop/Memoria/Proyecto Centro Comercial Mario Sánchez/01_Levantamiento_Tecnico_GIS"
generate_dxf(f"{out_cad_dir}/PLANO_CC_MARIO_SANCHEZ.dxf", is_local=False)
generate_dxf(f"{out_cad_dir}/PLANO_CC_MARIO_SANCHEZ_LOCAL.dxf", is_local=True)
