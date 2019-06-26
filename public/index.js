/* Chart.js config */

/* shorten and skip some date ticks */
function skipTicks(val, ind, values) {
  let fields = val.split(' ');
  if (ind % 2 === 0)
    if (ind === 0 || fields[0] !== values[ind - 2].split(' ')[0]) {
      return fields[0];
    }
  return '';
}

function appendDegree(val, ind, values) {
  return val + '°';
}

/*  additional weather description on tooltip hover */
function appendDescription(tooltip, data) {
  return data.datasets[1].data[tooltip[0].index].toUpperCase();
}

const config = {
  legend: { display: false },
  scales: {
    xAxes: [
      {
        gridLines: { display: false },
        ticks: { callback: skipTicks }
      }
    ],
    yAxes: [{ ticks: { callback: appendDegree } }]
  },
  tooltips: {
    intersect: false,
    callbacks: { afterTitle: appendDescription },
    bodyFontSize: 16,
    titleFontSize: 16
  }
};

document.addEventListener('DOMContentLoaded', event => {
  document.body.classList.add('fade-out');

  /* Chart.js setup */
  Chart.defaults.global.defaultFontFamily = 'Oswald';
  const dataset = {
    label: 'Temperature',
    borderColor: '#10849d',
    pointBackgroundColor: '#10849d',
    pointRadius: 4,
    data: []
  };
  const records = {
    label: 'Records',
    data: []
  };
  const ctx = document.getElementById('chart-forecast').getContext('2d');
  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [dataset, records]
    },
    options: config
  });

  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(pos =>
      putWeather(pos.coords, chart)
    );
  } else {
    console.log('Geolocation is not available.');
  }

  let form = document.querySelector('form');
  form.onsubmit = event => {
    event.preventDefault();
    putWeather(document.getElementById('locat').value, chart);
  };
});

function putWeather(locat, chart) {
  let query;
  if (typeof locat === 'object') query = `${locat.latitude},${locat.longitude}`;
  else query = locat;

  fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location: query })
  })
    .then(res => res.json())
    .then(weather => {
      console.log(weather);

      let hour = weather.time.hour % 12 === 0 ? '12' : weather.time.hour % 12;
      let min =
        weather.time.minute < 10
          ? '0' + weather.time.minute
          : weather.time.minute;
      let description = `As of ${weather.time.day} ${hour}:${min} ${
        weather.time.hour < 12 ? 'AM' : 'PM'
      }, the weather in ${weather.locale.location}, ${
        weather.locale.country
      } consists of ${weather.weather}.\nThe temperature is ${
        weather.current
      }°F, with a max today of ${weather.max}°F and min of ${weather.min}°F.`;

      document.getElementById('description').innerHTML = description;
      document.getElementById('icon').setAttribute('src', weather.iconUrl);

      document.getElementById('locat').value = '';
      document
        .getElementById('locat')
        .setAttribute(
          'placeholder',
          `${weather.locale.location}, ${weather.locale.country}`
        );

      let replaceDays = document.querySelectorAll('tr')[0];
      let replaceForecasts = document.querySelectorAll('tr')[1];

      let days = document.createElement('tr');
      let forecasts = document.createElement('tr');

      for (let day of weather.dailyForecasts) {
        let dayText = document.createElement('th');
        let dayForecast = document.createElement('td');
        dayForecast.classList.add('dropdown');

        let icon = document.createElement('img');
        let min = document.createElement('span');
        let max = document.createElement('span');

        dayText.innerHTML = day.day.slice(0, 3).toUpperCase();
        min.innerHTML = day.min;
        max.innerHTML = day.max + ' ';
        icon.setAttribute('src', day.iconUrl);

        let line = document.createElement('div');
        line.classList.add('triangle');

        dayForecast.append(icon, max, min, line);

        days.append(dayText);
        forecasts.append(dayForecast);
      }

      let temps = [],
        times = [],
        records = [];

      let dayOverview = document.createElement('div');
      dayOverview.classList.add('dropdown-content');

      let dropdowns = forecasts.childNodes;
      let count = 0;

      weather.hourForecasts.forEach((elem, i, arr) => {
        let dayAbbrev = elem.time.day.slice(0, 3).toUpperCase();
        let hr12 = `${elem.time.hour % 12 === 0 ? '12' : elem.time.hour % 12}${
          elem.time.hour < 12 ? 'AM' : 'PM'
        }`;

        let img = document.createElement('img');
        img.setAttribute('src', elem.iconUrl);
        let info = document.createElement('p');
        info.innerHTML = `${hr12} ${elem.temp.toFixed(0)}°`;

        if (count < dropdowns.length) {
          let percent = scaleRange(
            elem.temp,
            weather.dailyForecasts[count].min - 10,
            weather.dailyForecasts[count].max,
            0,
            100
          ).toFixed(0);
          let tempBar = document.createElement('span');
          tempBar.style.width = `${percent}px`;

          dayOverview.append(tempBar, info, img);

          if (i === arr.length - 1 || elem.time.day !== arr[i + 1].time.day) {
            dropdowns[count++].append(dayOverview);
            dayOverview = document.createElement('div');
            dayOverview.classList.add('dropdown-content');
          }
        }

        times.push(`${dayAbbrev} ${hr12}`);
        temps.push(elem.temp);
        records.push(elem.weather);
      });

      document.body.classList.add('fade-out');

      /* update 5-day forecast */
      replaceDays.parentNode.replaceChild(days, replaceDays);
      replaceForecasts.parentNode.replaceChild(forecasts, replaceForecasts);

      /* update chart */
      chart.data.labels = times;
      chart.data.datasets[0].data = temps;
      chart.data.datasets[1].data = records;
      chart.update();

      document.body.classList.remove('fade-out');
    })
    .catch(err => {
      console.error('Invalid location:', err);
      let input = document.getElementById('locat');
      input.value = '';
      input.setAttribute('placeholder', 'Invalid location! Enter a city.');
    });
}

/* Arduino Map function */
function scaleRange(x, in_min, in_max, out_min, out_max) {
  return ((x - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;
}
