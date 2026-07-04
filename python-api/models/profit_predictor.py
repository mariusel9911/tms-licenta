"""
profit_predictor.py — Holt's Linear Trend + simulated path for natural-looking forecasts.

Uses Holt's damped trend for the confidence band (upper/lower), but returns a
single simulated path as the 'mean' — this produces natural ups and downs based
on the historical volatility pattern, rather than a flat trend line.
"""

import math
import numpy as np
from statsmodels.tsa.holtwinters import ExponentialSmoothing


def _safe(v: float) -> float:
    """Replace nan/inf with 0.0 — Python json cannot serialize non-finite floats."""
    f = float(v)
    return 0.0 if not math.isfinite(f) else f


class ProfitPredictor:
    """Holt's method profit predictor with simulated forecast path."""

    MIN_SAMPLES = 3

    def __init__(self) -> None:
        self._model_fit = None
        self._y_values: list[float] = []
        self.is_trained: bool = False

    def train(self, y_values: list[float]) -> None:
        """Fit Holt's linear trend on historical profit values (one per period)."""
        if len(y_values) < self.MIN_SAMPLES:
            self.is_trained = False
            return

        self._y_values = y_values
        y = np.array(y_values, dtype=float)

        try:
            model = ExponentialSmoothing(
                y,
                trend='add',
                damped_trend=True,
                seasonal=None,
            )
            self._model_fit = model.fit(optimized=True)
            self.is_trained = True
        except Exception:
            self.is_trained = False

    def predict(
        self, n_periods: int, start_index: int = 0
    ) -> dict[str, list[float]]:
        """
        Predict profit for `n_periods` future periods.

        Returns a dict with:
          mean   — a simulated path with natural variation (not a flat line)
          upper  — upper 95% confidence bound
          lower  — lower 95% confidence bound (clipped to 0)
        """
        zeros = [0.0] * n_periods

        if not self.is_trained or self._model_fit is None or n_periods <= 0:
            return {'mean': zeros, 'upper': zeros, 'lower': zeros}

        try:
            # Smooth forecast for the trend baseline
            forecast = self._model_fit.forecast(n_periods)

            # Simulate many paths for confidence bands
            sim = self._model_fit.simulate(
                n_periods,
                repetitions=500,
                anchor='end',
            )
            lower = np.maximum(0.0, np.percentile(sim, 2.5, axis=1))
            upper = np.percentile(sim, 97.5, axis=1)

            # Build a natural-looking path: trend + scaled historical volatility
            # Use recent volatility (period-to-period changes) to add realistic wiggles
            y = np.array(self._y_values, dtype=float)
            if len(y) >= 2:
                diffs = np.diff(y)
                volatility = np.std(diffs)
                # Deterministic seed based on data length for reproducibility
                rng = np.random.default_rng(seed=len(y))
                # AR(1)-like correlated noise: each step partly follows the previous
                noise = np.zeros(n_periods)
                noise[0] = rng.normal(0, volatility * 0.4)
                for i in range(1, n_periods):
                    noise[i] = 0.6 * noise[i - 1] + rng.normal(0, volatility * 0.3)
                path = forecast + noise
            else:
                path = forecast

            path = np.maximum(0.0, path)

            # Clamp path within confidence band
            path = np.clip(path, lower, upper)

            return {
                'mean':  [_safe(v) for v in path],
                'upper': [_safe(v) for v in upper],
                'lower': [_safe(v) for v in lower],
            }
        except Exception:
            return {'mean': zeros, 'upper': zeros, 'lower': zeros}
