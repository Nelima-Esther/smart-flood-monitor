"""Train and evaluate a demo LSTM for next-period rainfall prediction."""

import argparse
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.preprocessing import MinMaxScaler
from tensorflow import keras

from src.preprocessing import DEFAULT_DATA_PATH, make_sequences

ROOT_DIR = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT_DIR / "models" / "lstm_model.keras"
SCALER_PATH = ROOT_DIR / "models" / "rainfall_scaler.joblib"
WINDOW_PATH = ROOT_DIR / "models" / "rainfall_window.joblib"


def train(csv_path=DEFAULT_DATA_PATH, window=12, epochs=30, batch_size=16):
    frame = pd.read_csv(csv_path)
    if "rainfall_mm" not in frame:
        raise ValueError("Training CSV must include a 'rainfall_mm' column.")
    rainfall = pd.to_numeric(frame["rainfall_mm"], errors="raise").to_numpy(dtype=np.float32)
    if not np.isfinite(rainfall).all() or (rainfall < 0).any():
        raise ValueError("'rainfall_mm' values must be finite and non-negative.")
    if len(rainfall) <= window + 1:
        raise ValueError(f"Need at least {window + 2} rainfall rows for training and validation.")

    # Split chronologically before fitting normalization to avoid validation leakage.
    split_at = int(len(rainfall) * 0.8)
    scaler = MinMaxScaler()
    scaler.fit(rainfall[:split_at].reshape(-1, 1))
    scaled = scaler.transform(rainfall.reshape(-1, 1)).reshape(-1)
    x_all, y_all = make_sequences(scaled, window)
    target_positions = np.arange(window, len(rainfall))
    train_mask = target_positions < split_at
    val_mask = ~train_mask
    if train_mask.sum() < 1 or val_mask.sum() < 1:
        raise ValueError("Not enough rows for the requested window and validation split.")
    x_train, y_train = x_all[train_mask], y_all[train_mask]
    x_val, y_val = x_all[val_mask], y_all[val_mask]

    keras.utils.set_random_seed(42)
    model = keras.Sequential([
        keras.layers.Input(shape=(window, 1)),
        keras.layers.LSTM(32),
        keras.layers.Dense(16, activation="relu"),
        keras.layers.Dense(1),
    ])
    model.compile(optimizer="adam", loss="mean_squared_error")
    model.fit(
        x_train,
        y_train,
        validation_data=(x_val, y_val),
        epochs=epochs,
        batch_size=batch_size,
        shuffle=False,
        verbose=1,
        callbacks=[keras.callbacks.EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True)],
    )
    predicted_scaled = model.predict(x_val, verbose=0)
    actual = scaler.inverse_transform(y_val.reshape(-1, 1)).reshape(-1)
    predicted = scaler.inverse_transform(predicted_scaled).reshape(-1)
    print(f"Validation MAE:  {mean_absolute_error(actual, predicted):.3f} mm")
    print(f"Validation RMSE: {np.sqrt(mean_squared_error(actual, predicted)):.3f} mm")

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    model.save(MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    joblib.dump(window, WINDOW_PATH)
    print(f"Saved model to {MODEL_PATH}")
    print(f"Saved scaler to {SCALER_PATH}")
    print(f"Saved sequence window ({window}) to {WINDOW_PATH}")
    return model


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", type=Path, default=DEFAULT_DATA_PATH)
    parser.add_argument("--window", type=int, default=12)
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--batch-size", type=int, default=16)
    args = parser.parse_args()
    train(args.csv, args.window, args.epochs, args.batch_size)
