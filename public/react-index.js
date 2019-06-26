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

class LineChart extends React.Component {
  state = {
    chart: null
  };

  constructor(props) {
    super(props);
    this.chartRef = React.createRef();
  }

  componentDidMount() {
    const chartRef = this.chartRef.current.getContext('2d');

    /*  Chart.js setup */
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
    const newChart = new Chart(chartRef, {
      type: 'line',
      data: {
        labels: [],
        datasets: [dataset, records]
      },
      options: config
    });

    this.setState({
      chart: newChart
    });
  }

  render() {
    if (this.state.chart) {
      let chart = this.state.chart;
      chart.data.labels = this.props.times;
      chart.data.datasets[0].data = this.props.temps;
      chart.data.datasets[1].data = this.props.records;
      chart.update();
    }

    return (
      <canvas
        id="chart-forecast"
        width="400"
        height="150"
        ref={this.chartRef}
      />
    );
  }
}

function Form({ onChange, onSubmit, location, submitted }) {
  return (
    <form onSubmit={onSubmit}>
      <input
        type="text"
        id="locat"
        name="location"
        value={submitted ? '' : location}
        placeholder={location}
        onChange={onChange}
      />
    </form>
  );
}

function CurrentWeather({ iconUrl, description }) {
  return (
    <div className="container">
      <div id="current-weather">
        <img id="icon" src={iconUrl} />
        <p id="description">{description}</p>
      </div>
    </div>
  );
}

function DailyForecast({ days, forecasts }) {
  let ths = days.map(day => {
    return <th key={day}>{day}</th>;
  });

  let tds = forecasts.map(forecast => {
    return (
      <td className="dropdown" key={forecast.day}>
        <img src={forecast.iconUrl} />
        <span>{forecast.max + ' '}</span>
        <span>{forecast.min}</span>
        <div className="triangle" />
        <HourlyForecast hours={forecast.hourWeather} />
      </td>
    );
  });

  return (
    <table>
      <thead id="days">
        <tr>{ths}</tr>
      </thead>
      <tbody>
        <tr>{tds}</tr>
      </tbody>
    </table>
  );
}

function HourlyForecast({ hours }) {
  let overviews = hours.map(hour => {
    let tempBar = {
      width: `${hour.percent}px`
    };

    return (
      <React.Fragment key={hour.day + hour.info}>
        <span style={tempBar} />
        <p>{hour.info}</p>
        <img src={hour.iconUrl} />
      </React.Fragment>
    );
  });

  return <div className="dropdown-content">{overviews}</div>;
}

class App extends React.Component {
  state = {
    location: 'Location',
    description: '',
    iconUrl: '',
    forecast: {
      dayTexts: [],
      dayWeather: []
    },
    data: {
      times: [],
      temps: [],
      records: []
    },
    submitted: true
  };

  handleChange = ({ target }) => {
    this.setState({
      location: target.value,
      submitted: false
    });
  };

  handleSubmit = event => {
    event.preventDefault();
    this.putWeather();
  };

  putWeather = async () => {
    try {
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: this.state.location })
      });
      const weather = await res.json();

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

      let dayTexts = [],
        dayWeather = [];
      for (let day of weather.dailyForecasts) {
        dayTexts.push(day.day.slice(0, 3).toUpperCase());
        dayWeather.push({
          day: day.day,
          iconUrl: day.iconUrl,
          min: day.min,
          max: day.max,
          hourWeather: []
        });
      }

      let count = 0,
        hourOverviews = [],
        times = [],
        temps = [],
        records = [];

      weather.hourForecasts.forEach((elem, i, arr) => {
        let dayAbbrev = elem.time.day.slice(0, 3).toUpperCase();
        let hr12 = `${elem.time.hour % 12 === 0 ? '12' : elem.time.hour % 12}${
          elem.time.hour < 12 ? 'AM' : 'PM'
        }`;
        let info = `${hr12} ${elem.temp.toFixed(0)}°`;

        if (count < dayWeather.length) {
          let percent = scaleRange(
            elem.temp,
            weather.dailyForecasts[count].min - 10,
            weather.dailyForecasts[count].max,
            0,
            100
          ).toFixed(0);

          hourOverviews.push({
            day: dayAbbrev,
            info: info,
            percent: percent,
            iconUrl: elem.iconUrl
          });

          if (i === arr.length - 1 || elem.time.day !== arr[i + 1].time.day) {
            dayWeather[count++].hourWeather = hourOverviews;
            hourOverviews = [];
          }
        }

        times.push(`${dayAbbrev} ${hr12}`);
        temps.push(elem.temp);
        records.push(elem.weather);
      });

      document.body.classList.add('fade-out');
      this.setState({
        location: `${weather.locale.location}, ${weather.locale.country}`,
        description: description,
        iconUrl: weather.iconUrl,
        forecast: {
          dayTexts: dayTexts,
          dayWeather: dayWeather
        },
        data: {
          times: times,
          temps: temps,
          records: records
        },
        submitted: true
      });

      console.log(weather);
      document.body.classList.remove('fade-out');
    } catch (err) {
      console.log('Invalid location!', err);
      this.setState({
        location: 'Invalid location! Enter a city.',
        submitted: true
      });
    }
  };

  /*  on first load, fetch weather from location */
  componentDidMount() {
    document.body.classList.add('fade-out');
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(({ coords }) => {
        let lat = coords.latitude;
        let lon = coords.longitude;

        this.setState({
          location: lat + ',' + lon,
          submitted: false
        });
        this.putWeather();
      });
    } else {
      console.log('Geolocation is not available.');
    }
  }

  render() {
    return (
      <React.Fragment>
        <h1>SIMPLE WEATHER</h1>
        <Form
          submitted={this.state.submitted}
          onChange={this.handleChange}
          onSubmit={this.handleSubmit}
          location={this.state.location}
        />
        <CurrentWeather
          description={this.state.description}
          iconUrl={this.state.iconUrl}
        />
        <div id="forecast">
          <DailyForecast
            days={this.state.forecast.dayTexts}
            forecasts={this.state.forecast.dayWeather}
          />
        </div>
        <LineChart
          times={this.state.data.times}
          temps={this.state.data.temps}
          records={this.state.data.records}
        />
      </React.Fragment>
    );
  }
}

ReactDOM.render(<App />, document.getElementById('root'));

/* Arduino Map function */
function scaleRange(x, in_min, in_max, out_min, out_max) {
  return ((x - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;
}
