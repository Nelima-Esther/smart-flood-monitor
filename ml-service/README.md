# Smart Flood Monitor ML Service

An independently runnable Flask service with a Random Forest risk classifier and an LSTM next-period rainfall model. Both models are trained from CSV data in this directory; the service has no database or external service connection.

## Important data note

`data/training_data.csv` is a small, clearly labelled synthetic SAMPLE/DEMO dataset created only to exercise the training pipeline. It is **not observed Nairobi weather data**, and the resulting models are demonstrations rather than production-ready or scientifically validated models. Replace it with verified historical rainfall/weather data from approved project sources before drawing operational conclusions.

## Setup and train

From `ml-service/`, create/activate a Python virtual environment, then run:

```sh
python -m pip install -r requirements.txt
python -m src.train_random_forest
python -m src.train_lstm
python app.py
```

The LSTM uses a 12-observation window by default. Configure it with `python -m src.train_lstm --window 12 --epochs 30`; its trained window and normalization scaler are saved alongside the model. For a different CSV, pass `--csv path/to/file.csv` to either trainer. The CSV must include `rainfall_mm`, the six classifier features, `area`, and `risk_level`.

Training writes `models/random_forest.joblib` and `models/lstm_model.keras`, plus the LSTM scaler and window metadata. The model artifacts are generated locally and are not committed as pre-trained/validated models.

## API

- `GET /health` reports service status.
- `POST /predict/risk` expects JSON fields `rainfall_mm`, `rainfall_duration_hours`, `rainfall_6h_mm`, `rainfall_12h_mm`, `rainfall_intensity_mm_per_hour`, `rainfall_change_mm`, and `area`. It returns `riskLevel`, class `probabilities`, `model`, and `dataMode`.
- `POST /predict/rainfall` expects `{"sequence": [ ... ]}` with at least the model's configured number of prior rainfall observations in millimetres. It returns `predictedRainfallMm`, `model`, and `dataMode`.

Prediction endpoints return `503` with a useful message until their model artifacts have been trained. Responses use `dataMode: "demo"` for this sample-data setup.

## Random Forest V2

The V2 risk endpoint uses a trained Random Forest classifier and a feature configuration saved in `models/`. It accepts the following rainfall features in millimetres, except rainfall intensity (mm/hour) and duration (hours):

* `daily_rainfall_mm`
* `rainfall_previous_day_mm`
* `rainfall_two_days_before_mm`
* `rainfall_3day_total_mm`
* `rainfall_5day_total_mm`
* `rainfall_7day_total_mm`
* `max_rainfall_6h_mm`
* `max_rainfall_12h_mm`
* `max_rainfall_intensity_mm_per_hour`
* `max_rainfall_duration_hours`

Use `POST /predict/risk-v2` with a JSON object containing all ten features. The response includes the predicted class, estimated flood probability, risk level, and features used.

**Research limitation:** The V2 model was evaluated on a time-based test set and failed to identify the two flood-labelled test observations. It is experimental and must not be treated as a validated flood-warning system. Report its limitations honestly and validate it with additional verified flood and rainfall records before operational use.

For a lightweight API deployment, `requirements-api.txt` lists the dependencies needed for the Random Forest endpoint. The full `requirements.txt` remains available for training and the LSTM rainfall endpoint.
