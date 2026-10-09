"""Shared feature and sequence preparation for independent model training."""

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler

ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DATA_PATH = ROOT_DIR / "data" / "training_data.csv"

RISK_FEATURES = [
    "rainfall_mm",
    "rainfall_duration_hours",
    "rainfall_6h_mm",
    "rainfall_12h_mm",
    "rainfall_intensity_mm_per_hour",
    "rainfall_change_mm",
]
AREA_FEATURE = "area"
TARGET = "risk_level"
RISK_CLASSES = ("WATCH", "ADVISORY", "WARNING")


def load_risk_data(csv_path=DEFAULT_DATA_PATH):
    """Load and validate tabular data used by the risk classifier."""
    frame = pd.read_csv(csv_path)
    required = set(RISK_FEATURES + [AREA_FEATURE, TARGET])
    missing = sorted(required.difference(frame.columns))
    if missing:
        raise ValueError(f"Training CSV is missing required columns: {', '.join(missing)}")
    frame = frame.dropna(subset=list(required)).copy()
    for feature in RISK_FEATURES:
        frame[feature] = pd.to_numeric(frame[feature], errors="raise")
        if (frame[feature] < 0).any():
            raise ValueError(f"'{feature}' values must be non-negative.")
    frame[AREA_FEATURE] = frame[AREA_FEATURE].astype(str)
    frame[TARGET] = frame[TARGET].astype(str).str.upper()
    unexpected = sorted(set(frame[TARGET]) - set(RISK_CLASSES))
    if unexpected:
        raise ValueError(f"Unexpected risk classes: {', '.join(unexpected)}")
    if frame[TARGET].nunique() < 2:
        raise ValueError("Training data must contain at least two risk classes.")
    return frame


def make_risk_preprocessor():
    """Scale numeric measurements and one-hot encode monitored area names."""
    return ColumnTransformer(
        transformers=[
            ("numeric", StandardScaler(), RISK_FEATURES),
            ("area", OneHotEncoder(handle_unknown="ignore"), [AREA_FEATURE]),
        ]
    )


def make_sequences(values, window):
    """Convert a one-dimensional series into window -> next-value examples."""
    values = np.asarray(values, dtype=np.float32).reshape(-1)
    if window < 1:
        raise ValueError("window must be at least 1")
    if len(values) <= window:
        raise ValueError(f"Need more than {window} rainfall observations to make sequences")
    features = np.stack([values[i : i + window] for i in range(len(values) - window)])
    targets = values[window:]
    return features[..., np.newaxis], targets
