import requests
from flask import Flask, request, jsonify, abort
from datetime import datetime
from config import Config

app = Flask(__name__, static_url_path='', static_folder='public/')
app.config.from_object(Config)

api_key = app.config.get('API_KEY')
units = 'imperial'
weather_url = f'http://api.openweathermap.org/data/2.5/weather?units={units}&APPID={api_key}'
forecast_url = f'http://api.openweathermap.org/data/2.5/forecast?units={units}&APPID={api_key}'

@app.route('/', methods=['POST'])
def get_weather():
    location = request.json.get('location')
    coords = location.split(',')

    try:
        lat = float(coords[0])
        lon = float(coords[1])
        query = f'lat={lat}&lon={lon}'
    except ValueError:
        query = f'q={location}'

    print(f'POST request received for {query}')

    try:
        current_weather = requests.get(weather_url + '&' + query)
        current_weather.raise_for_status()
        forecast_weather = requests.get(forecast_url + '&' + query)
        forecast_weather.raise_for_status()
    except requests.exceptions.HTTPError as err:
        print('HTTP error:', err)
        abort(404)

    current_weather = current_weather.json()
    forecast_weather = forecast_weather.json().get('list')
    print('Weather retrieved.')

    timezone = current_weather.get('timezone')
    UTC_sunrise  = current_weather.get('sys').get('sunrise')
    UTC_sunset  = current_weather.get('sys').get('sunset')

    hour_forecasts = []
    daily_temps = []
    daily_forecasts = []

    snap_weather = forecast_weather[0].get('weather')[0].get('description')
    snap_time = forecast_weather[0].get('dt')

    for predict in forecast_weather:
        p_weather = predict.get('weather')[0].get('description')
        p_temp = predict.get('main').get('temp')
        p_ts = predict.get('dt')
        p_day, p_hour, _ = shift_timezone(p_ts, timezone)

        # print(f'Logging {p_hour}, {p_day}.')
        hour_forecasts.append({
            'main': predict.get('weather')[0].get('main'),
            'weather': p_weather,
            'temp': p_temp,
            'time': {
                'UTCtime': p_ts,
                'day': p_day,
                'hour': p_hour
            },
            'iconUrl': get_icon_url(str(p_weather), p_ts, timezone, UTC_sunrise, UTC_sunset)
        })
        daily_temps.append(p_temp)

        if p_hour == 11 or p_hour == 12 or p_hour == 13:
            snap_weather = p_weather
            snap_time = p_ts

        if p_hour == 21 or p_hour == 22 or p_hour == 23:
            print(f'End of {p_day}.')
            day_min = min(daily_temps)
            day_max = max(daily_temps)
            daily_temps.clear()

            daily_forecasts.append({
                'day': p_day,
                'weather': snap_weather,
                'min': day_min,
                'max': day_max,
                'iconUrl': get_icon_url(str(snap_weather), snap_time, timezone, UTC_sunrise, UTC_sunset)
            })

    day, hour, minute = shift_timezone(current_weather.get('dt'), timezone)
    _, rise_hr, rise_min = shift_timezone(UTC_sunrise, timezone)
    _, set_hr, set_min = shift_timezone(UTC_sunset, timezone)

    transform_weather = {
        'main': current_weather.get('weather')[0].get('main'),
        'weather': current_weather.get('weather')[0].get('description'),
        'current': current_weather.get('main').get('temp'),
        'min': current_weather.get('main').get('temp_min'),
        'max': current_weather.get('main').get('temp_max'),
        'time': {
            'UTCtime': current_weather.get('dt'),
            'day': day,
            'hour': hour,
            'minute': minute,
            'sunrise': rise_hr,
            'sunset': set_hr,
        },
        'locale': {
            'location': current_weather.get('name'),
            'country': current_weather.get('sys').get('country')
        },
        'hourForecasts': hour_forecasts,
        'dailyForecasts': daily_forecasts,
        'iconUrl': get_icon_url(current_weather.get('weather')[0].get('description'),
                                current_weather.get('dt'), timezone, UTC_sunrise, UTC_sunset)
    }

    return jsonify(transform_weather)

def shift_timezone(time, offset):
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    time += offset
    date = datetime.utcfromtimestamp(time).date()
    time = datetime.utcfromtimestamp(time).time()

    return (days[date.weekday()], time.hour, time.minute)

def get_icon_url(weather, time, offset, sunrise, sunset):
    conditions = ['thunderstorm', 'drizzle', 'rain', 'snow', 'haze', 'clear', 'clouds']
    day, hour, minute = shift_timezone(time, offset)
    _, rise_hr, rise_min = shift_timezone(sunrise, offset)
    _, set_hr, set_min = shift_timezone(sunset, offset)

    for cond in conditions:
        if cond in weather:
            if hour*60 + minute > rise_hr*60 + rise_min and \
               hour*60 + minute < set_hr*60 + set_min:
                return f'/img/{cond}_day.png'
            else:
                return f'/img/{cond}_night.png'

if __name__ == '__main__':
    app.run(debug=True)
