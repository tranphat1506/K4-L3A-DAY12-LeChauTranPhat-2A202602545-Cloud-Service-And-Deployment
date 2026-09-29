from dotenv import load_dotenv
load_dotenv()
from vinbus_api.client import VinbusClient
from jit_tracker import fetch_all_stations

c = VinbusClient()
fetch_all_stations(c, "hn")
