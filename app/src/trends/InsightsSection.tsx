import { useState } from 'react'
import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { AgreementReport } from '../ml/agreement'
import type { AnomalyReport } from '../ml/anomaly'
import type { ForecastResult } from '../ml/forecast'
import type { ReadinessResult } from '../ml/readiness'
import { HudPanel } from '../ui/HudPanel'

interface Props {
  anomaly: AnomalyReport
  forecast: ForecastResult
  readiness: ReadinessResult
  agreement: AgreementReport
}

export function InsightsSection({ anomaly, forecast, readiness, agreement }: Props) {
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null)

  const activeDay =
    selectedDayIndex !== null && anomaly.days[selectedDayIndex]
      ? anomaly.days[selectedDayIndex]
      : anomaly.days[anomaly.days.length - 1] ?? null

  const forecastChartData = forecast.points.map((p) => ({
    time: `${String(p.hour).padStart(2, '0')}:00`,
    forecast: p.forecast,
    lower: p.lower,
    bandHeight: Math.max(0, p.upper - p.lower),
    upper: p.upper,
    actual: p.actual,
  }))

  return (
    <section className="tr-insights" aria-label="Wearable Insights">
      <div className="ins-header">
        <div className="ins-title-wrap">
          <h2 className="ins-title">Wearable Insights // Haylou Solar 5</h2>
          <span className="ins-badge" role="note">
            Shadow mode · Consumer wearable · Not a diagnosis
          </span>
        </div>
        <p className="ins-desc">
          On-device unsupervised and personal models running in shadow mode. These insights never alter crew
          baselines or trigger clinical alerts.
        </p>
      </div>

      <div className="ins-grid">
        {/* Card 1: Readiness Score */}
        <HudPanel className="ins-card ins-readiness" title="Daily Readiness Score">
          <div className="ins-card-inner">
            <span className="ins-card-badge">Shadow mode</span>
            <div className="ins-score-banner">
              <div className="ins-score-num">{readiness.score}</div>
              <div className="ins-score-meta">
                <span className={`ins-level-tag lvl-${readiness.level}`}>{readiness.level}</span>
                <span className="ins-version-tag">
                  {readiness.version === 2 ? 'v2 Personal Ridge Model' : 'v1 Transparent Baseline'}
                </span>
              </div>
            </div>
            <p className="ins-summary-text">{readiness.summary}</p>

            <div className="ins-factors-list">
              {readiness.factors.map((f) => (
                <div key={f.id} className="ins-factor-row">
                  <span className="ins-factor-label">{f.label}</span>
                  <span className="ins-factor-val">{f.value}</span>
                  <span className="ins-factor-sub">{f.explanation}</span>
                </div>
              ))}
            </div>
          </div>
        </HudPanel>

        {/* Card 2: Expected Heart-Rate Band */}
        <HudPanel className="ins-card ins-forecast" title="Expected Heart-Rate Band (Next 24h)">
          <div className="ins-card-inner">
            <span className="ins-card-badge">Shadow mode</span>
            {forecast.status === 'warmup' ? (
              <div className="ins-warmup-box" role="status">
                <span className="ins-warmup-icon" aria-hidden="true">⏱</span>
                <div>
                  <strong>Model Warm-Up in Progress</strong>
                  <p>
                    Learning daily circadian rhythm: {48 - forecast.warmupRemainingHours} of 48 hours recorded.
                    Expected band will display once 48 hours of hourly HR history are complete.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <p className="ins-card-desc">
                  Holt-Winters 24h diurnal model with residual spread (±1.96σ = {forecast.residualSd} bpm). Readings
                  outside the band count as unusual for this time of day.
                </p>
                <div className="ins-forecast-chart">
                  <ResponsiveContainer width="100%" height={180}>
                    <ComposedChart data={forecastChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="time" stroke="var(--t3)" fontSize={10} fontFamily="var(--mono)" />
                      <YAxis stroke="var(--t3)" fontSize={10} fontFamily="var(--mono)" domain={['dataMin - 5', 'dataMax + 5']} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(5, 14, 22, 0.94)',
                          borderColor: 'var(--edge-hi)',
                          fontFamily: 'var(--mono)',
                          fontSize: '11px',
                        }}
                      />
                      {/* Stacked lower transparent + band height shaded */}
                      <Area type="monotone" dataKey="lower" stackId="1" stroke="none" fill="transparent" />
                      <Area type="monotone" dataKey="bandHeight" stackId="1" stroke="none" fill="rgba(70, 225, 245, 0.2)" />
                      <Line type="monotone" dataKey="forecast" stroke="var(--cy)" strokeWidth={2} dot={false} name="Expected HR" />
                      <Line type="monotone" dataKey="actual" stroke="var(--act)" strokeWidth={2} dot={{ r: 3 }} name="Actual HR" connectNulls={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        </HudPanel>

        {/* Card 3: Daily Anomaly Strip */}
        <HudPanel className="ins-card ins-anomaly" title="Daily Anomaly Strip">
          <div className="ins-card-inner">
            <span className="ins-card-badge">Shadow mode</span>
            {anomaly.status === 'warmup' ? (
              <div className="ins-warmup-box" role="status">
                <span className="ins-warmup-icon" aria-hidden="true">⏱</span>
                <div>
                  <strong>Model Warm-Up in Progress</strong>
                  <p>
                    Establishing personal baseline: {anomaly.totalGoodDays} of 14 good-quality days recorded.
                    Anomaly strip will unlock once warm-up is complete.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <p className="ins-card-desc">
                  Multi-feature Isolation Forest and robust Z-scores (median/MAD) evaluated daily.
                </p>
                <div className="ins-strip-wrap" role="group" aria-label="Daily anomaly history">
                  {anomaly.days.map((d, idx) => {
                    const isSelected = activeDay?.date === d.date
                    return (
                      <button
                        key={d.date}
                        type="button"
                        className={`ins-strip-pill ${d.isAnomaly ? 'flagged' : 'nominal'} ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSelectedDayIndex(idx)}
                        aria-pressed={isSelected}
                        aria-label={`${d.date}: ${d.isAnomaly ? 'Unusual day' : 'Nominal'}`}
                      >
                        <span className="ins-pill-date">{d.date.slice(5)}</span>
                        <span className="ins-pill-dot" aria-hidden="true" />
                        <span className="ins-pill-status">{d.isAnomaly ? 'UNUSUAL' : 'NOMINAL'}</span>
                      </button>
                    )
                  })}
                </div>

                {activeDay && (
                  <div className="ins-anomaly-detail">
                    <strong>
                      {activeDay.date} // {activeDay.isAnomaly ? 'Unusual Day Flagged' : 'Nominal Day'}
                    </strong>
                    {activeDay.contributingFactors.length > 0 ? (
                      <ul className="ins-factors-ul">
                        {activeDay.contributingFactors.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="ins-nominal-note">All biometric channels conformed to personal normal range.</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </HudPanel>

        {/* Card 4: Webcam Face Scan Agreement */}
        <HudPanel className="ins-card ins-agreement" title="Webcam Scan vs Watch Agreement">
          <div className="ins-card-inner">
            <span className="ins-card-badge">Shadow mode</span>
            {agreement.status === 'insufficient_data' ? (
              <div className="ins-warmup-box" role="status">
                <span className="ins-warmup-icon" aria-hidden="true">ℹ</span>
                <div>
                  <strong>Awaiting Paired Scans</strong>
                  <p>
                    Need at least 3 paired face scans and watch readings within ±60s to calculate Bland-Altman
                    agreement ({agreement.pairCount} recorded so far).
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="ins-agreement-kpis">
                  <div className="ins-kpi-block">
                    <span className="ins-kpi-label">Mean Bias</span>
                    <span className="ins-kpi-val">
                      {agreement.bias !== null && agreement.bias > 0 ? `+${agreement.bias}` : agreement.bias} bpm
                    </span>
                  </div>
                  <div className="ins-kpi-block">
                    <span className="ins-kpi-label">95% Limits (LoA)</span>
                    <span className="ins-kpi-val">
                      [{agreement.lowerLoa}, {agreement.upperLoa}]
                    </span>
                  </div>
                  <div className="ins-kpi-block">
                    <span className="ins-kpi-label">MAE</span>
                    <span className="ins-kpi-val">{agreement.mae} bpm</span>
                  </div>
                  <div className="ins-kpi-block">
                    <span className="ins-kpi-label">Pairs</span>
                    <span className="ins-kpi-val">{agreement.pairCount}</span>
                  </div>
                </div>
                <p className="ins-agreement-note">{agreement.interpretation}</p>
              </>
            )}
          </div>
        </HudPanel>
      </div>
    </section>
  )
}
