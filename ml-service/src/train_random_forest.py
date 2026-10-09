"""Train and evaluate the demo Random Forest risk classifier."""

import argparse
from pathlib import Path

import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

from src.preprocessing import DEFAULT_DATA_PATH, RISK_FEATURES, TARGET, load_risk_data, make_risk_preprocessor

RANDOM_STATE = 42
MODEL_PATH = Path(__file__).resolve().parents[1] / "models" / "random_forest.joblib"


def train(csv_path=DEFAULT_DATA_PATH, model_path=MODEL_PATH):
    frame = load_risk_data(csv_path)
    counts = frame[TARGET].value_counts()
    if counts.min() < 2:
        raise ValueError("Each risk class needs at least two rows for a stratified train/test split.")
    x_train, x_test, y_train, y_test = train_test_split(
        frame[RISK_FEATURES + ["area"]],
        frame[TARGET],
        test_size=0.25,
        random_state=RANDOM_STATE,
        stratify=frame[TARGET],
    )
    pipeline = Pipeline(
        steps=[
            ("preprocessing", make_risk_preprocessor()),
            ("classifier", RandomForestClassifier(
                n_estimators=200,
                class_weight="balanced",
                random_state=RANDOM_STATE,
                n_jobs=-1,
            )),
        ]
    )
    pipeline.fit(x_train, y_train)
    predicted = pipeline.predict(x_test)
    print(f"Accuracy:  {accuracy_score(y_test, predicted):.3f}")
    print(f"Precision: {precision_score(y_test, predicted, average='macro', zero_division=0):.3f}")
    print(f"Recall:    {recall_score(y_test, predicted, average='macro', zero_division=0):.3f}")
    print(f"F1-score:  {f1_score(y_test, predicted, average='macro', zero_division=0):.3f}")
    print("\nClassification report:")
    print(classification_report(y_test, predicted, labels=["WATCH", "ADVISORY", "WARNING"], zero_division=0))
    model_path = Path(model_path)
    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, model_path)
    print(f"Saved model to {model_path}")
    return pipeline


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", type=Path, default=DEFAULT_DATA_PATH)
    parser.add_argument("--output", type=Path, default=MODEL_PATH)
    args = parser.parse_args()
    train(args.csv, args.output)
