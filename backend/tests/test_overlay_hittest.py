"""Hit-test for palm overlay taps — mirrors utils/imageLayout.ts nearestLineAtScreen."""

from __future__ import annotations


def _normalized_to_screen(nx: float, ny: float, layout: dict[str, float]) -> tuple[float, float]:
    return (
        layout["offsetX"] + nx * layout["displayWidth"],
        layout["offsetY"] + ny * layout["displayHeight"],
    )


def _dist_to_segment(px: float, py: float, ax: float, ay: float, bx: float, by: float) -> float:
    dx = bx - ax
    dy = by - ay
    len2 = dx * dx + dy * dy
    if len2 <= 1e-8:
        return ((px - ax) ** 2 + (py - ay) ** 2) ** 0.5
    t = ((px - ax) * dx + (py - ay) * dy) / len2
    t = max(0.0, min(1.0, t))
    return ((px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2) ** 0.5


def nearest_line_at_screen(
    geometry: list[dict],
    screen_x: float,
    screen_y: float,
    layout: dict[str, float],
    threshold_px: float = 28,
) -> str | None:
    best_name: str | None = None
    best_dist = float("inf")
    for line in geometry:
        pts = line.get("points") or []
        for i in range(len(pts) - 1):
            a = _normalized_to_screen(pts[i]["x"], pts[i]["y"], layout)
            b = _normalized_to_screen(pts[i + 1]["x"], pts[i + 1]["y"], layout)
            dist = _dist_to_segment(screen_x, screen_y, a[0], a[1], b[0], b[1])
            if dist < best_dist:
                best_dist = dist
                best_name = str(line["name"])
    if best_name is None or best_dist > threshold_px:
        return None
    return best_name


def test_nearest_line_names_the_tapped_crease():
    layout = {"offsetX": 0.0, "offsetY": 0.0, "displayWidth": 200.0, "displayHeight": 200.0}
    geometry = [
        {
            "name": "heart_line",
            "points": [{"x": 0.1, "y": 0.2}, {"x": 0.9, "y": 0.2}],
        },
        {
            "name": "head_line",
            "points": [{"x": 0.1, "y": 0.5}, {"x": 0.9, "y": 0.5}],
        },
        {
            "name": "life_line",
            "points": [{"x": 0.2, "y": 0.2}, {"x": 0.2, "y": 0.9}],
        },
    ]
    assert nearest_line_at_screen(geometry, 100, 40, layout) == "heart_line"
    assert nearest_line_at_screen(geometry, 100, 100, layout) == "head_line"
    assert nearest_line_at_screen(geometry, 40, 120, layout) == "life_line"
    # Far from every crease
    assert nearest_line_at_screen(geometry, 190, 190, layout, threshold_px=10) is None
