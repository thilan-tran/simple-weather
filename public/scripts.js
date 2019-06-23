const weatherRecords = []; // global to access from chart callback
const config = {
  legend: { display: false },
  scales: {
    xAxes: [
      {
        gridLines: { display: false },
        ticks: {
          callback: (val, ind, values) => {
            // shorten and skip some date ticks
            let fields = val.split(' ');
            if (ind % 2 === 0)
              if (ind === 0 || fields[0] !== values[ind - 2].split(' ')[0]) {
                return fields[0];
              } else {
                // return fields[1];
              }
            return '';
          }
        }
      }
    ],
    yAxes: [{ ticks: { callback: (val, ind, values) => val + '°' } }]
  },
  tooltips: {
    intersect: false,
    callbacks: {
      afterTitle: (tooltipItem, chart) => {
        return weatherRecords[tooltipItem[0].index].toUpperCase();
      }
    },
    bodyFontSize: 16,
    titleFontSize: 16
  }
};

document.addEventListener('DOMContentLoaded', event => {
  // chart.js setup
  Chart.defaults.global.defaultFontFamily = 'Oswald';
  const dataset = {
    label: 'Temperature',
    borderColor: '#10849d',
    pointBackgroundColor: '#10849d',
    pointRadius: 4,
    data: []
  };
  const ctx = document.getElementById('chart-forecast').getContext('2d');
  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [dataset]
    },
    options: config
  });

  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(pos => putWeather(pos.coords, chart));
  } else {
    console.log('Geolocation is not available.');
  }

  let input = document.getElementById('locat');
  input.value = '';
  input.onchange = () => {
    putWeather(input.value, chart);
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

      let text = document.getElementById('description');
      text.innerHTML = `As of ${weather.day}
          ${weather.hour % 12 === 0 ? '12' : weather.hour % 12}:${
        weather.minute < 10 ? '0' + weather.minute : weather.minute
      }
          ${weather.hour < 12 ? 'AM' : 'PM'},
          the weather in ${weather.location}, ${weather.country} consists of
          ${weather.weather}.<br>The temperature is ${weather.current}°F, with a max today of
          ${weather.max}°F and min of ${weather.min}°F.`;
      let img = document.getElementById('icon');
      img.setAttribute('src', weather.iconUrl);

      document.getElementById('locat').value = '';
      document
        .getElementById('locat')
        .setAttribute('placeholder', `${weather.location}, ${weather.country}`);

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
        min.innerHTML = day.min + ' ';
        max.innerHTML = day.max;
        icon.setAttribute('src', day.iconUrl);

        let line = document.createElement('div');
        line.classList.add('triangle');

        dayForecast.append(icon, max, min, line);

        days.append(dayText);
        forecasts.append(dayForecast);
      }

      let temps = [],
        times = [];
      while (weatherRecords.length > 0) weatherRecords.pop();

      let dayOverview = document.createElement('div');
      dayOverview.classList.add('dropdown-content');

      let dropdowns = forecasts.childNodes;
      let count = 0;

      weather.hourForecasts.forEach((elem, i, arr) => {
        let dayAbbrev = elem.day.slice(0, 3).toUpperCase();
        let hr12 = `${elem.hour % 12 === 0 ? '12' : elem.hour % 12}${elem.hour < 12 ? 'AM' : 'PM'}`;

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

          if (i === arr.length - 1 || elem.day !== arr[i + 1].day) {
            dropdowns[count++].append(dayOverview);
            dayOverview = document.createElement('div');
            dayOverview.classList.add('dropdown-content');
          }
        }

        times.push(`${dayAbbrev} ${hr12}`);
        temps.push(elem.temp);
        weatherRecords.push(elem.weather);
      });

      document.body.classList.add('fade-out');

      // update 5-day forecast
      replaceDays.parentNode.replaceChild(days, replaceDays);
      replaceForecasts.parentNode.replaceChild(forecasts, replaceForecasts);

      // update chart
      chart.data.labels = times;
      chart.data.datasets[0].data = temps;
      chart.update();

      document.body.classList.remove('fade-out');
    })
    .catch(err => {
      console.error('Invalid location:', err);
      let input = document.getElementById('locat');
      input.value = '';
      document
        .getElementById('locat')
        .setAttribute('placeholder', 'Invalid location! Enter a city.');
    });
}

function scaleRange(x, in_min, in_max, out_min, out_max) {
  return ((x - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;
}
