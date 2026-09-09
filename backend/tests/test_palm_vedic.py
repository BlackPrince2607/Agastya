"""Vedic dossier + secondary-line merge tests."""

from app.schemas.palm import PalmAnalysis
from app.services.palm_ai import parse_vision_line_geometry
from app.services.palm_cv import apply_crease_result, merge_cv_into_analysis
from app.services.palm_crease import CreaseExtractionResult
from app.services.palm_dummy import dummy_palm_analysis
from app.services.palm_vedic import build_palm_dossier
from app.services.report_engine import deterministic_report


def test_dummy_includes_secondary_lines():
    palm = dummy_palm_analysis("vedic-seed")
    assert palm.fate_line
    assert palm.sun_line
    assert palm.marriage_line
    assert palm.mounts


def test_build_palm_dossier_bilingual_and_patterns():
    palm = PalmAnalysis(
        life_line="strong",
        heart_line="straight",
        head_line="long",
        personality="quiet visionary",
        traits=["thoughtful", "resilient"],
        fate_line="moderate",
        sun_line="faint",
        marriage_line="not_clearly_visible",
        mounts={"venus": "prominent", "jupiter": "moderate"},
        analysis_source="openrouter_vision",
        confidence=0.8,
    )
    dossier = build_palm_dossier(palm, gender="female")
    assert dossier["lines"]["life_line"]["rekha"] == "Jeevan Rekha"
    assert dossier["lines"]["heart_line"]["label"] == "Heart Line · Hridaya Rekha"
    assert dossier["lines"]["marriage_line"]["unclear"] is True
    assert "thinking vs emotional openness" in dossier["patternThemes"] or len(dossier["patternThemes"]) >= 1
    assert any(m["label"].startswith("Venus") for m in dossier["mounts"])
    assert "love" in dossier["pillarHints"]
    assert "life_line" in dossier["lockedLines"]
    assert "marriage_line" not in dossier["lockedLines"]


def test_parse_vision_geometry_allows_secondary():
    raw = [
        {"name": "life_line", "points": [{"x": 0.2, "y": 0.3}, {"x": 0.25, "y": 0.5}, {"x": 0.3, "y": 0.7}]},
        {"name": "heart", "points": [{"x": 0.2, "y": 0.25}, {"x": 0.5, "y": 0.22}, {"x": 0.7, "y": 0.28}]},
        {"name": "head_line", "points": [{"x": 0.25, "y": 0.4}, {"x": 0.55, "y": 0.42}]},
        {"name": "fate", "points": [{"x": 0.5, "y": 0.7}, {"x": 0.52, "y": 0.4}, {"x": 0.54, "y": 0.25}]},
        {"name": "sun_line", "points": [{"x": 0.58, "y": 0.65}, {"x": 0.6, "y": 0.35}]},
    ]
    geom = parse_vision_line_geometry(raw)
    assert geom is not None
    names = {g["name"] for g in geom}
    assert {"life_line", "heart_line", "head_line", "fate_line", "sun_line"} <= names


def test_parse_vision_geometry_rejects_two_majors():
    raw = [
        {"name": "life_line", "points": [{"x": 0.2, "y": 0.3}, {"x": 0.25, "y": 0.5}]},
        {"name": "heart", "points": [{"x": 0.2, "y": 0.25}, {"x": 0.5, "y": 0.22}]},
        {"name": "fate", "points": [{"x": 0.5, "y": 0.7}, {"x": 0.52, "y": 0.4}]},
    ]
    assert parse_vision_line_geometry(raw) is None


