"""
prediction_service.py — orchestrates data fetch + ML prediction + label generation.
"""

from datetime import datetime, timedelta
from typing import Any

from models.profit_predictor import ProfitPredictor
from services.data_service import get_profit_by_period


_FORECAST_COUNTS: dict[str, int] = {
    'day': 7,
    'week': 4,
    'month': 3,
}


def predict(timeframe: str) -> dict[str, Any]:
    """
    Return profit prediction data for the given timeframe.

    Returns:
        {
            timeframe: str,
            labels: list[str],      — historical labels + future labels
            historical: list[float], — actual profit per historical period
            predicted: list[float],  — ML forecast for future periods
        }
    """
    df = get_profit_by_period(timeframe)

    if df.empty:
        return {
            'timeframe': timeframe,
            'labels': [],
            'historical': [],
            'predicted': [],
            'upper_bound': [],
            'lower_bound': [],
        }

    historical_labels: list[str] = df['period_label'].tolist()
    historical_values: list[float] = df['profit'].tolist()

    forecast_count = _FORECAST_COUNTS.get(timeframe, 3)

    predictor = ProfitPredictor()
    predictor.train(historical_values)
    pred = predictor.predict(forecast_count, len(historical_values))

    future_labels = _generate_future_labels(historical_labels, timeframe, forecast_count)

    return {
        'timeframe': timeframe,
        'labels': historical_labels + future_labels,
        'historical': historical_values,
        'predicted': pred['mean'],
        'upper_bound': pred['upper'],
        'lower_bound': pred['lower'],
    }


# ── Label generation ───────────────────────────────────────────────────────────

def _generate_future_labels(
    existing_labels: list[str],
    timeframe: str,
    count: int,
) -> list[str]:
    """Extend the label sequence `count` steps into the future."""
    if not existing_labels or count <= 0:
        return []

    last = existing_labels[-1]

    if timeframe == 'month':
        return _advance_month_labels(last, count)
    if timeframe == 'week':
        return _advance_week_labels(last, count)
    return _advance_day_labels(last, count)


def _advance_month_labels(last: str, count: int) -> list[str]:
    """Mon YYYY → next N months (e.g. 'Mar 2026' → 'Apr 2026')."""
    try:
        dt = datetime.strptime(last.strip(), '%b %Y')
    except ValueError:
        return [f'+{i}m' for i in range(1, count + 1)]

    labels: list[str] = []
    for i in range(1, count + 1):
        m = dt.month + i
        y = dt.year + (m - 1) // 12
        m = ((m - 1) % 12) + 1
        labels.append(datetime(y, m, 1).strftime('%b %Y'))
    return labels


def _advance_week_labels(last: str, count: int) -> list[str]:
    """DD Mon YYYY (Monday) → next N weeks."""
    try:
        dt = datetime.strptime(last.strip(), '%d %b %Y')
    except ValueError:
        return [f'+{i}w' for i in range(1, count + 1)]

    return [(dt + timedelta(weeks=i)).strftime('%d %b %Y') for i in range(1, count + 1)]


def _advance_day_labels(last: str, count: int) -> list[str]:
    """DD Mon YYYY → next N days."""
    try:
        dt = datetime.strptime(last.strip(), '%d %b %Y')
    except ValueError:
        return [f'+{i}d' for i in range(1, count + 1)]

    return [(dt + timedelta(days=i)).strftime('%d %b %Y') for i in range(1, count + 1)]
