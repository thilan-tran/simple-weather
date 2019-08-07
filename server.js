const axios = require('axios');
const express = require('express');
const setTZ = require('set-tz');
const dotenv = require('dotenv');

const app = express();
setTZ('UTC');
dotenv.config();

// OpenWeatherMap
const apiKey = process.env.API_KEY;
const units = 'imperial';
const weatherUrl = `http://api.openweathermap.org/data/2.5/weather?units=${units}&APPID=${apiKey}`;
const forecastUrl = `http://api.openweathermap.org/data/2.5/forecast?units=${units}&APPID=${apiKey}`;

app.use(express.static('public'));
app.use(express.json());

app.listen(process.env.PORT, () => console.log(`Listening on port ${process.env.PORT}.`));

app.post('/', (req, res, next) => {
  console.log(`POST request received for ${req.body.location}.`);
  getWeather(req.body.location).then(weather => {
    console.log('Weather retrieved.');
    res.send(weather);
  }).catch(err => {
    next(err);
  });
});

// TODO:
// - better daily weather snapshot

function getWeather(locat) {
  let query,
    coords = locat.split(',');
  if (isNaN(coords[0]) || coords.length != 2) {
    query = `q=${locat}`;
  } else {
    query = `lat=${coords[0]}&lon=${coords[1]}`;
  }

  return Promise.all([
    axios.get(`${weatherUrl}&${query}&units=${units}`),
    axios.get(`${forecastUrl}&${query}&units=${units}`)
  ])
    .then(allData => {
      // API weather data
      const weatherCurrent = allData[0].data,
        weatherForecast = allData[1].data.list;

      const TZoffset = weatherCurrent.timezone, // timezone offset from UTC
        UTCsunrise = weatherCurrent.sys.sunrise * 1000,
        UTCsunset = weatherCurrent.sys.sunset * 1000;

      let hourForecasts = [], // API gives 3-hour weather forecasts
        dailyForecasts = [],
        dailyTemps = [];

      let snapshotWeather = weatherForecast[0].weather[0].description,
        snapshotTime = weatherForecast[0].dt_txt;

      for (let prediction of weatherForecast) {
        let p_main = prediction.weather[0].main,
          p_weather = prediction.weather[0].description,
          p_temp = prediction.main.temp,
          p_UTCtime = prediction.dt * 1000, // seconds -> milliseconds
          p_day = shiftTimezone(prediction.dt_txt, TZoffset).day,
          p_hour = shiftTimezone(prediction.dt_txt, TZoffset).hour;

        // console.log(`Logging ${p_hour}, ${p_day}.`);
        hourForecasts.push({
          main: p_main,
          weather: p_weather,
          temp: p_temp,
          time: {
            UTCtime: p_UTCtime,
            day: p_day,
            hour: p_hour
          },
          iconUrl: getIconUrl(
            p_weather,
            p_UTCtime,
            TZoffset,
            UTCsunrise,
            UTCsunset
          )
        });
        dailyTemps.push(p_temp);

        // snapshot around noon to use as overal daily weather
        if (p_hour === 11 || p_hour === 12 || p_hour === 13) {
          snapshotWeather = p_weather;
          snapshotTime = p_UTCtime;
        }

        // calculate min, max at end of day
        if (p_hour === 21 || p_hour === 22 || p_hour === 23) {
          console.log(`End of ${p_day}.`);

          let dayMin, dayMax;

          if (p_day === shiftTimezone(weatherCurrent.dt * 1000, TZoffset)) {
            dayMin = Math.round(weatherCurrent.main.temp_min);
            dayMax = Math.round(weatherCurrent.main.temp_max);
          } else {
            dayMin = Math.round(Math.min(...dailyTemps));
            dayMax = Math.round(Math.max(...dailyTemps));
          }

          while (dailyTemps.length > 0) dailyTemps.pop();
          dailyForecasts.push({
            day: p_day,
            weather: snapshotWeather,
            min: dayMin,
            max: dayMax,
            iconUrl: getIconUrl(
              snapshotWeather,
              snapshotTime,
              TZoffset,
              UTCsunrise,
              UTCsunset
            )
          });
        }
      }

      return new Promise((res, rej) => {
        let { day, hour, minute } = shiftTimezone(
          weatherCurrent.dt * 1000,
          TZoffset
        );
        const weather = {
          main: weatherCurrent.weather[0].main,
          weather: weatherCurrent.weather[0].description,
          current: weatherCurrent.main.temp,
          min: weatherCurrent.main.temp_min,
          max: weatherCurrent.main.temp_max,
          time: {
            UTCtime: weatherCurrent.dt * 1000,
            day: day,
            hour: hour,
            minute: minute,
            sunrise: shiftTimezone(UTCsunrise, TZoffset).hour,
            sunset: shiftTimezone(UTCsunset, TZoffset).hour
          },
          locale: {
            location: weatherCurrent.name,
            country: weatherCurrent.sys.country
          },
          hourForecasts: hourForecasts,
          dailyForecasts: dailyForecasts,
          iconUrl: getIconUrl(
            weatherCurrent.weather[0].description,
            weatherCurrent.dt * 1000,
            TZoffset,
            UTCsunrise,
            UTCsunset
          )
        };
        res(weather);
      });
    })
    .catch(err => new Promise((res, rej) => {
        rej(err.response.status + ': ' + err.response.statusText)
    }));
}

function shiftTimezone(time, offset) {
  const days = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday'
  ];
  let date = new Date(time);
  let dayShift = date.getDay();
  let hourShift = Math.round(date.getHours() + offset / 3600); // offset in seconds

  if (hourShift < 0) {
    dayShift--;
    hourShift += 24;
  } else if (hourShift >= 24) {
    dayShift++;
    hourShift -= 24;
  }
  dayShift = dayShift === -1 ? 6 : dayShift === 7 ? 0 : dayShift;

  return {
    day: days[dayShift],
    hour: hourShift,
    minute: date.getMinutes()
  };
}

function getIconUrl(condition, time, offset, sunrise, sunset) {
  const imgConditions = [
    'thunderstorm',
    'drizzle',
    'rain',
    'snow',
    'haze',
    'clear',
    'clouds'
  ];
  let { day, hour, minute } = shiftTimezone(time, offset);
  let { hour: riseHr, minute: riseMin } = shiftTimezone(sunrise, offset);
  let { hour: setHr, minute: setMin } = shiftTimezone(sunset, offset);

  for (let cond of imgConditions) {
    if (condition.indexOf(cond) !== -1) {
      if (
        hour * 60 + minute >= riseHr * 60 + riseMin &&
        hour * 60 + minute <= setHr * 60 + setMin
      ) {
        return `/img/${cond}_day.png`;
      } else {
        return `/img/${cond}_night.png`;
      }
    }
  }
  return '/img/default.png';
}
