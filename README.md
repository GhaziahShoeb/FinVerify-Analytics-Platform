# FinVerify Analytics Platform
### Financial Data Intelligence & Risk Scoring System
> Portfolio project built for Digitap.ai Data Analytics Internship

---

## What This Project Does

FinVerify is an end-to-end financial analytics pipeline that mirrors the kind of work Digitap.ai does — processing financial datasets, detecting anomalies, scoring credit risk, and surfacing insights through SQL and visual dashboards.

---

## Tech Stack

| Tool        | Usage |
|-------------|-------|
| **Python**  | Pipeline orchestration, data generation |
| **Pandas**  | Data cleaning, feature engineering, aggregations |
| **NumPy**   | Z-score anomaly detection, IQR bounds, normalisation |
| **SQLite/SQL** | Analytical reporting, joins, aggregations |
| **React + Recharts** | Interactive analytics dashboard |

---

## Project Structure

```
finverify/
├── analytics_engine.py     ← Core Python pipeline (run this)
├── finverify_output.json   ← Generated output (auto-created)
├── FinVerify_Dashboard.jsx ← Interactive React dashboard
└── README.md
```

---

## How to Run

```bash
# Install dependencies
pip install pandas numpy

# Run the full pipeline
python analytics_engine.py
```

### Expected output:
```
=======================================================
  FinVerify Analytics Engine  |  Digitap.ai Project
=======================================================

[1/6] Generating synthetic financial dataset...
      ✓ 500 users | 5,000 transactions loaded
[2/6] Engineering features (Pandas + NumPy)...
      ✓ Z-score, IQR bounds, risk signal flags computed
[3/6] Running credit risk scoring model...
      ✓ Mean score: 684.2 | Min: 312 | Max: 891
[4/6] Anomaly detection pipeline...
      ✓ 372 anomalies flagged (7.44% of transactions)
[5/6] KYC analytics...
      ✓ Verification rate: 72.0% | Failure rate: 8.0%
[6/6] Generating SQL reports...
      ✓ 5 SQL reports generated via SQLite

✅ Pipeline complete. Output saved to: finverify_output.json
```

---

## Pipeline Modules

### 1. Data Ingestion
Generates realistic synthetic data for 500 users and 5,000 transactions using log-normal amount distributions, mimicking real Indian fintech transaction patterns (UPI, NEFT, IMPS).

### 2. Feature Engineering (Pandas + NumPy)
- Amount bucketing with `pd.cut()`
- Off-hours transaction flags
- 95th percentile threshold via `np.percentile()`
- Composite risk signal scoring

### 3. Credit Risk Scoring
Weighted, rule-based model producing 300–850 scores:
- **Income Score** — log-normalised (25%)
- **Anomaly Behaviour** — penalises suspicious patterns (25%)
- **Loan Burden** — existing loans (20%)
- **Activity Score** — transaction engagement (15%)
- **Account Age** — tenure signal (15%)
- **KYC Bonus/Penalty** — verification status adjustment

### 4. Anomaly Detection (3-method ensemble)
| Method | Approach |
|--------|----------|
| Z-Score | Flag `|z| > 3` using `(x - μ) / σ` |
| IQR Fence | Flag `amount > Q3 + 1.5×IQR` |
| Risk Signals | Composite flag: off-hours + location mismatch + high amount + international |
| **Final** | **Union of all three methods** |

### 5. KYC Analytics
Tracks verification pipeline health — breakdown by status (Verified / Pending / Failed / Re-KYC), city tier, and correlation with credit scores.

### 6. SQL Reporting Layer
Five analytical reports via SQLite:
1. Risk tier distribution
2. Daily transaction volume + anomaly rate
3. Merchant category risk ranking
4. KYC vs credit score correlation
5. High-risk user watchlist (top 20)

---

## Key Results

| Metric | Value |
|--------|-------|
| Total Transactions Processed | 5,000 |
| Anomalies Flagged | 372 (7.44%) |
| KYC Verification Rate | 72% |
| Average Credit Score | 684 |
| High/Very High Risk Users | 205 (41%) |

---

## Skills Demonstrated

- `pandas` — DataFrame operations, groupby, merge, fillna, pd.cut, pd.to_datetime
- `numpy` — percentile, log1p, lognormal, clip, vectorised operations
- `sqlite3` — in-memory DB, analytical SQL, multi-table joins
- Python — modular design, docstrings, data pipeline architecture
- Data analytics — feature engineering, risk scoring, anomaly detection

---

*Built by [Your Name] · For Digitap.ai Python Data Analytics Internship*
# FinVerify-Analytics-Platform
