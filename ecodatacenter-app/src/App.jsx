
import { useState, useEffect } from 'react'
import './App.css'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

// Backend URL
const API_BASE_URL = (
  import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
).replace(/\/+$/, '')

// Demo input containing the 13 final model features
// These are sample values, not live sensor readings.
const SAMPLE_INPUT = {
  power_1: 1381.173333,
  power_2: 651.878333,
  power_3: 395.12,
  hour: 13,
  minute: 38,
  regime: 1,
  temp_lag_1m: 22.798357,
  temp_lag_5m: 22.688240,
  temp_lag_15m: 23.246738,
  temp_lag_60m: 24.331759,
  power_1_lag_1m: 1371.668333,
  power_1_lag_5m: 1390.556667,
  temp_rolling_mean_15m: 23.272660,
}

// Reusable temperature evaluation chart
function TemperatureChart({
  temperatureData,
  chartLoading,
  chartError,
  title,
}) {
  return (
    <section className="content-card chart-card">
      <div className="chart-heading">
        <div>
          <h2>{title}</h2>
          <p className="subtitle">
            Actual vs predicted temperature on the test dataset
          </p>
        </div>

        <span className="chart-unit">°C</span>
      </div>

      {chartLoading && (
        <p>Loading evaluation data...</p>
      )}

      {chartError && (
        <p>{chartError}</p>
      )}

      {!chartLoading && !chartError && temperatureData.length === 0 && (
        <p>No evaluation data available yet.</p>
      )}

      {!chartLoading && !chartError && temperatureData.length > 0 && (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={temperatureData}>
              <CartesianGrid
                stroke="#2b3d49"
                strokeDasharray="4 4"
              />

              <XAxis
                dataKey="time"
                stroke="#91a4b0"
                tick={{ fontSize: 12 }}
              />

              <YAxis
                domain={['dataMin - 1', 'dataMax + 1']}
                stroke="#91a4b0"
                tick={{ fontSize: 12 }}
              />

              <Tooltip
                contentStyle={{
                  background: '#14232e',
                  border: '1px solid #354955',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                }}
              />

              <Legend />

              <Line
                type="monotone"
                dataKey="actual"
                name="Actual Temperature"
                stroke="#72e0b8"
                strokeWidth={2.5}
                dot={false}
              />

              <Line
                type="monotone"
                dataKey="predicted"
                name="Predicted Temperature"
                stroke="#8ba8ff"
                strokeWidth={2.5}
                strokeDasharray="5 5"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="chart-note">
        Evaluation uses the test dataset. This is not a live sensor feed.
        Results will be available when the final model and test data are provided.
      </p>
    </section>
  )
}

function App() {
  const [activePage, setActivePage] = useState('Dashboard')

  // Model information
  const [modelStatus, setModelStatus] = useState('loading')

  // Prediction state
  const [prediction, setPrediction] = useState(null)
  const [loading, setLoading] = useState(true)
  const [predictionError, setPredictionError] = useState(null)

  // Evaluation chart state
  const [temperatureData, setTemperatureData] = useState([])
  const [chartLoading, setChartLoading] = useState(true)
  const [chartError, setChartError] = useState(null)

  // Get model information
  useEffect(() => {
    const controller = new AbortController()

    const loadModelInfo = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/model-info`,
          { signal: controller.signal }
        )

        if (!response.ok) {
          throw new Error('Unable to load model information')
        }

        const data = await response.json()
        setModelStatus(data.status || 'unavailable')
      } catch (err) {
        if (err.name !== 'AbortError') {
          setModelStatus('unavailable')
        }
      }
    }

    loadModelInfo()

    return () => controller.abort()
  }, [])

  // Request a 60-minute temperature prediction
  useEffect(() => {
    const controller = new AbortController()

    const loadPrediction = async () => {
      setLoading(true)
      setPredictionError(null)

      try {
        const response = await fetch(
          `${API_BASE_URL}/predict`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(SAMPLE_INPUT),
            signal: controller.signal,
          }
        )

        const data = await response.json()

        if (!response.ok) {
          if (response.status === 503) {
            throw new Error(
              'The final 60-minute model is not available yet.'
            )
          }

          throw new Error(
            data.detail || `Prediction API error: ${response.status}`
          )
        }

        setPrediction(data)
      } catch (err) {
        if (err.name !== 'AbortError') {
          setPredictionError(err.message)
          setPrediction(null)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadPrediction()

    return () => controller.abort()
  }, [])

  // Load actual vs predicted evaluation data
  useEffect(() => {
    const controller = new AbortController()

    const loadChart = async () => {
      setChartLoading(true)
      setChartError(null)

      try {
        const response = await fetch(
          `${API_BASE_URL}/actual-vs-predicted?limit=30`,
          {
            headers: {
              Accept: 'application/json',
            },
            signal: controller.signal,
          }
        )

        const result = await response.json()

        if (!response.ok) {
          if (response.status === 503) {
            throw new Error(
              'Evaluation is pending until the final model is available.'
            )
          }

          throw new Error(
            result.detail || `Chart API error: ${response.status}`
          )
        }

        if (!Array.isArray(result.data)) {
          throw new Error('Invalid evaluation data received from backend.')
        }

        const chartPoints = result.data.map((item) => ({
          time: item.time
            ? item.time.slice(11, 16)
            : '',
          actual: item.actual_temperature,
          predicted: item.predicted_temperature,
        }))

        setTemperatureData(chartPoints)
      } catch (err) {
        if (err.name !== 'AbortError') {
          setChartError(err.message)
          setTemperatureData([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setChartLoading(false)
        }
      }
    }

    loadChart()

    return () => controller.abort()
  }, [])

  const modelIsLoaded = modelStatus === 'loaded'

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>🌿 EcoDataCenter</h2>

        <nav>
          {[
            'Dashboard',
            'Temperature Forecast',
            'Energy Optimization',
            'Model Performance',
          ].map((page) => (
            <button
              key={page}
              className={
                activePage === page
                  ? 'nav-link active'
                  : 'nav-link'
              }
              onClick={() => setActivePage(page)}
            >
              {page}
            </button>
          ))}
        </nav>

        <p className="sidebar-footer">
          Smart Cooling System
        </p>
      </aside>

      <main className="main-content">

        {/* DASHBOARD */}
        {activePage === 'Dashboard' && (
          <>
            <header className="topbar">
              <div>
                <p className="eyebrow">OVERVIEW</p>
                <h1>Data Center Dashboard</h1>
                <p className="subtitle">
                  Monitor temperature and energy efficiency.
                </p>
              </div>

              <span className="demo-badge">
                ● Demo Mode
              </span>
            </header>

            <section className="stats-grid">
              <article className="stat-card">
                <p>Forecast Horizon</p>
                <h2>60 min</h2>
                <span>Temperature prediction</span>
              </article>

              <article className="stat-card">
                <p>Model MAE</p>
                <h2>Pending</h2>
                <span>Awaiting validated results</span>
              </article>

              <article className="stat-card">
                <p>Baseline MAE</p>
                <h2>Pending</h2>
                <span>Awaiting final evaluation</span>
              </article>

              <article className="stat-card">
                <p>Simulated Savings</p>
                <h2>Pending</h2>
                <span>Awaiting corrected simulation</span>
              </article>
            </section>

            <section className="content-card">
              <h2>Latest Model Prediction</h2>

              {loading && (
                <p>Connecting to prediction API...</p>
              )}

              {!loading && predictionError && (
                <p>{predictionError}</p>
              )}

              {!loading && prediction && (
                <h2>
                  {prediction.predicted_temperature} {prediction.unit}
                </h2>
              )}

              <p className="chart-note">
                Forecast horizon: 60 minutes.
                Input values are sample data, not live sensor readings.
              </p>
            </section>

            <TemperatureChart
              temperatureData={temperatureData}
              chartLoading={chartLoading}
              chartError={chartError}
              title="Actual vs Predicted Temperature"
            />

            <section className="content-card">
              <h2>About the Project</h2>

              <p>
                EcoDataCenter uses LightGBM to forecast data
                center temperature 60 minutes ahead and explore
                energy-efficient cooling strategies.
              </p>

              <div className="project-tags">
                <span>LightGBM</span>
                <span>Temperature Forecasting</span>
                <span>Energy Optimization</span>
              </div>
            </section>

            <section className="bottom-grid">
              <article className="content-card energy-card">
                <p className="eyebrow">
                  ENERGY OPTIMIZATION
                </p>

                <h2>Smart Cooling Simulation</h2>

                <p className="subtitle">
                  Comparison between conventional and smart cooling.
                </p>

                <div className="energy-comparison">
                  <div className="energy-item">
                    <span>Conventional Cooling</span>
                    <strong>Awaiting results</strong>
                    <div className="energy-bar baseline-bar"></div>
                  </div>

                  <div className="energy-item">
                    <span>Smart Cooling</span>
                    <strong>Awaiting results</strong>
                    <div className="energy-bar smart-bar"></div>
                  </div>
                </div>

                <div className="savings-box">
                  <span>Validated energy savings</span>
                  <strong>Pending</strong>
                </div>

                <p className="chart-note">
                  Simulation results are not real-world HVAC measurements.
                </p>
              </article>

              <article className="content-card performance-card">
                <p className="eyebrow">
                  MODEL PERFORMANCE
                </p>

                <h2>LightGBM Metrics</h2>

                <p className="subtitle">
                  Final evaluation is not available yet.
                </p>

                <div className="metric-row">
                  <span>60-minute MAE</span>
                  <strong>Pending</strong>
                </div>

                <div className="metric-row">
                  <span>60-minute RMSE</span>
                  <strong>Pending</strong>
                </div>

                <div className="metric-row">
                  <span>Baseline MAE</span>
                  <strong>Pending</strong>
                </div>

                <p className="performance-note">
                  Metrics will be updated after the final experiment.
                </p>
              </article>
            </section>
          </>
        )}

        {/* TEMPERATURE FORECAST */}
        {activePage === 'Temperature Forecast' && (
          <>
            <header className="topbar">
              <div>
                <p className="eyebrow">
                  MACHINE LEARNING
                </p>

                <h1>Temperature Forecast</h1>

                <p className="subtitle">
                  Predicting data center temperature 60 minutes ahead.
                </p>
              </div>

              <span className="demo-badge">
                {loading
                  ? '● Connecting...'
                  : prediction
                    ? '● Prediction Available'
                    : '● Model Pending'}
              </span>
            </header>

            <section className="stats-grid">
              <article className="stat-card">
                <p>Prediction Horizon</p>
                <h2>60 min</h2>
                <span>Forecast ahead</span>
              </article>

              <article className="stat-card">
                <p>Model</p>
                <h2>LightGBM</h2>
                <span>Machine learning</span>
              </article>

              <article className="stat-card">
                <p>Model Status</p>
                <h2>{modelIsLoaded ? 'Loaded' : 'Pending'}</h2>
                <span>Backend model status</span>
              </article>

              <article className="stat-card">
                <p>Input Features</p>
                <h2>13</h2>
                <span>Final model features</span>
              </article>
            </section>

            <section className="content-card">
              <p className="eyebrow">
                LIGHTGBM PREDICTION
              </p>

              <h2>Predicted Temperature</h2>

              {loading && (
                <p>Loading prediction from backend...</p>
              )}

              {!loading && predictionError && (
                <p>{predictionError}</p>
              )}

              {!loading && prediction && (
                <>
                  <h1
                    style={{
                      fontSize: '42px',
                      margin: '20px 0',
                    }}
                  >
                    {prediction.predicted_temperature} {prediction.unit}
                  </h1>

                  <p>
                    Forecast horizon: {prediction.horizon}
                  </p>
                </>
              )}

              <p className="chart-note">
                The current input is a sample payload containing
                13 features, not live sensor data.
              </p>
            </section>

            <TemperatureChart
              temperatureData={temperatureData}
              chartLoading={chartLoading}
              chartError={chartError}
              title="Actual vs Predicted Temperature"
            />
          </>
        )}

        {/* ENERGY OPTIMIZATION */}
        {activePage === 'Energy Optimization' && (
          <>
            <header className="topbar">
              <div>
                <p className="eyebrow">
                  ENERGY EFFICIENCY
                </p>

                <h1>Energy Optimization</h1>

                <p className="subtitle">
                  Explore the impact of smart cooling strategies.
                </p>
              </div>

              <span className="demo-badge">
                ● Simulation
              </span>
            </header>

            <section className="stats-grid">
              <article className="stat-card">
                <p>Conventional Cooling</p>
                <h2>Pending</h2>
                <span>Simulation results</span>
              </article>

              <article className="stat-card">
                <p>Smart Cooling</p>
                <h2>Pending</h2>
                <span>Simulation results</span>
              </article>

              <article className="stat-card">
                <p>Energy Saved</p>
                <h2>Pending</h2>
                <span>Awaiting validation</span>
              </article>

              <article className="stat-card">
                <p>Savings Rate</p>
                <h2>Pending</h2>
                <span>Awaiting corrected simulation</span>
              </article>
            </section>

            <section className="content-card">
              <p className="eyebrow">
                COOLING COMPARISON
              </p>

              <h2>Conventional vs Smart Cooling</h2>

              <p className="subtitle">
                Simulation results will appear after validation.
              </p>

              <div className="energy-comparison">
                <div className="energy-item">
                  <span>Conventional Cooling</span>
                  <strong>Awaiting results</strong>
                  <div className="energy-bar baseline-bar"></div>
                </div>

                <div className="energy-item">
                  <span>Smart Cooling</span>
                  <strong>Awaiting results</strong>
                  <div className="energy-bar smart-bar"></div>
                </div>
              </div>

              <div className="savings-box">
                <span>Estimated energy savings</span>
                <strong>Pending</strong>
              </div>

              <p className="chart-note">
                These results are based on simulation, not real-time
                measurements or confirmed real-world HVAC savings.
              </p>
            </section>

            <section
              className="content-card"
              style={{ marginTop: '25px' }}
            >
              <h2>How Does Smart Cooling Help?</h2>

              <p>
                The simulation compares a conventional cooling
                strategy with a smarter strategy designed to reduce
                energy consumption. Temperature forecasting can help
                explore more efficient cooling decisions.
              </p>

              <div className="project-tags">
                <span>Energy Efficiency</span>
                <span>Smart Cooling</span>
                <span>Temperature Forecasting</span>
              </div>
            </section>
          </>
        )}

        {/* MODEL PERFORMANCE */}
        {activePage === 'Model Performance' && (
          <>
            <header className="topbar">
              <div>
                <p className="eyebrow">
                  MODEL EVALUATION
                </p>

                <h1>Model Performance</h1>

                <p className="subtitle">
                  Evaluate the accuracy of our temperature forecasting model.
                </p>
              </div>

              <span className="demo-badge">
                ● LightGBM
              </span>
            </header>

            <section className="stats-grid">
              <article className="stat-card">
                <p>Prediction Horizon</p>
                <h2>60 min</h2>
                <span>Final model target</span>
              </article>

              <article className="stat-card">
                <p>Model MAE</p>
                <h2>Pending</h2>
                <span>Awaiting final evaluation</span>
              </article>

              <article className="stat-card">
                <p>Model RMSE</p>
                <h2>Pending</h2>
                <span>Awaiting final evaluation</span>
              </article>

              <article className="stat-card">
                <p>Baseline MAE</p>
                <h2>Pending</h2>
                <span>Awaiting final evaluation</span>
              </article>
            </section>

            <section className="content-card">
              <p className="eyebrow">
                ERROR COMPARISON
              </p>

              <h2>LightGBM vs Baseline</h2>

              <p className="subtitle">
                Final model comparison will be displayed here.
              </p>

              <div className="metric-row">
                <span>LightGBM 60-minute MAE</span>
                <strong>Pending</strong>
              </div>

              <div className="metric-row">
                <span>LightGBM 60-minute RMSE</span>
                <strong>Pending</strong>
              </div>

              <div className="metric-row">
                <span>Persistence Baseline MAE</span>
                <strong>Pending</strong>
              </div>

              <p className="chart-note">
                Results will be updated after the temporal leakage
                correction and final model evaluation.
              </p>
            </section>

            <section
              className="content-card"
              style={{ marginTop: '25px' }}
            >
              <h2>Understanding the Metrics</h2>

              <div className="metric-row">
                <span>MAE (Mean Absolute Error)</span>
                <strong>Average absolute prediction error</strong>
              </div>

              <div className="metric-row">
                <span>RMSE (Root Mean Squared Error)</span>
                <strong>Penalizes larger errors more</strong>
              </div>

              <div className="metric-row">
                <span>Baseline</span>
                <strong>Reference for comparison</strong>
              </div>

              <p className="chart-note">
                Evaluation results are not available until the final
                model and test dataset are provided.
              </p>
            </section>
          </>
        )}

        {/* FOOTER */}
        <footer>
          EcoDataCenter · Machine Learning Demo
        </footer>
      </main>
    </div>
  )
}

export default App