def test_cv_merge_preserves_secondary_motifs_and_geometry():
    palm = PalmAnalysis(
        life_line="subtle",
        heart_line="broken",
        head_line="short",
        personality="quiet visionary",
        traits=["thoughtful"],
        fate_line="strong",
        sun_line="moderate",
        marriage_line="clear",
        analysis_source="openrouter_vision",
        geometry_source="vision_model",
        line_geometry=[
            {"name": "life_line", "points": [{"x": 0.1, "y": 0.2}, {"x": 0.2, "y": 0.5}]},
            {"name": "heart_line", "points": [{"x": 0.2, "y": 0.2}, {"x": 0.6, "y": 0.25}]},
            {"name": "head_line", "points": [{"x": 0.2, "y": 0.35}, {"x": 0.6, "y": 0.4}]},
            {"name": "fate_line", "points": [{"x": 0.5, "y": 0.7}, {"x": 0.52, "y": 0.3}]},
            {"name": "marriage_line", "points": [{"x": 0.8, "y": 0.35}, {"x": 0.9, "y": 0.36}]},
        ],
    )
    crease = CreaseExtractionResult(
        life_line="strong",
        heart_line="curved",
        head_line="long",
        confidence=0.85,
        geometry_source="opencv_creases",
        image_quality="good",
        line_geometry=[
            {"name": "life_line", "points": [{"x": 0.3, "y": 0.3}, {"x": 0.35, "y": 0.6}, {"x": 0.4, "y": 0.8}]},
            {"name": "heart_line", "points": [{"x": 0.25, "y": 0.28}, {"x": 0.55, "y": 0.26}, {"x": 0.75, "y": 0.3}]},
            {"name": "head_line", "points": [{"x": 0.28, "y": 0.4}, {"x": 0.6, "y": 0.42}, {"x": 0.78, "y": 0.45}]},
        ],
        line_features={
            "life_line": {"depth": "deep", "length_label": "long", "breaks": 0, "notes": "cv"},
        },
    )
    merged = apply_crease_result(palm, crease, prefer_cv_motifs=True)
    assert merged.life_line == "strong"
    assert merged.fate_line == "strong"
    assert merged.sun_line == "moderate"
    assert merged.marriage_line == "clear"
    names = {g["name"] for g in (merged.line_geometry or [])}
    assert "fate_line" in names
    assert "marriage_line" in names
    assert "life_line" in names


def test_merge_keeps_vision_geometry_when_no_cv_image():
    palm = PalmAnalysis(
        life_line="strong",
        heart_line="curved",
        head_line="long",
        personality="quiet visionary",
        traits=["thoughtful"],
        fate_line="faint",
        analysis_source="openrouter_vision",
        geometry_source="vision_model",
        line_geometry=[
            {"name": "life_line", "points": [{"x": 0.1, "y": 0.2}, {"x": 0.3, "y": 0.4}]},
            {"name": "heart_line", "points": [{"x": 0.1, "y": 0.2}, {"x": 0.3, "y": 0.4}]},
            {"name": "head_line", "points": [{"x": 0.1, "y": 0.2}, {"x": 0.3, "y": 0.4}]},
            {"name": "fate_line", "points": [{"x": 0.5, "y": 0.7}, {"x": 0.5, "y": 0.3}]},
        ],
    )
    landmarks = [[0.5, 0.5] for _ in range(21)]
    merged = merge_cv_into_analysis(palm, landmarks, image_base64=None, allow_landmark_heuristic=False)
    assert merged.geometry_source == "vision_model"
    assert any(g["name"] == "fate_line" for g in (merged.line_geometry or []))


def test_geometry_locks_secondary_even_when_motif_unclear():
    palm = PalmAnalysis(
        life_line="strong",
        heart_line="curved",
        head_line="long",
        personality="quiet visionary",
        traits=["thoughtful"],
        marriage_line="not_clearly_visible",
        analysis_source="hybrid",
        geometry_source="opencv_creases",
        line_geometry=[
            {"name": "life_line", "points": [{"x": 0.1, "y": 0.2}, {"x": 0.3, "y": 0.4}]},
            {"name": "heart_line", "points": [{"x": 0.1, "y": 0.2}, {"x": 0.3, "y": 0.4}]},
            {"name": "head_line", "points": [{"x": 0.1, "y": 0.2}, {"x": 0.3, "y": 0.4}]},
            {"name": "marriage_line", "points": [{"x": 0.8, "y": 0.3}, {"x": 0.92, "y": 0.32}]},
        ],
    )
    dossier = build_palm_dossier(palm)
    assert "marriage_line" in dossier["lockedLines"]
    assert dossier["lines"]["marriage_line"]["hasGeometry"] is True


def test_deterministic_report_cites_rekha():
    palm = dummy_palm_analysis("report-seed")
    report = deterministic_report(
        seed="report-seed",
        palm=palm,
        topics=["career"],
        mode="full",
        display_name="Asha",
        gender="female",
    )
    blob = " ".join(s.body for s in report.sections) + report.headline + report.archetype_line
    assert "Rekha" in blob or "Jeevan" in blob or "Hridaya" in blob
    assert "tension" in report.headline.lower() or "pattern" in report.headline.lower()
