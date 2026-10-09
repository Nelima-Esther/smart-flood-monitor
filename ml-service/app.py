"""Independent Flask API for demo flood risk and rainfall models."""

from pathlib import Path

import joblib
import numpy as np
from flask import Flask, jsonify, request

from src.preprocessing import RISK_FEATURES

ROOT_DIR = Path(__file__).resolve().parent
MODEL_DIR = ROOT_DIR / "models"
RISK_MODEL_PATH = MODEL_DIR / "random_forest.joblib"
RAINFALL_MODEL_PATH = MODEL_DIR / "lstm_model.keras"
RAINFALL_SCALER_PATH = MODEL_DIR / "rainfall_scaler.joblib"
RAINFALL_WINDOW_PATH = MODEL_DIR / "rainfall_window.joblib"

V2_MODEL_PATH = MODEL_DIR / "random_forest_v2.joblib"
V2_CONFIG_PATH = MODEL_DIR / "feature_config_v2.joblib"

app = Flask(__name__)


def _json_object():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return None, (jsonify(error="Request body must be a JSON object."), 400)
    return payload, None


def _number(payload, key, allow_negative=False):
    value = payload.get(key)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None, f"'{key}' must be a number."
    if not np.isfinite(value) or (not allow_negative and value < 0):
        qualifier = "finite" if allow_negative else "finite, non-negative"
        return None, f"'{key}' must be a {qualifier} number."
    return float(value), None


@app.get("/health")
def health():
    return jsonify(status="ok", service="smart-flood-monitor-ml")


@app.post("/predict/risk")
def predict_risk():
    payload, error_response = _json_object()
    if error_response:
        return error_response

    features = {}
    for key in RISK_FEATURES:
        value, error = _number(payload, key, allow_negative=(key == "rainfall_change_mm"))
        if error:
            return jsonify(error=error), 400
        features[key] = value
    area = payload.get("area")
    if not isinstance(area, str) or not area.strip():
        return jsonify(error="'area' must be a non-empty string."), 400
    features["area"] = area.strip()

    if not RISK_MODEL_PATH.is_file():
        return jsonify(error="Risk model is not trained yet. Run src/train_random_forest.py first."), 503
    try:
        model = joblib.load(RISK_MODEL_PATH)
        prediction = str(model.predict([features])[0])
        raw_probabilities = model.predict_proba([features])[0]
        probabilities = {
            str(label): float(probability)
            for label, probability in zip(model.classes_, raw_probabilities)
        }
    except Exception as exc:
        app.logger.exception("Risk prediction failed")
        return jsonify(error=f"Could not calculate risk prediction: {exc}"), 500

    return jsonify(
        riskLevel=prediction,
        probabilities=probabilities,
        model="RandomForestClassifier",
        dataMode="demo",
    )

@app.post("/predict/risk-v2")
def predict_risk_v2():
    payload, error_response = _json_object()
    if error_response:
        return error_response

    if not V2_MODEL_PATH.is_file():
        return jsonify(
            error="Random Forest V2 model not found."
        ), 503

    if not V2_CONFIG_PATH.is_file():
        return jsonify(
            error="Random Forest V2 feature configuration not found."
        ), 503

    try:
        config = joblib.load(V2_CONFIG_PATH)
        feature_names = config["features"]

        features = []

        for key in feature_names:
            value, error = _number(payload, key)

            if error:
                return jsonify(error=error), 400

            features.append(value)

        model = joblib.load(V2_MODEL_PATH)

        prediction = int(model.predict([features])[0])

        probabilities = model.predict_proba([features])[0]

        class_probabilities = {
            str(label): float(probability)
            for label, probability in zip(
                model.classes_,
                probabilities
            )
        }

        flood_probability = class_probabilities.get("1", 0.0)

        if flood_probability >= 0.60:
            risk_level = "HIGH"
        elif flood_probability >= 0.30:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

    except Exception as exc:
        app.logger.exception("Random Forest V2 prediction failed")
        return jsonify(
            error=f"Could not calculate V2 risk prediction: {exc}"
        ), 500

    return jsonify(
        prediction=prediction,
        floodProbability=flood_probability,
        riskLevel=risk_level,
        probabilities=class_probabilities,
        model="RandomForestClassifier-V2",
        dataMode="historical-rainfall",
        featuresUsed=feature_names,
    )

@app.post("/predict/rainfall")
def predict_rainfall():
    payload, error_response = _json_object()
    if error_response:
        return error_response
    sequence = payload.get("sequence")
    if not isinstance(sequence, list) or not sequence:
        return jsonify(error="'sequence' must be a non-empty array of rainfall values in mm."), 400
    values = []
    for index, value in enumerate(sequence):
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not np.isfinite(value) or value < 0:
            return jsonify(error=f"'sequence[{index}]' must be a finite, non-negative number."), 400
        values.append(float(value))

    needed = (RAINFALL_MODEL_PATH, RAINFALL_SCALER_PATH, RAINFALL_WINDOW_PATH)
    if not all(path.is_file() for path in needed):
        return jsonify(error="Rainfall model is not trained yet. Run src/train_lstm.py first."), 503
    try:
        from tensorflow import keras
        window = int(joblib.load(RAINFALL_WINDOW_PATH))
        if len(values) < window:
            return jsonify(error=f"'sequence' must contain at least {window} values for this model."), 400
        scaler = joblib.load(RAINFALL_SCALER_PATH)
        model = keras.models.load_model(RAINFALL_MODEL_PATH)
        recent = np.asarray(values[-window:], dtype=np.float32).reshape(-1, 1)
        normalized = scaler.transform(recent).reshape(1, window, 1)
        prediction = float(scaler.inverse_transform(model.predict(normalized, verbose=0))[0, 0])
    except Exception as exc:
        app.logger.exception("Rainfall prediction failed")
        return jsonify(error=f"Could not calculate rainfall prediction: {exc}"), 500

    return jsonify(
        predictedRainfallMm=max(0.0, prediction),
        model="LSTM",
        dataMode="demo",
    )


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
