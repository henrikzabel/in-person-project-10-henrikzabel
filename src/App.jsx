import React, { useState, useEffect, useRef } from 'react';
import WeatherCard from './components/WeatherCard';
import ForecastCard from './components/ForecastCard';
import NewsCard from './components/NewsCard';
import AlertsCard from './components/AlertsCard';
import SearchBar from './components/SearchBar';
import StatusBar from './components/StatusBar';
import { getFastestSource, cachedFetch, fetchAllParallel } from './utils/asyncPatterns';

// PROBLEM: This basic fetch has no retry, no caching, no error handling
async function basicFetch(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  return response.json();
}

function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

function App() {
  const [city, setCity] = useState('San Francisco');
  const [dashboardData, setDashboardData] = useState({
    weather: null,
    forecast: null,
    news: null,
    alerts: null
  });
  const [loading, setLoading] = useState({
    weather: false,
    forecast: false,
    news: false,
    alerts: false
  });
  const [errors, setErrors] = useState({
    weather: null,
    forecast: null,
    news: null,
    alerts: null
  });

  const fetchWeatherData = async (cityName) => {
    setLoading(prev => ({ ...prev, weather: true }));
    setErrors(prev => ({ ...prev, weather: null }));

    try {
      const data = await basicFetch(`http://localhost:3001/weather?city=${cityName}`);
      setDashboardData(prev => ({ ...prev, weather: data }));
    } catch (error) {
      setErrors(prev => ({ ...prev, weather: error.message }));
      console.error('Weather fetch failed:', error);
    } finally {
      setLoading(prev => ({ ...prev, weather: false }));
    }
  };

  // PROBLEM: All requests are sequential, not parallel
  const fetchAllData = async (cityName) => {
    setLoading({ weather: true, forecast: true, news: true, alerts: true });
    setErrors({ weather: null, forecast: null, news: null, alerts: null });

    const base = 'http://localhost:3001';
    const query = `?city=${encodeURIComponent(cityName)}`;

    const results = await fetchAllParallel([
      { name: 'weather', url: `${base}/weather${query}` },
      { name: 'forecast', url: `${base}/forecast${query}` },
      { name: 'news', url: `${base}/news${query}` },
      { name: 'alerts', url: `${base}/alerts${query}` }
    ]);

    const newData = { ...dashboardData };
    const newErrors = {};

    ['weather', 'forecast', 'news', 'alerts'].forEach(key => {
      if (results[key].error) {
        newErrors[key] = results[key].error;
      } else {
        newData[key] = results[key];
      }
    });

    setDashboardData(newData);
    setErrors(newErrors);
    setLoading({ weather: false, forecast: false, news: false, alerts: false });
  };

  const debouncedFetch = useRef(debounce(fetchAllData, 300)).current;

  useEffect(() => {
    debouncedFetch(city);
  }, [city, debouncedFetch]);

  useEffect(() => {
    const base = 'http://localhost:3001';
    const query = `?city=${encodeURIComponent('San Francisco')}`;
    getFastestSource([
      `${base}/weather-source1${query}`,
      `${base}/weather-source2${query}`,
      `${base}/weather-source3${query}`
    ])
      .then(result => console.log('Fastest source:', result.source, result))
      .catch(error => console.error('❌ All sources failed:', error));
  }, []);

  const handleRefresh = () => {
    fetchAllData(city);
  };

  const handleCityChange = (newCity) => {
    setCity(newCity);
  };

  const isAnyLoading = Object.values(loading).some(l => l);

  return (
    <div className="container">
      <header className="header">
        <h1>Weather Dashboard</h1>
        <p>Advanced Async Patterns Demo</p>
      </header>

      <StatusBar
        loading={loading}
        errors={errors}
        lastUpdate={dashboardData.weather?.timestamp}
      />

      <div className="search-section">
        <SearchBar onCityChange={handleCityChange} />
        <button
          className="btn"
          onClick={handleRefresh}
          disabled={isAnyLoading}
        >
          {isAnyLoading ? 'Refreshing...' : 'Refresh All'}
        </button>
      </div>

      <div className="dashboard-grid">
        <WeatherCard
          data={dashboardData.weather}
          loading={loading.weather}
          error={errors.weather}
        />
        <ForecastCard
          data={dashboardData.forecast}
          loading={loading.forecast}
          error={errors.forecast}
        />
        <NewsCard
          data={dashboardData.news}
          loading={loading.news}
          error={errors.news}
        />
        <AlertsCard
          data={dashboardData.alerts}
          loading={loading.alerts}
          error={errors.alerts}
        />
      </div>

      {/* TODO: Add these features */}
      <div className="card" style={{ marginTop: '20px' }}>
        <h2>Problems to Fix:</h2>
        <ul style={{ paddingLeft: '20px', color: '#666' }}>
          <li>❌ No retry when requests fail (30% failure rate!)</li>
          <li>❌ No caching (duplicate requests waste bandwidth)</li>
          <li>❌ Sequential loading (should load in parallel)</li>
          <li>❌ Race conditions in search (type fast and see wrong results)</li>
          <li>❌ No request timeouts (can hang forever)</li>
          <li>❌ No polling for updates</li>
        </ul>
      </div>
    </div>
  );
}

export default App;
