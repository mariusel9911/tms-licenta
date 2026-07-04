"""
data_service.py — fetch and aggregate order profit data from PostgreSQL.
"""

import pandas as pd
from sqlalchemy import create_engine, text
from config import DATABASE_URL


def _engine():
    return create_engine(DATABASE_URL)


_PERIOD_CONFIG: dict[str, tuple[str, str, str]] = {
    'day':   ('day',   'DD Mon YYYY', '30 days'),
    'week':  ('week',  'DD Mon YYYY', '14 weeks'),
    'month': ('month', 'Mon YYYY',    '18 months'),
}


def get_profit_by_period(period: str) -> pd.DataFrame:
    """
    Aggregate order profit (clientPrice - transporterPrice) grouped by time period.
    clientPrice = revenue (charged to client), transporterPrice = cost (paid to transporter).

    period: 'day' | 'week' | 'month'
    Returns DataFrame with columns: period_label (str), profit (float), order_count (int)
    """
    config = _PERIOD_CONFIG.get(period)
    if config is None:
        raise ValueError(f"Invalid period: {period}. Must be one of: {list(_PERIOD_CONFIG.keys())}")
    trunc, fmt, interval = config

    sql = f"""
        SELECT
            TO_CHAR(DATE_TRUNC('{trunc}', "documentDate"), '{fmt}') AS period_label,
            COALESCE(
                SUM("clientPrice"::numeric) - SUM(COALESCE("transporterPrice"::numeric, 0)),
                0
            )::float AS profit,
            COUNT(id)::int AS order_count
        FROM orders
        WHERE
            "documentDate" >= NOW() - INTERVAL '{interval}'
            AND "clientPrice" IS NOT NULL
        GROUP BY DATE_TRUNC('{trunc}', "documentDate")
        ORDER BY DATE_TRUNC('{trunc}', "documentDate") ASC
    """

    try:
        engine = _engine()
        with engine.connect() as conn:
            result = conn.execute(text(sql))
            rows = result.fetchall()
        engine.dispose()
    except Exception:
        return pd.DataFrame(columns=['period_label', 'profit', 'order_count'])

    if not rows:
        return pd.DataFrame(columns=['period_label', 'profit', 'order_count'])

    df = pd.DataFrame(rows, columns=['period_label', 'profit', 'order_count'])
    df['profit'] = df['profit'].astype(float)
    df['order_count'] = df['order_count'].astype(int)
    return df
