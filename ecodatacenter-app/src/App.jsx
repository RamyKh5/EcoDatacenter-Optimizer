
import { useEffect, useState } from 'react'
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

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const initialFeatures = {
  power_1: 0,
  power_2: 0,
  power_3: 0,
  hour: 23,
  minute: 59,
  temp_lag_1m: 0,
  temp_lag_5m: 0,
  temp_lag_15m: 0,
  temp_lag_60m: 0,
  power_1_lag_1m: 0,
  power_1_lag_5m: 0,
  temp_rolling_mean_15m: 0,
}

async function getJSON(url) {
  const response = await fetch(`${API}${url}`)

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }

  return response.json()
}

function TemperatureChart({ data, loading, error, title }) {
  return (
    <section className="panel chart-card">
      <div className="chart-heading">
        <div>
          <h2>{title}</h2>
          <p className="panel-description">
            Actual temperature compared with model predictions
          </p>
        </div>
        <span className="chart-unit">°C</span>
      </div>

      {loading && <p className="chart-message">Loading chart data...</p>}
      {error && <p className="error-message">{error}</p>}

      {!loading && !error && data.length > 0 && (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid stroke="#26364c" strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tick={{ fill: '#8593aa', fontSize: 10 }}
                tickFormatter={(value) => value.slice(11, 16)}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fill: '#8593aa', fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{
                  background: '#101a2c',
                  border: '1px solid #26364c',
                  borderRadius: '8px',
                  color: '#e8edf5',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="actual_temperature"
                name="Actual"
                stroke="#4de0bd"
                dot={false}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="predicted_temperature"
                name="Predicted"
                stroke="#e5a85b"
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {!loading && !error && data.length === 0 && (
        <p className="chart-message">No chart data available.</p>
      )}

      <p className="chart-note">
        Historical test-dataset comparison. This chart does not represent
        live sensor readings.
      </p>
    </section>
  )
}

function App() {
  const [page, setPage] = useState('Dashboard')

  const [modelInfo, setModelInfo] = useState(null)
  const [chartData, setChartData] = useState([])
  const [chartLoading, setChartLoading] = useState(true)
  const [chartError, setChartError] = useState('')
  const [backendError, setBackendError] = useState('')

  const [features, setFeatures] = useState(initialFeatures)
  const [prediction, setPrediction] = useState(null)
  const [predictionLoading, setPredictionLoading] = useState(false)
  const [predictionError, setPredictionError] = useState('')

  const [energyData, setEnergyData] = useState(null)
  const [energyError, setEnergyError] = useState('')

  useEffect(() => {
    async function loadDashboard() {
      try {
        const info = await getJSON('/model-info')
        setModelInfo(info)
        setBackendError('')
      } catch (error) {
        setBackendError(error.message)
      }

      try {
        setChartLoading(true)

        const result = await getJSON('/actual-vs-predicted?limit=100')

        setChartData(Array.isArray(result.data) ? result.data : [])
        setChartError('')
      } catch (error) {
        setChartError(error.message)
      } finally {
        setChartLoading(false)
      }

      try {
        const result = await getJSON('/energy-simulation')
        setEnergyData(result)
        setEnergyError('')
      } catch (error) {
        setEnergyError(error.message)
      }
    }

    loadDashboard()
  }, [])

  function handleFeatureChange(event) {
    const { name, value } = event.target

    setFeatures((previous) => ({
      ...previous,
      [name]: Number(value),
    }))
  }

  async function handlePredict(event) {
    event.preventDefault()

    setPredictionLoading(true)
    setPredictionError('')
    setPrediction(null)

    try {
      const response = await fetch(`${API}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(features),
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || `Request failed: ${response.status}`)
      }

      const result = await response.json()
      setPrediction(result)
    } catch (error) {
      setPredictionError(error.message)
    } finally {
      setPredictionLoading(false)
    }
  }

  const modelLoaded = modelInfo?.status === 'loaded'

  const metricsPending =
    modelInfo?.metrics?.status !== 'validated'

  const navItems = [
    { name: 'Dashboard', icon: '▦' },
    { name: 'Temperature Forecast', icon: '⌁' },
    { name: 'Energy Optimization', icon: '⚡' },
    { name: 'Model Performance', icon: '◫' },
  ]

  return (
    <div className="app">
      <aside className="sidebar">
        <h2 className="brand">
          Eco<span>Data</span>Center
        </h2>

        <p className="menu-title">MAIN MENU</p>

        <nav>
          {navItems.map((item) => (
            <button
              key={item.name}
              className={`nav-link ${page === item.name ? 'active' : ''}`}
              onClick={() => setPage(item.name)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.name}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <span
            className="status-dot"
            style={{ background: backendError ? '#e38b83' : '#4de0bd' }}
          />
          {backendError ? 'Backend unavailable' : 'Energy Intelligence'}
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">ECODATACENTER / ENERGY INTELLIGENCE</p>
            <h1>{page}</h1>
            <p className="subtitle">
              Data-driven data center monitoring and optimization
            </p>
          </div>

          <div className="user-avatar">EC</div>
        </header>

        {backendError && (
          <div className="notice error-notice">
            <strong>Backend connection error</strong>
            <p>{backendError}. Make sure the FastAPI server is running.</p>
          </div>
        )}

        {page === 'Dashboard' && (
          <>
            <section className="welcome-card">
              <div>
                <p className="welcome-label">WELCOME TO ECODATACENTER</p>
                <h2>Smarter Energy. Better Efficiency.</h2>
                <p>
                  Monitor room temperature forecasting and explore
                  data-driven energy optimization using machine learning.
                </p>
              </div>

              <div className="welcome-icon">⌁</div>
            </section>

            <section className="stats-grid">
              <div className="stat-card">
                <p>Forecast Horizon</p>
                <h2>60 min</h2>
                <span className="stat-note">Notebook 08 model</span>
              </div>

              <div className="stat-card">
                <p>Temperature Prediction</p>
                <h2>
                  {prediction
                    ? `${Number(prediction.predicted_temperature).toFixed(2)}°C`
                    : '--'}
                </h2>
                <span className="stat-note">Demo input prediction</span>
              </div>

              <div className="stat-card">
                <p>Model Status</p>
                <h2>{modelLoaded ? 'Loaded' : 'Pending'}</h2>
                <span className="stat-note">
                  {modelInfo?.model || 'Waiting for backend'}
                </span>
              </div>

              <div className="stat-card">
                <p>Final Evaluation MAE</p>
                <h2>
                  {metricsPending
                    ? 'Loading...'
                    : modelInfo?.metrics?.mae != null
                      ? `${Number(modelInfo.metrics.mae).toFixed(4)} °C`
                      : '--'}
                </h2>
                <span className="stat-note">Notebook 08 evaluation</span>
              </div>
            </section>

            <div className="bottom-grid">
              <TemperatureChart
                data={chartData}
                loading={chartLoading}
                error={chartError}
                title="Actual vs Predicted Temperature"
              />

              <section className="panel system-panel">
                <h3>System Overview</h3>
                <p>Current backend and model information</p>

                <div className="system-row">
                  <span>Backend API</span>
                  <strong>{backendError ? 'Unavailable' : 'Connected'}</strong>
                </div>

                <div className="system-row">
                  <span>Model</span>
                  <strong>{modelInfo?.model || 'Loading...'}</strong>
                </div>

                <div className="system-row">
                  <span>Forecast target</span>
                  <strong>60-minute average</strong>
                </div>

                <div className="system-row">
                  <span>Sensor connection</span>
                  <strong>Demo / user input</strong>
                </div>
              </section>
            </div>
          </>
        )}

        {page === 'Temperature Forecast' && (
          <>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>60-Minute Temperature Forecast</h2>
                  <p>
                    Enter the 12 input features required by the trained model.
                  </p>
                </div>

                <span className="chart-unit">LightGBM</span>
              </div>

              <div className="notice">
                <strong>Demo input</strong>
                <p>
                  These values are user-provided example features, not live
                  sensor data.
                </p>
              </div>

              <form className="feature-form" onSubmit={handlePredict}>
                {Object.entries(features).map(([name, value]) => (
                  <label className="feature-field" key={name}>
                    <span>{name.replaceAll('_', ' ')}</span>
                    <input
                      type="number"
                      step="any"
                      name={name}
                      value={value}
                      onChange={handleFeatureChange}
                      required
                    />
                  </label>
                ))}

                <button
                  className="predict-button"
                  type="submit"
                  disabled={predictionLoading}
                >
                  {predictionLoading ? 'Predicting...' : 'Predict Temperature'}
                </button>
              </form>

              {predictionError && (
                <div className="notice error-notice">
                  <strong>Prediction error</strong>
                  <p>{predictionError}</p>
                </div>
              )}

              {prediction && (
                <div className="prediction-result">
                  <p>Predicted Average Room Temperature</p>
                  <h2>
                    {Number(prediction.predicted_temperature).toFixed(2)}
                    {prediction.unit || '°C'}
                  </h2>
                  <span>
                    Forecast horizon: {prediction.horizon || '60 minutes'}
                  </span>
                  <p className="chart-note">
                    Demo or user-provided features. Not live sensor data.
                  </p>
                </div>
              )}
            </section>

            <TemperatureChart
              data={chartData}
              loading={chartLoading}
              error={chartError}
              title="Model Evaluation: Actual vs Predicted"
            />
          </>
        )}

        {page === 'Energy Optimization' && (
          <>
            <section className="panel energy-card">
              <p className="eyebrow">ENERGY INTELLIGENCE</p>
              <h2>Energy Optimization Simulation</h2>
              <p className="panel-description">
                Retrospective simulation based on the 60-minute forecasting model.
              </p>

              <div className="notice">
                <strong>Illustrative simulation — not real HVAC measurements</strong>
                <p>
                  These results are simulated estimates from Notebook 07.
                  They are not validated real-world energy savings.
                </p>
              </div>

              {energyError && (
                <p className="error-message">{energyError}</p>
              )}

              {!energyData && !energyError && (
                <p className="chart-message">Loading simulation results...</p>
              )}

              {energyData && (
                <>
                  <div className="stats-grid energy-stats">
                    <div className="stat-card">
                      <p>Linear Simulated Savings</p>
                      <h2>
                        {energyData.linear_simulation.simulated_savings_percent}%
                      </h2>
                      <span className="stat-note">Illustrative result</span>
                    </div>

                    <div className="stat-card">
                      <p>Quadratic Simulated Savings</p>
                      <h2>
                        {energyData.quadratic_simulation.simulated_savings_percent}%
                      </h2>
                      <span className="stat-note">Illustrative result</span>
                    </div>

                    <div className="stat-card">
                      <p>Evaluation Samples</p>
                      <h2>{Number(energyData.evaluation_count).toLocaleString('en-US')}</h2>
                      <span className="stat-note">Retrospective evaluation</span>
                    </div>

                    <div className="stat-card">
                      <p>Forecast Horizon</p>
                      <h2>{energyData.horizon}</h2>
                      <span className="stat-note">Notebook 08 model</span>
                    </div>
                  </div>

                  <section className="panel">
                    <h3>Linear Simulation</h3>

                    <div className="metric-row">
                      <span>Baseline total</span>
                      <strong>
                        {energyData.linear_simulation.baseline_total.toLocaleString()}
                      </strong>
                    </div>

                    <div className="metric-row">
                      <span>Smart total</span>
                      <strong>
                        {energyData.linear_simulation.smart_total.toLocaleString()}
                      </strong>
                    </div>

                    <div className="metric-row">
                      <span>Simulated savings</span>
                      <strong>
                        {energyData.linear_simulation.simulated_savings_percent}%
                      </strong>
                    </div>
                  </section>

                  <section className="panel">
                    <h3>Quadratic Simulation</h3>

                    <div className="metric-row">
                      <span>Baseline total</span>
                      <strong>
                        {energyData.quadratic_simulation.baseline_total.toLocaleString()}
                      </strong>
                    </div>

                    <div className="metric-row">
                      <span>Smart total</span>
                      <strong>
                        {energyData.quadratic_simulation.smart_total.toLocaleString()}
                      </strong>
                    </div>

                    <div className="metric-row">
                      <span>Simulated savings</span>
                      <strong>
                        {energyData.quadratic_simulation.simulated_savings_percent}%
                      </strong>
                    </div>
                  </section>

                  <section className="panel">
                    <h3>Controller Behavior</h3>

                    <div className="metric-row">
                      <span>Relaxed target</span>
                      <strong>
                        {energyData.controller_behavior.relaxed_target}°C
                      </strong>
                    </div>

                    <div className="metric-row">
                      <span>Strict target</span>
                      <strong>
                        {energyData.controller_behavior.strict_target}°C
                      </strong>
                    </div>

                    <div className="metric-row">
                      <span>Relaxed operation</span>
                      <strong>
                        {energyData.controller_behavior.relaxed_percentage}%
                      </strong>
                    </div>

                    <div className="metric-row">
                      <span>Strict operation</span>
                      <strong>
                        {energyData.controller_behavior.strict_percentage}%
                      </strong>
                    </div>
                  </section>

                  <section className="panel">
                    <h3>Energy Components</h3>

                    <div className="metric-row">
                      <span>Fan share</span>
                      <strong>
                        {energyData.energy_components.baseline_fan_share_percent}%
                      </strong>
                    </div>

                    <div className="metric-row">
                      <span>Compressor share</span>
                      <strong>
                        {energyData.energy_components.baseline_compressor_share_percent}%
                      </strong>
                    </div>

                    <div className="metric-row">
                      <span>Compressor reduction</span>
                      <strong>
                        {energyData.energy_components.compressor_reduction_percent}%
                      </strong>
                    </div>
                  </section>

                  <p className="performance-note">
                    Source: {energyData.source}. Simulation type:{' '}
                    {energyData.simulation_type}. Unit: {energyData.unit}.
                    Savings status: {energyData.savings_status}.
                    These results are illustrative and not validated real HVAC savings.
                  </p>
                </>
              )}
            </section>
          </>
        )}

        {page === 'Model Performance' && (
          <>
            <section className="panel performance-card">
              <h2>Model Performance</h2>
              <p className="panel-description">
                Information returned by the backend model-info endpoint.
              </p>

              <div className="metric-row">
                <span>Dataset</span>
                <strong>{modelInfo?.dataset || '--'}</strong>
              </div>

              <div className="metric-row">
                <span>Prediction target</span>
                <strong>{modelInfo?.target || '--'}</strong>
              </div>

              <div className="metric-row">
                <span>Forecast horizon</span>
                <strong>{modelInfo?.horizon || '--'}</strong>
              </div>

              <div className="metric-row">
                <span>Number of features</span>
                <strong>{modelInfo?.features_count ?? '--'}</strong>
              </div>

              <div className="metric-row">
                <span>Model status</span>
                <strong>{modelInfo?.status || 'Loading...'}</strong>
              </div>

              <div className="metric-row">
                <span>Final Evaluation MAE</span>
                <strong>
                  {metricsPending
                    ? 'Loading...'
                    : modelInfo?.metrics?.mae != null
                      ? `${Number(modelInfo.metrics.mae).toFixed(4)} °C`
                      : '--'}
                </strong>
              </div>

              <div className="metric-row">
                <span>Evaluation samples</span>
                <strong>
                  {modelInfo?.metrics?.evaluation_samples != null
                    ? Number(
                        modelInfo.metrics.evaluation_samples
                      ).toLocaleString()
                    : '--'}
                </strong>
              </div>

              <div className="notice">
                <strong>Evaluation status</strong>
                <p>
                  {modelInfo?.metrics?.message ||
                    'Evaluation metrics are loading.'}
                </p>
              </div>
            </section>

            <TemperatureChart
              data={chartData}
              loading={chartLoading}
              error={chartError}
              title="Actual vs Predicted Temperature"
            />

            <section className="panel about-panel">
              <h3>Model Features</h3>
              <p>
                {modelInfo?.features?.join(' · ') ||
                  'Loading model features...'}
              </p>
            </section>
          </>
        )}

        <footer>
          EcoDataCenter <span>•</span> Energy Intelligence
        </footer>
      </main>
    </div>
  )
}

export default App
