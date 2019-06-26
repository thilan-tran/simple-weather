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

$(document).ready(() => {
  $('body').addClass('fade-out');

  /* chart.js setup */
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

  $('form').on('submit', event => {
    event.preventDefault();
    putWeather($('#locat').val(), chart);
  });
});

function putWeather(locat, chart) {
  let query;
  if (typeof locat === 'object') query = `${locat.latitude},${locat.longitude}`;
  else query = locat;

  $.ajax({
    url: '/',
    type: 'POST',
    contentType: 'application/json',
    dataType: 'json',
    data: JSON.stringify({ location: query })
  })
    .done((weather, textStatus, jqXHR) => {
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

      $('#description').html(description);

      $('#icon').attr('src', weather.iconUrl);

      $('#locat')
        .val('')
        .attr(
          'placeholder',
          `${weather.locale.location}, ${weather.locale.country}`
        );

      let replaceDays = $('tr:first');
      let replaceForecasts = $('tr:nth-of-type(1)');

      let days = $(document.createElement('tr'));
      let forecasts = $(document.createElement('tr'));

      for (let day of weather.dailyForecasts) {
        let dayText = $(document.createElement('th')).html(
          day.day.slice(0, 3).toUpperCase()
        );
        let dayForecast = $(document.createElement('td')).addClass('dropdown');

        let icon = $(document.createElement('img')).attr('src', day.iconUrl);
        let min = $(document.createElement('span')).html(day.min);
        let max = $(document.createElement('span')).html(day.max + ' ');
        let tri = $(document.createElement('div')).addClass('triangle');

        dayForecast.append(icon, max, min, tri);

        days.append(dayText);
        forecasts.append(dayForecast);
      }

      let temps = [],
        times = [],
        records = [];

      let dayOverview = $(document.createElement('div')).addClass(
        'dropdown-content'
      );

      let dropdowns = forecasts.children();
      let count = 0;

      weather.hourForecasts.forEach((elem, i, arr) => {
        let dayAbbrev = elem.time.day.slice(0, 3).toUpperCase();
        let hr12 = `${elem.time.hour % 12 === 0 ? '12' : elem.time.hour % 12}${
          elem.time.hour < 12 ? 'AM' : 'PM'
        }`;

        let img = $(document.createElement('img')).attr('src', elem.iconUrl);
        let info = $(document.createElement('p')).html(
          `${hr12} ${elem.temp.toFixed(0)}°`
        );

        if (count < dropdowns.length) {
          let percent = scaleRange(
            elem.temp,
            weather.dailyForecasts[count].min - 10,
            weather.dailyForecasts[count].max,
            0,
            100
          ).toFixed(0);
          let tempBar = $(document.createElement('span')).css(
            'width',
            `${percent}px`
          );

          dayOverview.append(tempBar, info, img);

          if (i === arr.length - 1 || elem.time.day !== arr[i + 1].time.day) {
            $(dropdowns[count++]).append(dayOverview);
            dayOverview = $(document.createElement('div')).addClass(
              'dropdown-content'
            );
          }
        }

        times.push(`${dayAbbrev} ${hr12}`);
        temps.push(elem.temp);
        records.push(elem.weather);
      });

      $('body').addClass('fade-out');

      replaceDays.replaceWith(days);
      replaceForecasts.replaceWith(forecasts);

      /* update chart */
      chart.data.labels = times;
      chart.data.datasets[0].data = temps;
      chart.data.datasets[1].data = records;
      chart.update();

      $('body').removeClass('fade-out');
    })
    .fail(err => {
      console.error('Invalid location:', err);
      $('#locat')
        .val('')
        .attr('placeholder', 'Invalid location! Enter a city.');
    });
}

function scaleRange(x, in_min, in_max, out_min, out_max) {
  return ((x - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;
}
